import { useEffect, useState } from "react"

import { NOTE_COLUMNS } from "~features/xiaohongshu/columns/note"
import { FeishuSyncPanel } from "~sidepanel/components/feishu-sync-panel"
import { clearTask, getCurrentTask, runTask } from "~sidepanel/store/task"
import { copyToClipboard, exportCsv } from "~sidepanel/utils/export"
import { TaskStatus } from "~shared/task-runner"

type Props = {
  initialState?: Record<string, unknown>
}

export function BatchNotePage({ initialState }: Props) {
  const [collectBy, setCollectBy] = useState(
    (initialState?.collectBy as string) || "keyword"
  )
  const [keyword, setKeyword] = useState((initialState?.keyword as string) || "")
  const [links, setLinks] = useState(
    ((initialState?.urls as string[]) || []).join("\n")
  )
  const [limit, setLimit] = useState(Number(initialState?.limit) || 200)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState(TaskStatus.INITIAL)
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [error, setError] = useState("")

  useEffect(() => {
    if (initialState) {
      setCollectBy((initialState.collectBy as string) || "keyword")
      setKeyword((initialState.keyword as string) || "")
      setLinks(((initialState.urls as string[]) || []).join("\n"))
      setLimit(Number(initialState.limit) || 200)
    }
  }, [initialState])

  const startTask = async () => {
    setError("")
    setRunning(true)

    const condition: Record<string, unknown> = {
      name: (initialState?.name as string) || "笔记批量采集",
      collectBy,
      limit,
      note_type: initialState?.note_type ?? 0,
      sort: initialState?.sort || "general"
    }

    if (collectBy === "keyword") {
      condition.keyword = keyword
    } else {
      condition.urls = links.split("\n").map((s) => s.trim()).filter(Boolean)
      if (collectBy === "author-links" || collectBy === "board-links") {
        condition.limitPerId = limit
      }
    }

    try {
      const task = runTask("note", condition, "/xiaohongshu/batch-collect/note")
      setProgress({ completed: 0, total: task.getTotal() })

      const timer = setInterval(() => {
        const current = getCurrentTask()
        if (current) {
          setProgress({
            completed: current.getCompleted(),
            total: current.getTotal()
          })
          setStatus(current.status)
        }
      }, 500)

      await task.run()
      clearInterval(timer)
      setStatus(task.status)
      setProgress({
        completed: task.getCompleted(),
        total: task.getTotal()
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  const task = getCurrentTask()
  const records = task?.records || []

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>批量采集笔记</h2>

      <label style={labelStyle}>
        采集方式
        <select
          value={collectBy}
          onChange={(e) => setCollectBy(e.target.value)}
          style={inputStyle}>
          <option value="keyword">关键词</option>
          <option value="links">笔记链接</option>
          <option value="author-links">博主链接</option>
          <option value="board-links">专辑链接</option>
          <option value="homefeed">首页推荐</option>
        </select>
      </label>

      {collectBy === "keyword" ? (
        <label style={labelStyle}>
          关键词
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={inputStyle}
          />
        </label>
      ) : collectBy !== "homefeed" ? (
        <label style={labelStyle}>
          链接（每行一条）
          <textarea
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            rows={6}
            style={inputStyle}
          />
        </label>
      ) : null}

      <label style={labelStyle}>
        数量上限
        <input
          type="number"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          style={inputStyle}
        />
      </label>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={startTask} disabled={running} style={primaryBtn}>
          {running ? "采集中..." : "开始采集"}
        </button>
        <button
          type="button"
          disabled={!records.length}
          onClick={() => exportCsv(NOTE_COLUMNS, records, "小红书笔记")}
          style={secondaryBtn}>
          导出 CSV
        </button>
        <button
          type="button"
          disabled={!records.length}
          onClick={() => copyToClipboard(NOTE_COLUMNS, records)}
          style={secondaryBtn}>
          复制
        </button>
      </div>

      {error && <p style={{ color: "#dc2626" }}>{error}</p>}
      <p style={{ color: "#6b7280", fontSize: 13 }}>
        状态: {status} · 进度 {progress.completed}/{progress.total}
      </p>

      {records.length > 0 && (
        <FeishuSyncPanel columns={NOTE_COLUMNS} records={records} />
      )}

      {records.length > 0 && (
        <div style={{ overflow: "auto", maxHeight: 360, border: "1px solid #e5e7eb", marginTop: 12 }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {NOTE_COLUMNS.filter((c) => c.default).map((col) => (
                  <th key={col.key} style={thStyle}>
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 50).map((row, index) => (
                <tr key={index}>
                  {NOTE_COLUMNS.filter((c) => c.default).map((col) => (
                    <td key={col.key} style={tdStyle}>
                      {String(row[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 12,
  fontSize: 13,
  color: "#374151"
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  boxSizing: "border-box"
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
  maxWidth: 160,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
}
