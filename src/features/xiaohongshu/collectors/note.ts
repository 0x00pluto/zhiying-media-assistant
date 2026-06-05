import {
  fetchBoardNotes,
  fetchHomefeed,
  fetchNoteFeed,
  fetchUserInfo,
  fetchUserPosted,
  searchNotes
} from "~features/xiaohongshu/api/client"
import {
  parseBoardUrl,
  parseNoteUrl,
  parseUserUrl,
  sleep
} from "~features/xiaohongshu/api/parsers"
import { NOTE_COLUMNS } from "~features/xiaohongshu/columns/note"
import { TaskRunner } from "~shared/task-runner"
import type { XhsApiType } from "~shared/columns/types"

export type NoteCollectCondition = {
  name?: string
  collectBy: "keyword" | "links" | "author-links" | "board-links" | "homefeed"
  keyword?: string
  keywords?: string[]
  urls?: string[]
  limit?: number
  limitPerId?: number
  note_type?: number
  sort?: string
  filters?: unknown
}

type AddRecordInput = {
  data: Record<string, unknown>
  api: XhsApiType
  uniqueId?: string
  noteUrl?: string
  userUrl?: string
  keyword?: string
}

export class NoteCollector extends TaskRunner<NoteCollectCondition> {
  readonly type = "note"
  readonly allColumns = NOTE_COLUMNS

  getTotal() {
    const c = this.condition
    if (c.collectBy === "keyword") {
      return (c.limit || 200) * (c.keywords?.length || 1)
    }
    if (c.collectBy === "links") {
      return c.urls?.length || 0
    }
    if (c.collectBy === "homefeed") {
      return c.limit || 200
    }
    return (c.urls?.length || 1) * (c.limitPerId || 50)
  }

  async execute() {
    const c = this.condition
    if (c.collectBy === "keyword") {
      const keywords = c.keywords || (c.keyword ? [c.keyword] : [])
      for (const keyword of keywords) {
        await this.collectByKeyword({ ...c, keyword })
      }
    } else if (c.collectBy === "links") {
      await this.collectByLinks(c.urls || [])
    } else if (c.collectBy === "author-links") {
      await this.collectByAuthorLinks(c.urls || [], c.limitPerId || 50)
    } else if (c.collectBy === "board-links") {
      await this.collectByBoardLinks(c.urls || [], c.limitPerId || 50)
    } else if (c.collectBy === "homefeed") {
      await this.collectByHomefeed(c.limit || 200)
    }
  }

  private async addRecord(input: AddRecordInput) {
    const idKey = this.allColumns[0].key
    const record: Record<string, unknown> = {}

    if (!input.uniqueId) {
      record.url = input.noteUrl
      record[idKey] = input.uniqueId
      this.records.push(record)
      return record
    }

    if (input.keyword) {
      const existing = this.records.find((r) => r[idKey] === input.uniqueId)
      if (existing) {
        const keywords = (existing.search_keywords as string[]) || []
        existing.search_keywords = [...keywords, input.keyword]
        return existing
      }
    }

    this.fillRecord(
      { ...input, pageUrl: input.noteUrl },
      record
    )

    if (input.userUrl) {
      try {
        const user = parseUserUrl(input.userUrl)
        const userInfo = await fetchUserInfo({ target_user_id: user.id })
        const basic = (userInfo as { basic_info?: Record<string, unknown> }).basic_info
        if (basic) {
          this.fillRecord(
            {
              data: basic,
              api: "blogger",
              pageUrl: input.userUrl,
              uniqueId: input.uniqueId
            },
            record
          )
        }
      } catch (error) {
        console.warn("fetch blogger failed", error)
      }
    }

    if (input.noteUrl) {
      try {
        const note = parseNoteUrl(input.noteUrl)
        const feed = (await fetchNoteFeed({
          source_note_id: input.uniqueId || note.id,
          image_formats: ["jpg", "webp", "avif"],
          extra: { need_body_topic: "1" },
          xsec_source: note.source,
          xsec_token: note.token
        })) as { items?: Array<{ note_card?: Record<string, unknown> }> }

        const noteCard = feed.items?.[0]?.note_card
        if (noteCard) {
          this.fillRecord(
            {
              data: noteCard,
              api: "feed",
              uniqueId: input.uniqueId,
              pageUrl: input.noteUrl,
              overwrite: true
            },
            record
          )
        }
      } catch (error) {
        console.warn("fetch feed failed", error)
      }
    }

    this.records.push(record)
    await sleep(this.interval.min, this.interval.max)
    return record
  }

