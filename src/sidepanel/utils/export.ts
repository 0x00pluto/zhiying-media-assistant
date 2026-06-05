import type { FieldOptions } from "~features/feishu/sync-records"
import { pickColumns } from "~shared/columns/pick"
import type { ColumnDef } from "~shared/columns/types"

function formatExportValue(value: unknown, column: ColumnDef) {
  if (value === undefined || value === null) return ""
  if (Array.isArray(value)) return value.join(";")

  if (column.feishu?.type === 5 && typeof value === "number") {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      const pad = (num: number) => String(num).padStart(2, "0")
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
  }

  return String(value)
}

export function exportCsv(
  columns: ColumnDef[],
  records: Record<string, unknown>[],
  filename: string,
  fieldOptions?: FieldOptions
) {
  const selected = pickColumns(columns, fieldOptions)
  const header = selected.map((column) => column.name)
  const rows = records.map((record) =>
    selected.map((column) => {
      const value = formatExportValue(record[column.key], column)
      return value.replace(/"/g, '""')
    })
  )

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n")

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export async function copyToClipboard(
  columns: ColumnDef[],
  records: Record<string, unknown>[],
  fieldOptions?: FieldOptions
) {
  const selected = pickColumns(columns, fieldOptions)
  const header = selected.map((column) => column.name).join("\t")
  const rows = records
    .map((record) =>
      selected
        .map((column) => formatExportValue(record[column.key], column))
        .join("\t")
    )
    .join("\n")

  await navigator.clipboard.writeText(`${header}\n${rows}`)
}
