import { fetchComments, fetchSubComments } from "~features/xiaohongshu/api/client"
import { parseNoteUrl, sleep } from "~features/xiaohongshu/api/parsers"
import {
  COMMENT_COLLECT_INTERVAL,
  COMMENT_FETCH_PARAMS,
  formatCommentRequestError,
  getCommentUserInfo,
  getEmbeddedSubComments,
  isRetryableCommentError,
  needsSubCommentFetch,
  parseCommentList,
  shouldDegradeCommentPage,
  type CommentListParseResult
} from "~features/xiaohongshu/collectors/comment-api-helpers"
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
  const userInfo = getCommentUserInfo(source)
  if (userInfo) {
    return {
      ...source,
      user_info: userInfo
    }
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
  const userInfo = getCommentUserInfo(raw)
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
  interval = { ...COMMENT_COLLECT_INTERVAL.default }
  /** 翻页/接口异常时提前结束，但保留已采数据 */
  partialStopReason = ""
  /** 笔记级熔断：空响应/限流后不再发 comment/sub 请求 */
  private degradedNotes = new Set<string>()

  private isApiDegraded(noteId: string) {
    return this.degradedNotes.has(noteId)
  }

  private markApiDegraded(noteId: string, error?: unknown) {
    this.degradedNotes.add(noteId)
    if (error !== undefined) {
      this.stopPaginationEarly(noteId, error)
      return
    }
    if (!this.partialStopReason) {
      this.partialStopReason = "评论接口返回异常空页，已停止继续采集"
    }
  }

  /** 无效/空页：一级评论保留部分数据时熔断；子评论翻页始终熔断 */
  private stopOnBadCommentPage(
    noteId: string,
    parsed: CommentListParseResult,
    alwaysDegrade: boolean
  ) {
    if (!shouldDegradeCommentPage(parsed)) return false
    if (alwaysDegrade || this.getCurrCompleted(noteId) > 0) {
      this.markApiDegraded(noteId)
    }
    return true
  }

  private async waitInterval(extraMin = 0, extraMax = 0) {
    await sleep(
      this.interval.min + extraMin,
      this.interval.max + extraMax
    )
  }

  private async requestWithRetry<T>(
    request: () => Promise<T>,
    context: string,
    maxRetries = 2
  ) {
    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt === 0) {
          await this.waitInterval()
        } else {
          await sleep(3 + attempt * 2, 6 + attempt * 2)
        }
        return await request()
      } catch (error) {
        lastError = error
        if (attempt < maxRetries && isRetryableCommentError(error)) {
          console.warn(`${context} retry ${attempt + 1}`, error)
          continue
        }
        throw error
      }
    }

    throw lastError
  }

  private stopPaginationEarly(noteId: string, error: unknown) {
    this.partialStopReason = formatCommentRequestError(error)
    console.warn("comment pagination stopped early", noteId, error)
  }

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
    this.partialStopReason = ""
    this.degradedNotes.clear()
    this.interval = this.condition.includeSub
      ? { ...COMMENT_COLLECT_INTERVAL.withSub }
      : { ...COMMENT_COLLECT_INTERVAL.default }

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

  private async collectEmbeddedSubComments(
    pageUrl: string,
    noteId: string,
    rootComment: Record<string, unknown>
  ) {
    for (const subComment of getEmbeddedSubComments(rootComment)) {
      if (this.isApiDegraded(noteId)) return
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
  }

  /** 阶段 2：仅 sub/page 翻页（embedded 已在阶段 1 写入） */
  private async collectSubComments(
    pageUrl: string,
    noteId: string,
    rootComment: Record<string, unknown>,
    token: string
  ) {
    if (this.isApiDegraded(noteId)) return

    if (!needsSubCommentFetch(rootComment)) return

    let cursor = String(
      rootComment.sub_comment_cursor ?? rootComment.subCommentCursor ?? ""
    )
    const rootCommentId = String(rootComment.id)

    while (
      !this.isApiDegraded(noteId) &&
      this.getCurrCompleted(noteId) < (this.condition.limitPerId || 100)
    ) {
      let result: unknown

      try {
        result = await this.requestWithRetry(
          () =>
            fetchSubComments({
              note_id: noteId,
              root_comment_id: rootCommentId,
              num: 10,
              cursor,
              top_comment_id: "",
              ...COMMENT_FETCH_PARAMS,
              xsec_token: token
            }),
          `sub_comment:${rootCommentId}`,
          0
        )
      } catch (error) {
        console.warn("fetch sub comments page failed", rootCommentId, error)
        this.markApiDegraded(noteId, error)
        return
      }

      const parsed = parseCommentList(result)

      if (this.stopOnBadCommentPage(noteId, parsed, true)) return

      for (const subComment of parsed.comments) {
        if (this.isApiDegraded(noteId)) return
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

      if (!parsed.hasMore || parsed.isEmpty) break

      cursor = parsed.cursor
    }
  }

  private async collectNoteComments(pageUrl: string, limit: number) {
    const note = parseNoteUrl(pageUrl)
    const xsecToken = note.token
    let cursor = ""
    const pendingSubRoots: Array<Record<string, unknown>> = []
    const { subRootExtra } = COMMENT_COLLECT_INTERVAL

    // 阶段 1：滚动式一级 comment/page（对齐浏览器，不在此阶段打 sub/page）
    while (
      !this.isApiDegraded(note.id) &&
      this.getCurrCompleted(note.id) < limit
    ) {
      let result: unknown

      try {
        result = await this.requestWithRetry(
          () =>
            fetchComments({
              note_id: note.id,
              cursor,
              top_comment_id: "",
              ...COMMENT_FETCH_PARAMS,
              xsec_token: xsecToken
            }),
          `comment_page:${note.id}:${cursor || "first"}`,
          0
        )
      } catch (error) {
        if (this.getCurrCompleted(note.id) > 0) {
          this.markApiDegraded(note.id, error)
          break
        }
        throw new Error(formatCommentRequestError(error))
      }

      const parsed = parseCommentList(result)

      if (this.stopOnBadCommentPage(note.id, parsed, false)) break

      for (const comment of parsed.comments) {
        if (this.isApiDegraded(note.id)) break
        if (this.getCurrCompleted(note.id) >= limit) break

        await this.addRecord({
          data: comment,
          api: "comment",
          uniqueId: String(comment.id),
          pageUrl
        })

        await this.collectEmbeddedSubComments(pageUrl, note.id, comment)

        if (
          this.condition.includeSub &&
          !this.isApiDegraded(note.id) &&
          needsSubCommentFetch(comment)
        ) {
          pendingSubRoots.push(comment)
        }
      }

      if (!parsed.hasMore || parsed.isEmpty) break

      cursor = parsed.cursor
    }

    // 阶段 2：逐 root 展开子评论（对齐浏览器点击「查看更多回复」）
    if (this.condition.includeSub && !this.isApiDegraded(note.id)) {
      for (const rootComment of pendingSubRoots) {
        if (this.isApiDegraded(note.id)) break
        if (this.getCurrCompleted(note.id) >= limit) break

        // 略慢于翻页，模拟点开回复；requestWithRetry 内还有一次请求前等待
        await this.waitInterval(subRootExtra.min, subRootExtra.max)
        await this.collectSubComments(pageUrl, note.id, rootComment, xsecToken)
      }
    }
  }
}