  private async collectByKeyword(condition: NoteCollectCondition & { keyword: string }) {
    let page = 1
    let collected = 0
    const limit = condition.limit || 200
    const host = "www.xiaohongshu.com"

    while (collected < limit) {
      const result = await searchNotes({
        keyword: condition.keyword,
        note_type: condition.note_type ?? 0,
        sort: condition.sort || "general",
        filters: condition.filters,
        page,
        page_size: 20
      })

      const items = (result.items || []).filter(
        (item) => item.model_type === "note"
      )
      if (!items.length) break

      for (const item of items.slice(0, limit - collected)) {
        const card = item.note_card as Record<string, unknown> | undefined
        const user = card?.user as Record<string, unknown> | undefined
        const noteUrl = `https://${host}/explore/${item.id}?xsec_token=${item.xsec_token}&xsec_source=pc_search`
        const userUrl = user?.user_id
          ? `https://${host}/user/profile/${user.user_id}?xsec_token=${user.xsec_token}&xsec_source=pc_search`
          : undefined

        await this.addRecord({
          data: item,
          api: "search_notes",
          uniqueId: item.id as string,
          noteUrl,
          userUrl,
          keyword: condition.keyword
        })
        collected++
      }

      page++
      if (!result.has_more) break
      await sleep()
    }
  }

  private async collectByLinks(urls: string[]) {
    for (const url of urls) {
      const note = parseNoteUrl(url)
      await this.addRecord({
        data: { note_id: note.id, xsec_token: note.token },
        api: "user_posted",
        uniqueId: note.id,
        noteUrl: url
      })
    }
  }

  private async collectByAuthorLinks(urls: string[], limitPerId: number) {
    for (const url of urls) {
      const user = parseUserUrl(url)
      let cursor = ""
      let collected = 0

      while (collected < limitPerId) {
        const result = (await fetchUserPosted({
          user_id: user.id,
          cursor,
          num: 30,
          xsec_token: user.token,
          xsec_source: user.source
        })) as {
          notes?: Array<Record<string, unknown>>
          cursor?: string
          has_more?: boolean
        }

        const notes = result.notes || []
        for (const note of notes.slice(0, limitPerId - collected)) {
          const noteUrl = `https://www.xiaohongshu.com/explore/${note.note_id}?xsec_token=${note.xsec_token}&xsec_source=pc_user`
          await this.addRecord({
            data: note,
            api: "user_posted",
            uniqueId: note.note_id as string,
            noteUrl,
            userUrl: url
          })
          collected++
        }

        if (!result.has_more || !result.cursor) break
        cursor = result.cursor
        await sleep()
      }
    }
  }

  private async collectByBoardLinks(urls: string[], limitPerId: number) {
    for (const url of urls) {
      const board = parseBoardUrl(url)
      let page = 1
      let collected = 0

      while (collected < limitPerId) {
        const result = (await fetchBoardNotes({
          board_id: board.id,
          page,
          num: 30,
          xsec_token: board.token
        })) as {
          notes?: Array<Record<string, unknown>>
          has_more?: boolean
        }

        const notes = result.notes || []
        for (const note of notes.slice(0, limitPerId - collected)) {
          const noteUrl = `https://www.xiaohongshu.com/explore/${note.note_id}?xsec_token=${note.xsec_token}&xsec_source=pc_board`
          await this.addRecord({
            data: note,
            api: "board_notes",
            uniqueId: note.note_id as string,
            noteUrl
          })
          collected++
        }

        page++
        if (!result.has_more) break
        await sleep()
      }
    }
  }

  private async collectByHomefeed(limit: number) {
    let cursor = ""
    let collected = 0
    const host = "www.xiaohongshu.com"

    while (collected < limit) {
      const result = (await fetchHomefeed({
        cursor_score: cursor,
        num: 20,
        refresh_type: 1,
        note_index: collected
      })) as {
        items?: Array<Record<string, unknown>>
        cursor_score?: string
      }

      const items = result.items || []
      for (const item of items.slice(0, limit - collected)) {
        const noteUrl = `https://${host}/explore/${item.id}?xsec_token=${item.xsec_token}&xsec_source=pc_feed`
        await this.addRecord({
          data: item,
          api: "homefeed_notes",
          uniqueId: item.id as string,
          noteUrl
        })
        collected++
      }

      if (!result.cursor_score) break
      cursor = result.cursor_score
      await sleep()
    }
  }
}
