import { fetchComments, fetchSubComments } from "~features/xiaohongshu/api/client"
import { parseNoteUrl, sleep } from "~features/xiaohongshu/api/parsers"
import { COMMENT_COLUMNS } from "~features/xiaohongshu/columns/comment"
import type { FieldOptions } from "~features/feishu/sync-records"
import type { XhsApiType } from "~shared/columns/types"
import { TaskRunner, TaskStatus } from "~shared/task-runner"

export type CommentCollectCondition = {
  name?: string
  collectBy: "links"
  urls: string[]
  limitPerId?: number
  includeSub?: boolean
  fieldOptions?: FieldOptions
}

type AddRecordInput = {
  data: Record<string, unknown>
  api: XhsApiType
  uniqueId: string
  pageUrl: string
  rootComment?: Record<string, unknown>
}

const META_ROOT_COMMENT_ID = "_root_comment_id"
const META_TARGET_COMMENT_ID = "_target_comment_id"

function toRootCommentData(source: Record<string, unknown>) {
  const userInfo = source.user_info as Record<string, unknown> | undefined
  if (userInfo) {
    return source
  }

  return {
    id: source.id,
    content: source.content,
    user_info: {
      user_id: source["user.user_id"],
      nickname: source["user.nickname"]
    }
  }
}

function toReplyCommentData(raw: Record<string, unknown>) {
  const userInfo = raw.user_info as Record<string, unknown> | undefined
  if (!userInfo && raw["user.user_id"] !== undefined) {
    return raw
  }

  return {
    id: raw.id,
    content: raw.content,
    "user.user_id": userInfo?.user_id,
    "user.nickname": userInfo?.nickname
  }
}

export class CommentCollector extends TaskRunner<CommentCollectCondition> {
  readonly type = "comment"
  readonly allColumns = COMMENT_COLUMNS
  private commentIds = new Set<string>()

  getTotal() {
    const planned =
      (this.condition.urls?.length || 0) * (this.condition.limitPerId || 100)

    if (
      this.status === TaskStatus.COMPLETED ||
      this.status === TaskStatus.FAILED
    ) {
      return this.getCompleted() || planned
    }

    return planned
  }

  getCurrCompleted(noteId: string) {
    return this.records.filter((record) => record.note_id === noteId).length
  }

  async execute() {
    this.commentIds.clear()
    for (const url of this.condition.urls || []) {
      await this.collectNoteComments(url, this.condition.limitPerId || 100)
    }
    this.backfillCommentRelations()
  }

  private fillRootComment(
    record: Record<string, unknown>,
    source: Record<string, unknown>,
    pageUrl: string
  ) {
    this.fillRecord(
      {
        data: toRootCommentData(source),
        api: "root_comment",
        pageUrl,
        overwrite: true
      },
      record
    )
  }

  private fillReplyComment(
    record: Record<string, unknown>,
    source: Record<string, unknown>,
    pageUrl: string
  ) {
    this.fillRecord(
      {
        data: toReplyCommentData(source),
        api: "reply_comment",
        pageUrl,
        overwrite: true
      },
      record
    )
  }

  private backfillCommentRelations() {
    const primaryKey = this.allColumns[0]?.key
    if (!primaryKey) return

    const byId = new Map<string, Record<string, unknown>>()
    for (const record of this.records) {
      const id = record[primaryKey]
      if (id !== undefined && id !== null && id !== "") {
        byId.set(String(id), record)
      }
    }

    for (const record of this.records) {
      const pageUrl = String(record.note_url || "")
      const rootCommentId = record[META_ROOT_COMMENT_ID] as string | undefined
      const targetCommentId = record[META_TARGET_COMMENT_ID] as string | undefined

      if (!record["root.id"]) {
        if (rootCommentId) {
          const rootRecord = byId.get(String(rootCommentId))
          if (rootRecord) {
            this.fillRootComment(record, rootRecord, pageUrl)
          }
        } else {
          // 一级评论：root 列与自身 id/content 对齐
          this.fillRootComment(record, record, pageUrl)
        }
      }

      if (targetCommentId && !record["reply.id"]) {
        const targetRecord = byId.get(String(targetCommentId))
        if (targetRecord) {
          this.fillReplyComment(record, targetRecord, pageUrl)
        }
      }

      delete record[META_ROOT_COMMENT_ID]
      delete record[META_TARGET_COMMENT_ID]
    }
  }

