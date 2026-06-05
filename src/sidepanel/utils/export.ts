import type { ColumnDef } from "~shared/columns/types"

export function exportCsv(
  columns: ColumnDef[],
  records: Record<string, unknown>[],
  filename: string
) {
  const selected = columns.filter((c) => c.default !== false)
  const header = selected.map((c) => c.name)
  const rows = records.map((record) =>
    selected.map((col) => {
      const value = record[col.key]
      if (Array.isArray(value)) return value.join(";")
      if (value === undefined || value === null) return ""
      return String(value).replace(/"/g, '""')
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
  records: Record<string, unknown>[]
) {
  const selected = columns.filter((c) => c.default !== false)
  const header = selected.map((c) => c.name).join("\t")
  const rows = records
    .map((record) =>
      selected
        .map((col) => {
          const value = record[col.key]
          if (Array.isArray(value)) return value.join(";")
          return value ?? ""
        })
        .join("\t")
    )
    .join("\n")

  await navigator.clipboard.writeText(`${header}\n${rows}`)
}
