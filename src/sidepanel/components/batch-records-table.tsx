import type { ColumnDef } from "~shared/columns/types"

type Props = {
  columns: ColumnDef[]
  records: Record<string, unknown>[]
  maxRows?: number
}

export function BatchRecordsTable({
  columns,
  records,
  maxRows = 50
}: Props) {
  const visibleColumns = columns.filter((col) => col.default)

  if (!records.length || !visibleColumns.length) return null

  return (
    <div
      style={{
        overflow: "auto",
        maxHeight: 360,
        border: "1px solid #e5e7eb",
        marginTop: 12
      }}>
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {visibleColumns.map((col) => (
              <th key={col.key} style={thStyle}>
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.slice(0, maxRows).map((row, index) => (
            <tr key={index}>
              {visibleColumns.map((col) => (
                <td key={col.key} style={tdStyle}>
                  {String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: 8,
  background: "#f9fafb",
  borderBottom: "1px solid #e5e7eb",
  textAlign: "left"
}

const tdStyle: React.CSSProperties = {
  padding: 8,
  borderBottom: "1px solid #f3f4f6",
  maxWidth: 160,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
}
