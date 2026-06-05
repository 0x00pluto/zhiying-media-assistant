import type { FieldOptions } from "~features/feishu/sync-records"
import type { ColumnDef } from "~shared/columns/types"

export function pickColumns(columns: ColumnDef[], fieldOptions?: FieldOptions) {
  if (!fieldOptions?.keys?.length) {
    return columns.filter((column) => column.default !== false)
  }

  const columnMap = new Map(columns.map((column) => [column.key, column]))
  return fieldOptions.keys
    .map((key) => columnMap.get(key))
    .filter((column): column is ColumnDef => Boolean(column))
}