  private async addRecord(input: AddRecordInput) {
    const primaryKey = this.allColumns[0]?.key
    if (!input.uniqueId || !primaryKey) return {}

    let record: Record<string, unknown> = {}
    if (this.commentIds.has(input.uniqueId)) {
      const existing = this.records.find((item) => item[primaryKey] === input.uniqueId)
      if (existing) {
        record = existing
      } else {
        this.records.push(record)
      }
    } else {
      this.records.push(record)
    }

    this.commentIds.add(input.uniqueId)

    const noteId = parseNoteUrl(input.pageUrl).id
    this.fillRecord(
      {
        data: { ...input.data, note_id: noteId },
        api: input.api,
        pageUrl: input.pageUrl
      },
      record
    )

    if (input.api === "sub_comment" && input.rootComment?.id) {
      record[META_ROOT_COMMENT_ID] = String(input.rootComment.id)
    }

    const targetComment = input.data.target_comment as
      | Record<string, unknown>
      | undefined

    if (targetComment?.id) {
      record[META_TARGET_COMMENT_ID] = String(targetComment.id)
    }

    if (input.api === "comment" || !input.rootComment) {
      return record
    }

    this.fillRootComment(record, input.rootComment, input.pageUrl)

    if (targetComment?.id) {
      const targetRecord = this.records.find(
        (item) => item[primaryKey] === targetComment.id
      )
      if (targetRecord) {
        this.fillReplyComment(record, targetRecord, input.pageUrl)
      } else {
        this.fillReplyComment(record, targetComment, input.pageUrl)
      }
    }

    return record
  }

  private async collectSubComments(
    pageUrl: string,
    noteId: string,
    rootComment: Record<string, unknown>,
    token: string
  ) {
    const embedded = (rootComment.sub_comments || []) as Array<
      Record<string, unknown>
    >

    for (const subComment of embedded) {
      if (this.getCurrCompleted(noteId) >= (this.condition.limitPerId || 100)) {
        return
      }
      await this.addRecord({
        data: subComment,
        api: "sub_comment",
        uniqueId: String(subComment.id),
        pageUrl,
        rootComment
      })
    }

    const embeddedCount = embedded.length
    const totalSubCount = Number(rootComment.sub_comment_count ?? 0)
    const hasMore =
      Boolean(rootComment.sub_comment_has_more) ||
      totalSubCount > embeddedCount

    if (!hasMore) return

    let cursor = String(rootComment.sub_comment_cursor || "")
    const rootCommentId = String(rootComment.id)

    while (this.getCurrCompleted(noteId) < (this.condition.limitPerId || 100)) {
      let result: {
        comments?: Array<Record<string, unknown>>
        cursor?: string
        has_more?: boolean
      }

      try {
        result = (await fetchSubComments({
          note_id: noteId,
          root_comment_id: rootCommentId,
          num: 10,
          cursor,
          top_comment_id: "",
          image_formats: "jpg,webp,avif",
          xsec_token: token
        })) as typeof result
      } catch (error) {
        console.warn("fetch sub comments page failed", rootCommentId, error)
        break
      }

      const comments = result.comments || []
      if (!comments.length) break

      for (const subComment of comments) {
        if (this.getCurrCompleted(noteId) >= (this.condition.limitPerId || 100)) {
          return
        }
        await this.addRecord({
          data: subComment,
          api: "sub_comment",
          uniqueId: String(subComment.id),
          pageUrl,
          rootComment
        })
      }

      if (!result.has_more) break
      cursor = result.cursor || ""
      if (!cursor) break
      await sleep()
    }
  }

  private async collectNoteComments(pageUrl: string, limit: number) {
    const note = parseNoteUrl(pageUrl)
    let cursor = ""

    while (this.getCurrCompleted(note.id) < limit) {
      const result = (await fetchComments({
        note_id: note.id,
        cursor,
        top_comment_id: "",
        image_formats: "jpg,webp,avif",
        xsec_token: note.token
      })) as {
        comments?: Array<Record<string, unknown>>
        cursor?: string
        has_more?: boolean
      }

      const comments = result.comments || []
      if (!comments.length) break

      for (const comment of comments) {
        if (this.getCurrCompleted(note.id) >= limit) break

        await this.addRecord({
          data: comment,
          api: "comment",
          uniqueId: String(comment.id),
          pageUrl
        })

        if (this.condition.includeSub) {
          try {
            await this.collectSubComments(pageUrl, note.id, comment, note.token)
          } catch (error) {
            console.warn("fetch sub comments failed", comment.id, error)
          }
        }
      }

      if (!result.has_more || !result.cursor) break
      cursor = result.cursor
      await sleep()
    }
  }
}
