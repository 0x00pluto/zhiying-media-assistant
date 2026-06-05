import { useEffect, useState } from "react"

import { COMMENT_COLUMNS } from "~features/xiaohongshu/columns/comment"
import { FeishuSyncPanel } from "~sidepanel/components/feishu-sync-panel"
import { getCurrentTask, runTask } from "~sidepanel/store/task"
import { copyToClipboard, exportCsv } from "~sidepanel/utils/export"
import { TaskStatus } from "~shared/task-runner"

type Props = {
  initialState?: Record<string, unknown>
}

export function BatchCommentPage({ initialState }: Props) {
  const [links, setLinks] = useState(
    ((initialState?.urls as string[]) || []).join("\n")
  )
  const [limitPerId, setLimitPerId] = useState(
    Number(initialState?.limitPerId) || 100
  )
  const [includeSub, setIncludeSub] = useState(Boolean(initialState?.includeSub))
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState(TaskStatus.INITIAL)
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [error, setError] = useState("")

  useEffect(() => {
    if (initialState?.urls) {
      setLinks((initialState.urls as string[]).join("\n"))
    }
  }, [initialState])

  const startTask = async () => {
    setError("")
    setRunning(true)

    const condition = {
      name: (initialState?.name as string) || "评论批量采集",
      collectBy: "links" as const,
      urls: links.split("\n").map((s) => s.trim()).filter(Boolean),
      limitPerId,
      includeSub
    }

    try {
      const task = runTask("comment", condition, "/xiaohongshu/batch-collect/comment")
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
      <h2 style={{ marginTop: 0 }}>批量采集评论</h2>

      <label style={labelStyle}>
        笔记链接（每行一条）
        <textarea
          value={links}
          onChange={(e) => setLinks(e.target.value)}
          rows={6}
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        每篇上限
        <input
          type="number"
          value={limitPerId}
          onChange={(e) => setLimitPerId(Number(e.target.value))}
          style={inputStyle}
        />
      </label>

      <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={includeSub}
          onChange={(e) => setIncludeSub(e.target.checked)}
        />
        包含子评论
      </label>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={startTask} disabled={running} style={primaryBtn}>
          {running ? "采集中..." : "开始采集"}
        </button>
        <button
          type="button"
          disabled={!records.length}
          onClick={() => exportCsv(COMMENT_COLUMNS, records, "小红书评论")}
          style={secondaryBtn}>
          导出 CSV
        </button>
        <button
          type="button"
          disabled={!records.length}
          onClick={() => copyToClipboard(COMMENT_COLUMNS, records)}
          style={secondaryBtn}>
          复制
        </button>
      </div>

      {error && <p style={{ color: "#dc2626" }}>{error}</p>}
      <p style={{ color: "#6b7280", fontSize: 13 }}>
        状态: {status} · 进度 {progress.completed}/{progress.total}
      </p>

      {records.length > 0 && (
        <FeishuSyncPanel columns={COMMENT_COLUMNS} records={records} />
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
