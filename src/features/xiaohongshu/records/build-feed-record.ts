import { NOTE_COLUMNS } from "~features/xiaohongshu/columns/note"

/** 从扁平 note_card 构建 feed 采集行（批量 / 单条共用） */
export function buildFeedNoteRecord(
  rawNote: Record<string, unknown>,
  noteId: string,
  pageUrl: string,
  config?: unknown
) {
  const record: Record<string, unknown> = {}

  for (const column of NOTE_COLUMNS) {
    if (!column.apis.includes("feed")) continue
    const value = column.handle({
      data: rawNote,
      api: "feed",
      pageUrl,
      config
    })
    if (value !== undefined) {
      record[column.key] = value
    }
  }

  if (!record.note_id) {
    record.note_id = rawNote.note_id || noteId
  }
  if (!record.url) {
    record.url = pageUrl
  }

  return record
}
