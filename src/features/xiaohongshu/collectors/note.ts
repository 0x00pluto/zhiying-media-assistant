import {
  fetchBoardNotes,
  fetchHomefeed,
  fetchUserInfo,
  fetchUserPosted,
  searchNotes
} from "~features/xiaohongshu/api/client"
import {
  isXhsNoteId,
  parseBoardUrl,
  parseNoteUrl,
  parseUserUrl,
  sleep
} from "~features/xiaohongshu/api/parsers"
import { NOTE_COLUMNS } from "~features/xiaohongshu/columns/note"
import {
  collectNoteByUrl,
  parseNoteUrlOrNull,
  shouldWarnFeedMissingText,
  shouldWarnFeedOnlySeed
} from "~features/xiaohongshu/feed/collect-note-by-url"
import { fetchNoteDetail } from "~features/xiaohongshu/feed/fetch-note-detail"
import {
  buildFeedRequest,
  resolveFeedNoteId,
  type FeedNoteSeed
} from "~features/xiaohongshu/feed/resolve-feed-request"
import { TaskRunner } from "~shared/task-runner"
import type { XhsApiType } from "~shared/columns/types"

export type PageCollectType = "explore" | "search" | "profile"

export type PageNoteSeed = FeedNoteSeed & {
  id: string
  url: string
}

export type NoteCollectCondition = {
  name?: string
  pageCollectType?: PageCollectType
  collectBy: "keyword" | "links" | "author-links" | "board-links" | "homefeed"
  keyword?: string
  keywords?: string[]
  urls?: string[]
  pageNotes?: PageNoteSeed[]
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
  /** links 批量：已在 collectByLinks 拉过 feed，避免二次请求 */
  skipFeed?: boolean
  /** links 批量：feed.note_card.user 已够默认列，跳过 userOtherInfo */
  skipUserInfo?: boolean
  /** links 批量：已在 feed 前 waitInterval，避免重复 sleep */
  skipSleep?: boolean
}

export class NoteCollector extends TaskRunner<NoteCollectCondition> {
  readonly type = "note"
  readonly allColumns = NOTE_COLUMNS
  /** 对齐社媒助手 apiWrapper 间隔：每条 1~3s */
  interval = { min: 1, max: 3 }
  warnings: string[] = []
  private pageNoteSeeds = new Map<string, PageNoteSeed>()

  private recordWarning(error: unknown) {
    const msg = (error as Error).message?.trim()
    if (msg && !this.warnings.includes(msg)) {
      this.warnings.push(msg)
    }
  }

  private recordLinkWarning(index: number, url: string, message: string) {
    const short = url.length > 72 ? `${url.slice(0, 69)}...` : url
    const msg = `第 ${index} 条：${message}（${short}，网页亦无法打开时可忽略）`
    if (!this.warnings.includes(msg)) {
      this.warnings.push(msg)
    }
  }

  private buildPageNoteSeedMap(pageNotes: PageNoteSeed[]) {
    const map = new Map<string, PageNoteSeed>()
    for (const note of pageNotes) {
      map.set(note.id, note)
      if (note.url) map.set(note.url, note)
    }
    return map
  }

  private findPageNoteSeed(noteId: string, url: string) {
    return this.pageNoteSeeds.get(noteId) || this.pageNoteSeeds.get(url)
  }

  private resolveFeedNoteId(url: string, seed?: PageNoteSeed) {
    return resolveFeedNoteId(url, seed)
  }

  getTotal() {
    const c = this.condition
    if (c.collectBy === "keyword") {
      return (c.limit || 200) * (c.keywords?.length || 1)
    }
    if (c.collectBy === "links") {
      const total = c.urls?.length || 0
      const max = c.limit ?? total
      return total ? Math.min(total, max) : 0
    }
    if (c.collectBy === "homefeed") {
      return c.limit || 200
    }
    return (c.urls?.length || 1) * (c.limitPerId || 50)
  }

  private async waitInterval() {
    await sleep(this.interval.min, this.interval.max)
  }

  async execute() {
    this.warnings = []
    this.pageNoteSeeds = this.buildPageNoteSeedMap(this.condition.pageNotes || [])
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

  private isExplorePageBatch() {
    const c = this.condition
    return c.pageCollectType === "explore" || c.name === "发现页的笔记数据"
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

    this.fillRecord({ ...input, pageUrl: input.noteUrl }, record)

    if (input.userUrl && !input.skipUserInfo) {
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

    // 对齐社媒助手 addRecord：有 noteUrl 时再拉一次 feed（overwrite）
    if (input.noteUrl && !input.skipFeed) {
      try {
        const seed = input.uniqueId
          ? this.findPageNoteSeed(input.uniqueId, input.noteUrl || "")
          : undefined
        const feedNoteId =
          (input.uniqueId && isXhsNoteId(input.uniqueId)
            ? input.uniqueId
            : "") ||
          (input.noteUrl ? this.resolveFeedNoteId(input.noteUrl, seed) : "") ||
          input.uniqueId ||
          ""
        const { noteCard, error } = await fetchNoteDetail(
          buildFeedRequest(input.noteUrl, feedNoteId, seed, {
            forcePcFeed: this.isExplorePageBatch()
          })
        )
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
        } else if (error) {
          console.warn("fetch feed failed", error)
          this.recordWarning(error)
        }
      } catch (error) {
        console.warn("fetch feed failed", error)
        this.recordWarning(error)
      }
    }

    this.records.push(record)
    if (!input.skipSleep) {
      await sleep(this.interval.min, this.interval.max)
    }
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

      const items = (result?.items || []).filter(
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
      await sleep(this.interval.min, this.interval.max)
    }
  }

  /** 发现页本页笔记（links）：每条 1 次 v1/feed + feed 前 1~3s 抖动 */
  private async collectByLinks(urls: string[]) {
    const limit = this.condition.limit ?? urls.length
    const slice = urls.slice(0, limit)
    const forcePcFeed = this.isExplorePageBatch()

    for (let i = 0; i < slice.length; i++) {
      const url = slice[i]
      const index = i + 1

      const parsed = parseNoteUrlOrNull(url)
      if (!parsed) {
        this.recordLinkWarning(index, url, "链接无法解析")
        continue
      }

      const seed = this.findPageNoteSeed(parsed.id, url)
      const feedNoteId = this.resolveFeedNoteId(url, seed)

      if (!isXhsNoteId(feedNoteId)) {
        this.recordLinkWarning(index, url, "无效链接/笔记不存在")
        continue
      }

      await this.waitInterval()

      const result = await collectNoteByUrl({
        url,
        seed,
        forcePcFeed,
        scene: "batch"
      })

      if (!result) {
        continue
      }

      if (result.feedError) {
        console.warn("fetch feed failed", url, result.feedError)
        this.recordLinkWarning(index, url, result.feedError)
      }

      if (shouldWarnFeedOnlySeed(result.feedNote, result.merged)) {
        this.recordLinkWarning(
          index,
          url,
          "feed 失败，当前仅列表基础字段，请检查 Network 中 v1/feed 是否 code:0"
        )
      }

      if (shouldWarnFeedMissingText(result.merged)) {
        this.recordLinkWarning(
          index,
          url,
          "feed 未返回标题/正文/话题（常见于视频笔记）；可先在小红书页点开该笔记再采集"
        )
      }

      this.records.push(result.record)
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
        await sleep(this.interval.min, this.interval.max)
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
        await sleep(this.interval.min, this.interval.max)
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

      const items = result?.items || []
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
      await sleep(this.interval.min, this.interval.max)
    }
  }
}
