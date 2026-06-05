import { useState } from "react"

import { createShortUrl } from "~features/xiaohongshu/api/client"

type Row = { input: string; output: string; success: boolean }

export function UrlTransformPage() {
  const [input, setInput] = useState("")
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)

  const transform = async () => {
    setLoading(true)
    const urls = input.split("\n").map((s) => s.trim()).filter(Boolean)
    const results: Row[] = []

    for (const url of urls) {
      try {
        const data = (await createShortUrl({ original_url: url })) as {
          short_url?: string
        }
        results.push({
          input: url,
          output: data.short_url || url,
          success: Boolean(data.short_url)
        })
      } catch {
        results.push({ input: url, output: url, success: false })
      }
    }

    setRows(results)
    setLoading(false)
  }

  const copyOutputs = async () => {
    const text = rows
      .filter((r) => r.success)
      .map((r) => r.output)
      .join("\n")
    await navigator.clipboard.writeText(text)
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>长短链互转</h2>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={8}
        placeholder="每行一条链接"
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 6,
          border: "1px solid #d1d5db",
          boxSizing: "border-box"
        }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" onClick={transform} disabled={loading} style={primaryBtn}>
          {loading ? "转换中..." : "生成短链"}
        </button>
        <button type="button" disabled={!rows.length} onClick={copyOutputs} style={secondaryBtn}>
          复制结果
        </button>
      </div>

      {rows.length > 0 && (
        <table style={{ width: "100%", marginTop: 16, fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>输入</th>
              <th style={thStyle}>输出</th>
              <th style={thStyle}>结果</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={tdStyle}>{row.input}</td>
                <td style={tdStyle}>{row.output}</td>
                <td style={tdStyle}>{row.success ? "成功" : "失败"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const primaryBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 6,
  border: "none",
  background: "#ff2442",
  color: "#fff",
  cursor: "pointer"
}

const secondaryBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  background: "#fff",
  cursor: "pointer"
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
  wordBreak: "break-all"
}
