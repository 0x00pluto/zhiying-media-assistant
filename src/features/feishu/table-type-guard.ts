import {
  type BitableRef,
  hasRecordsWithFieldValue,
  listTableFields
} from "./bitable"
import { FEISHU_TARGET_KEYS } from "./sync-prefs"

export type TableDataKind = "empty" | "note" | "comment" | "conflict"
export type SyncKind = "note" | "comment"

const NOTE_ID_FIELD = "笔记ID"
const COMMENT_ID_FIELD = "评论ID"

const GUARD_API_ERROR =
  "无法校验目标表格类型，请检查网络与飞书应用权限后重试。"

const ASSERT_MESSAGES = {
  noteToCommentTable:
    "该数据表已用于同步评论，请选择其他表格或新建表格后再同步笔记。",
  commentToNoteTable:
    "该数据表已用于同步笔记，请选择其他表格或新建表格后再同步评论。",
  conflict:
    "该数据表内同时存在笔记与评论数据，请整理表格后重试，或选择其他表格。"
} as const

export function syncKindFromStorageKey(storageKey: string): SyncKind | null {
  switch (storageKey) {
    case FEISHU_TARGET_KEYS.noteDetail:
    case FEISHU_TARGET_KEYS.batchNote:
      return "note"
    case FEISHU_TARGET_KEYS.batchComment:
      return "comment"
    default:
      return null
  }
}

export async function detectBitableDataKind(
  ref: BitableRef
): Promise<TableDataKind> {
  try {
    const fields = await listTableFields(ref)
    const fieldNames = new Set(fields.map((field) => field.field_name))

    let hasComment = false
    let hasNote = false

    if (fieldNames.has(COMMENT_ID_FIELD)) {
      hasComment = await hasRecordsWithFieldValue(ref, COMMENT_ID_FIELD)
    }

    if (fieldNames.has(NOTE_ID_FIELD)) {
      hasNote = await hasRecordsWithFieldValue(ref, NOTE_ID_FIELD)
    }

    if (hasComment && hasNote) return "conflict"
    if (hasComment) return "comment"
    if (hasNote) return "note"
    return "empty"
  } catch {
    throw new Error(GUARD_API_ERROR)
  }
}

export function assertSyncTargetKind(
  tableKind: TableDataKind,
  expected: SyncKind
): void {
  if (tableKind === "empty") return

  if (tableKind === "conflict") {
    throw new Error(ASSERT_MESSAGES.conflict)
  }

  if (tableKind === "note" && expected === "comment") {
    throw new Error(ASSERT_MESSAGES.commentToNoteTable)
  }

  if (tableKind === "comment" && expected === "note") {
    throw new Error(ASSERT_MESSAGES.noteToCommentTable)
  }
}
