import type { ColumnDef } from "~shared/columns/types"

function getMediaExtension(column: ColumnDef) {
  return (column.feishu as { file_extension?: string } | undefined)?.file_extension || "jpg"
}

/** 图片列上传附件；视频列仅保存链接，不上传文件 */
export function isUploadableMediaColumn(column: ColumnDef) {
  if (column.feishu?.type !== 17) return false
  const extension = getMediaExtension(column).toLowerCase()
  return extension !== "mp4" && extension !== "video"
}

export function hasUploadableMediaColumns(
  columns: ColumnDef[],
  shouldUploadMedia?: boolean
) {
  return Boolean(shouldUploadMedia && columns.some(isUploadableMediaColumn))
}
