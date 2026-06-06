/** 子评论记录在 backfill 前用于关联一级评论的元字段 */
export const META_ROOT_COMMENT_ID = "_root_comment_id"

export function getNoteRecordCount(
  records: Array<Record<string, unknown>>,
  noteId: string
) {
  return records.filter((record) => record.note_id === noteId).length
}

/** 一级评论：采集阶段靠 META；backfill 后靠 id === root.id */
export function isRootCommentRecord(record: Record<string, unknown>) {
  if (record[META_ROOT_COMMENT_ID]) {
    return false
  }

  const rootId = record["root.id"]
  if (rootId !== undefined && rootId !== null && rootId !== "") {
    const id = record.id
    return id !== undefined && id !== null && String(id) === String(rootId)
  }

  return true
}

/** 一级评论：无 META_ROOT_COMMENT_ID 的记录（backfill 前）或 id === root.id（backfill 后） */
export function getRootCommentCount(
  records: Array<Record<string, unknown>>,
  noteId: string
) {
  return records.filter(
    (record) => record.note_id === noteId && isRootCommentRecord(record)
  ).length
}

export function isUnderCollectLimit(input: {
  records: Array<Record<string, unknown>>
  noteId: string
  limit: number
  includeSub?: boolean
}) {
  const { records, noteId, limit, includeSub } = input
  if (includeSub) {
    return getRootCommentCount(records, noteId) < limit
  }
  return getNoteRecordCount(records, noteId) < limit
}

/** 写入子评论时是否仍受 limitPerId 约束（关闭 includeSub 时 embedded 计入总数） */
export function shouldLimitSubCommentRecords(includeSub?: boolean) {
  return !includeSub
}

/** 侧边栏进度：开启 includeSub 时仅统计一级评论 */
export function getProgressCompletedCount(
  records: Array<Record<string, unknown>>,
  includeSub?: boolean
) {
  if (includeSub) {
    return records.filter(isRootCommentRecord).length
  }
  return records.length
}
