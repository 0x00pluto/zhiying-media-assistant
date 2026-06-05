import { useEffect, useState } from "react"

import { NOTE_COLUMNS } from "~features/xiaohongshu/columns/note"
import type { NoteCollector } from "~features/xiaohongshu/collectors/note"
import {
  NOTE_BATCH_COLLECT_DISABLED_HINT,
  useNoteBatchCollectEnabled
} from "~features/xiaohongshu/use-note-batch-enabled"
import { FeishuSyncPanel } from "~sidepanel/components/feishu-sync-panel"
import { openExtensionOptions } from "~shared/messaging"
import { getCurrentTask, runTask } from "~sidepanel/store/task"
import { copyToClipboard, exportCsv } from "~sidepanel/utils/export"
import { TaskStatus } from "~shared/task-runner"

type Props = {
  initialState?: Record<string, unknown>
}

function parseLinkLines(text: string) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
}

function resolveInitialLimit(initialState?: Record<string, unknown>) {
  const collectBy = (initialState?.collectBy as string) || "keyword"
  const urlList = (initialState?.urls as string[]) || []

  if (collectBy === "links" && urlList.length) {
    return Number(initialState?.limit) || urlList.length
  }

  return Number(initialState?.limit) || 200
}

export function BatchNotePage({ initialState }: Props) {
  const { enabled: noteBatchEnabled } = useNoteBatchCollectEnabled()
  const [collectBy, setCollectBy] = useState(
    (initialState?.collectBy as string) || "keyword"
  )
  const [keyword, setKeyword] = useState((initialState?.keyword as string) || "")
  const [links, setLinks] = useState(
    ((initialState?.urls as string[]) || []).join("\n")
  )
  const [limit, setLimit] = useState(resolveInitialLimit(initialState))
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState(TaskStatus.INITIAL)
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [records, setRecords] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState("")
  const [warning, setWarning] = useState("")

  useEffect(() => {
    if (initialState) {
      setCollectBy((initialState.collectBy as string) || "keyword")
      setKeyword((initialState.keyword as string) || "")
      setLinks(((initialState.urls as string[]) || []).join("\n"))
      setLimit(resolveInitialLimit(initialState))
    }
  }, [initialState])

  const handleLinksChange = (text: string) => {
    setLinks(text)
    if (collectBy === "links") {
      const count = parseLinkLines(text).length
      if (count > 0) setLimit(count)
    }
  }

  const startTask = async () => {
    if (!noteBatchEnabled) {
      setWarning(NOTE_BATCH_COLLECT_DISABLED_HINT)
      return
    }

    setError("")
    setWarning("")
    setRunning(true)

    const urlList = parseLinkLines(links)
    const effectiveLimit =
      collectBy === "links"
        ? Math.min(Math.max(limit, 1), urlList.length || limit)
        : limit

    const condition: Record<string, unknown> = {
      name: (initialState?.name as string) || "笔记批量采集",
      collectBy,
      limit: effectiveLimit,
      note_type: initialState?.note_type ?? 0,
      sort: initialState?.sort || "general"
    }

    if (collectBy === "keyword") {
      condition.keyword = keyword
    } else if (collectBy === "links") {
      condition.urls = urlList.slice(0, effectiveLimit)
      const pageNotes = initialState?.pageNotes as
        | Array<{ id: string; url: string; noteCard?: Record<string, unknown> }>
        | undefined
      if (pageNotes?.length) {
        const urlSet = new Set(condition.urls as string[])
        condition.pageNotes = pageNotes.filter((note) => urlSet.has(note.url))
      }
    } else if (collectBy !== "homefeed") {
      condition.urls = urlList
      if (collectBy === "author-links" || collectBy === "board-links") {
        condition.limitPerId = effectiveLimit
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
          setRecords([...current.records])
        }
      }, 500)

      await task.run()
      clearInterval(timer)
      setStatus(task.status)
      setProgress({
        completed: task.getCompleted(),
        total: task.getTotal()
      })
      setRecords([...task.records])

      const feedWarnings = (task as NoteCollector).warnings || []
      if (feedWarnings.length) {
        setWarning(feedWarnings.join("；"))
      } else if (task.getCompleted() === 0 && task.getTotal() > 0) {
        setWarning(
          "未采集到任何笔记，请保持小红书页面打开并刷新后重试"
        )
      } else if (task.getCompleted() < task.getTotal()) {
        setWarning(
          `部分链接未能获取详情（${task.getCompleted()}/${task.getTotal()}），已写入可采集的基础字段`
        )
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  const linkCount = parseLinkLines(links).length

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>批量采集笔记</h2>

      {!noteBatchEnabled && (
        <p
          style={{
            margin: "0 0 16px",
            padding: "12px 14px",
            borderRadius: 8,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            fontSize: 13,
            lineHeight: 1.6
          }}>
          {NOTE_BATCH_COLLECT_DISABLED_HINT}{" "}
          <button
            type="button"
            onClick={() => void openExtensionOptions("collect")}
            style={{
              marginLeft: 4,
              padding: 0,
              border: "none",
              background: "transparent",
              color: "#c2410c",
              textDecoration: "underline",
              cursor: "pointer",
              fontSize: 13
            }}>
            去设置开启
          </button>
        </p>
      )}

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
            onChange={(e) => handleLinksChange(e.target.value)}
            rows={6}
            style={inputStyle}
          />
        </label>
      ) : null}

      <label style={labelStyle}>
        {collectBy === "links" ? "采集条数（不超过链接数）" : "数量上限"}
        <input
          type="number"
          min={1}
          max={collectBy === "links" && linkCount ? linkCount : undefined}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          style={inputStyle}
        />
      </label>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={startTask}
          disabled={running || !noteBatchEnabled}
          style={{
            ...primaryBtn,
            opacity: noteBatchEnabled ? 1 : 0.5,
            cursor: noteBatchEnabled ? "pointer" : "not-allowed"
          }}>
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
      {warning && <p style={{ color: "#d97706", fontSize: 13 }}>{warning}</p>}
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
