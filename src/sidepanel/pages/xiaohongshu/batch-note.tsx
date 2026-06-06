import { Button } from "antd"
import { useEffect, useState } from "react"

import { NOTE_COLUMNS } from "~features/xiaohongshu/columns/note"
import type { NoteCollector } from "~features/xiaohongshu/collectors/note"
import {
  isXhsNoteId,
  parseNoteUrl
} from "~features/xiaohongshu/api/parsers"
import {
  NOTE_BATCH_COLLECT_DISABLED_HINT,
  useNoteBatchCollectEnabled
} from "~features/xiaohongshu/use-note-batch-enabled"
import { FeishuSyncPanel } from "~sidepanel/components/feishu-sync-panel"
import { BatchRecordsTable } from "~sidepanel/components/batch-records-table"
import { openExtensionOptions } from "~shared/messaging"
import { getCurrentTask, runTask } from "~sidepanel/store/task"
import { exportCsv } from "~sidepanel/utils/export"
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

function filterCollectibleUrls(urls: string[]) {
  return urls.filter((url) => {
    try {
      const parsed = parseNoteUrl(url)
      return isXhsNoteId(parsed.noteId || parsed.id)
    } catch {
      return false
    }
  })
}

function resolveInitialLimit(initialState?: Record<string, unknown>) {
  const urlList = (initialState?.urls as string[]) || []
  if (urlList.length) {
    return Number(initialState?.limit) || urlList.length
  }
  return Number(initialState?.limit) || 200
}

export function BatchNotePage({ initialState }: Props) {
  const { enabled: noteBatchEnabled } = useNoteBatchCollectEnabled()
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
      setLinks(((initialState.urls as string[]) || []).join("\n"))
      setLimit(resolveInitialLimit(initialState))
    }
  }, [initialState])

  const collectibleUrls = filterCollectibleUrls(parseLinkLines(links))
  const collectibleCount = collectibleUrls.length
  const limitExceedsLinks =
    collectibleCount > 0 && (limit < 1 || limit > collectibleCount)
  const canStart =
    noteBatchEnabled &&
    !running &&
    collectibleCount > 0 &&
    limit >= 1 &&
    limit <= collectibleCount

  const startTask = async () => {
    if (!noteBatchEnabled) {
      setWarning(NOTE_BATCH_COLLECT_DISABLED_HINT)
      return
    }

    if (collectibleCount === 0) {
      setError("暂无可用链接，请在小红书页面点击「采集本页笔记」导入")
      return
    }

    if (limit > collectibleCount) {
      setError(`采集条数不能超过链接数（当前 ${collectibleCount} 条）`)
      return
    }

    setError("")
    setWarning("")
    setRunning(true)

    const effectiveLimit = Math.min(Math.max(limit, 1), collectibleCount)

    const condition: Record<string, unknown> = {
      name: (initialState?.name as string) || "笔记批量采集",
      collectBy: "links",
      limit: effectiveLimit,
      note_type: initialState?.note_type ?? 0,
      sort: initialState?.sort || "general",
      urls: collectibleUrls.slice(0, effectiveLimit)
    }

    if (initialState?.pageCollectType) {
      condition.pageCollectType = initialState.pageCollectType
    }

    const pageNotes = initialState?.pageNotes as
      | Array<{
          id: string
          url: string
          xsec_token?: string
          noteCard?: Record<string, unknown>
          api?: string
        }>
      | undefined
    if (pageNotes?.length) {
      const urlListSet = new Set(condition.urls as string[])
      condition.pageNotes = pageNotes.filter(
        (note) =>
          urlListSet.has(note.url) ||
          (condition.urls as string[]).some((item) => item.includes(note.id))
      )
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

  const isCompleted =
    status === TaskStatus.COMPLETED && records.length > 0 && !running

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
        <select value="links" disabled style={inputStyle}>
          <option value="links">笔记链接</option>
        </select>
      </label>

      <label style={labelStyle}>
        链接（每行一条，由「采集本页笔记」自动填入，不可手动修改）
        <textarea
          value={links}
          readOnly
          rows={6}
          style={{
            ...inputStyle,
            ...readOnlyInputStyle,
            color: links ? "#374151" : "#9ca3af"
          }}
          placeholder="请在小红书页面点击「采集本页笔记」导入链接"
        />
      </label>

      <label style={labelStyle}>
        采集条数（不超过链接数 {collectibleCount || 0} 条）
        <input
          type="number"
          min={1}
          max={collectibleCount || undefined}
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value))
            setError("")
          }}
          disabled={collectibleCount === 0}
          style={inputStyle}
        />
      </label>

      {collectibleCount === 0 && (
        <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 12px" }}>
          暂无链接。请打开小红书发现页/搜索页/博主页，点击「采集本页笔记」后再开始采集。
        </p>
      )}

      {limitExceedsLinks && (
        <p style={{ color: "#dc2626", fontSize: 13, margin: "0 0 12px" }}>
          采集条数不能超过链接数（当前 {collectibleCount} 条）
        </p>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={startTask}
          disabled={!canStart}
          style={{
            ...primaryBtn,
            opacity: canStart ? 1 : 0.5,
            cursor: canStart ? "pointer" : "not-allowed"
          }}>
          {running ? "采集中..." : "开始采集"}
        </button>
      </div>

      {error && <p style={{ color: "#dc2626" }}>{error}</p>}
      {warning && <p style={{ color: "#d97706", fontSize: 13 }}>{warning}</p>}
      <p style={{ color: "#6b7280", fontSize: 13 }}>
        状态: {status} · 进度 {progress.completed}/{progress.total}
      </p>

      {isCompleted && (
        <FeishuSyncPanel
          columns={NOTE_COLUMNS}
          records={records}
          extraActions={
            <Button onClick={() => exportCsv(NOTE_COLUMNS, records, "小红书笔记")}>
              导出 CSV
            </Button>
          }
        />
      )}

      {records.length > 0 && (
        <BatchRecordsTable columns={NOTE_COLUMNS} records={records} />
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

const readOnlyInputStyle: React.CSSProperties = {
  background: "#f9fafb",
  cursor: "default",
  resize: "none"
}

const primaryBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 6,
  border: "none",
  background: "#ff2442",
  color: "#fff",
  cursor: "pointer"
}
