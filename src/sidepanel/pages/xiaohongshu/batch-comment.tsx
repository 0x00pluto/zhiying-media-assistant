import { Button, Form, Input, InputNumber, Switch, Typography } from "antd"
import { useEffect, useMemo, useState } from "react"

import { FeishuFieldPicker } from "~features/feishu/feishu-field-picker"
import { FEISHU_TARGET_KEYS } from "~features/feishu/sync-prefs"
import type { FieldOptions } from "~features/feishu/sync-records"
import { COMMENT_COLUMNS } from "~features/xiaohongshu/columns/comment"
import { CommentCollector } from "~features/xiaohongshu/tasks/comment"
import { FeishuSyncPanel } from "~sidepanel/components/feishu-sync-panel"
import { BatchRecordsTable } from "~sidepanel/components/batch-records-table"
import { getCurrentTask, runTask } from "~sidepanel/store/task"
import { exportCsv } from "~sidepanel/utils/export"
import {
  loadExportFieldOptions,
  saveExportFieldOptions
} from "~shared/export-prefs"
import { TaskStatus } from "~shared/task-runner"

const EXPORT_FIELD_STORAGE_KEY = "xiaohongshu:comment:customColumns"

type Props = {
  initialState?: Record<string, unknown>
}

function parseLinkLines(text: string) {
  return text
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
}

function resolveInitialLimitPerId(initialState?: Record<string, unknown>) {
  const count = Number(initialState?.limitPerId)
  if (count > 0) return count
  return 100
}

export function BatchCommentPage({ initialState }: Props) {
  const [taskName, setTaskName] = useState(
    (initialState?.name as string) || "评论批量采集"
  )
  const [links, setLinks] = useState(
    ((initialState?.urls as string[]) || []).join("\n")
  )
  const [limitPerId, setLimitPerId] = useState(resolveInitialLimitPerId(initialState))
  const [includeSub, setIncludeSub] = useState(
    initialState?.includeSub !== undefined ? Boolean(initialState.includeSub) : true
  )
  const [fieldOptions, setFieldOptions] = useState<FieldOptions>({
    keys: [],
    skipEmpty: true
  })
  const [fieldOptionsReady, setFieldOptionsReady] = useState(false)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState(TaskStatus.INITIAL)
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [records, setRecords] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState("")
  const [partialWarning, setPartialWarning] = useState("")

  const urls = useMemo(() => parseLinkLines(links), [links])
  const linkCount = urls.length
  const maxCommentCount =
    urls.length === 1 ? Number(initialState?.limitPerId) || 0 : 0
  const limitInvalid =
    maxCommentCount > 0 && (limitPerId < 1 || limitPerId > maxCommentCount)
  const canStart =
    !running &&
    urls.length > 0 &&
    maxCommentCount > 0 &&
    limitPerId >= 1 &&
    limitPerId <= maxCommentCount

  useEffect(() => {
    if (initialState?.name) setTaskName(initialState.name as string)
    if (initialState?.urls) {
      setLinks((initialState.urls as string[]).join("\n"))
    }
    if (initialState?.limitPerId !== undefined) {
      setLimitPerId(resolveInitialLimitPerId(initialState))
    }
    if (initialState?.includeSub !== undefined) {
      setIncludeSub(Boolean(initialState.includeSub))
    }
  }, [initialState])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const saved = await loadExportFieldOptions(
        EXPORT_FIELD_STORAGE_KEY,
        COMMENT_COLUMNS
      )
      if (!cancelled) {
        setFieldOptions(saved)
        setFieldOptionsReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const handleFieldOptionsChange = (next: FieldOptions) => {
    setFieldOptions(next)
    void saveExportFieldOptions(EXPORT_FIELD_STORAGE_KEY, next)
  }

  const startTask = async () => {
    if (urls.length === 0) {
      setError("暂无可用链接，请在小红书笔记页点击「导出评论」导入")
      return
    }

    if (maxCommentCount > 0 && limitPerId > maxCommentCount) {
      setError(`导出数量不能超过评论总数（当前 ${maxCommentCount} 条）`)
      return
    }

    if (limitPerId < 1) {
      setError("导出数量至少为 1 条")
      return
    }

    setError("")
    setPartialWarning("")
    setRecords([])
    setRunning(true)

    const effectiveLimit = Math.min(
      Math.max(limitPerId, 1),
      maxCommentCount || limitPerId
    )

    const condition = {
      name: taskName.trim() || "评论批量采集",
      collectBy: "links" as const,
      urls,
      limitPerId: effectiveLimit,
      includeSub,
      fieldOptions
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
      if (task instanceof CommentCollector && task.partialStopReason) {
        setPartialWarning(
          `已采集 ${task.records.length} 条，未达目标数量：${task.partialStopReason}`
        )
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  const exportFilename = taskName.trim() || "小红书评论"
  const isCompleted =
    status === TaskStatus.COMPLETED && records.length > 0 && !running

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>批量导出评论数据</h2>

      <Form layout="vertical" disabled={running}>
        <Form.Item
          label="任务名称（由笔记页「导出评论」自动填入，不可手动修改）">
          <Input
            value={taskName}
            readOnly
            placeholder="评论批量采集"
            style={readOnlyInputStyle}
          />
        </Form.Item>

        <Form.Item
          label="笔记链接（不可手动修改）"
          extra={
            <Typography.Text type="secondary">
              共 {linkCount} 个链接
            </Typography.Text>
          }>
          <Input.TextArea
            value={links}
            readOnly
            rows={6}
            placeholder="请在小红书笔记页点击「导出评论」导入链接"
            style={readOnlyInputStyle}
          />
        </Form.Item>

        <Form.Item
          label={`导出数量（不超过评论总数 ${maxCommentCount || 0} 条）`}
          extra={
            maxCommentCount > 0 ? (
              <Typography.Text type="secondary">
                当前笔记共有 {maxCommentCount} 条评论
              </Typography.Text>
            ) : (
              <Typography.Text type="secondary">
                每篇笔记最多导出的评论条数（含子评论）
              </Typography.Text>
            )
          }>
          <InputNumber
            min={1}
            max={maxCommentCount || undefined}
            style={{ width: "100%" }}
            value={limitPerId}
            disabled={maxCommentCount === 0}
            onChange={(value) => {
              setLimitPerId(Number(value))
              setError("")
            }}
          />
        </Form.Item>

        {linkCount === 0 && (
          <Typography.Paragraph type="secondary" style={{ marginTop: -8 }}>
            暂无链接。请打开小红书笔记页，点击「导出评论」后再开始采集。
          </Typography.Paragraph>
        )}

        {limitInvalid && (
          <Typography.Paragraph type="danger" style={{ marginTop: -8 }}>
            导出数量不能超过评论总数（当前 {maxCommentCount} 条）
          </Typography.Paragraph>
        )}

        <Form.Item label="采集子评论" valuePropName="checked">
          <Switch checked={includeSub} onChange={setIncludeSub} />
        </Form.Item>

        <Form.Item label="自定义导出字段">
          {fieldOptionsReady ? (
            <FeishuFieldPicker
              columns={COMMENT_COLUMNS}
              value={fieldOptions}
              onChange={handleFieldOptionsChange}
            />
          ) : (
            <Typography.Text type="secondary">加载字段配置...</Typography.Text>
          )}
        </Form.Item>
      </Form>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <Button
          type="primary"
          onClick={startTask}
          loading={running}
          disabled={!canStart}>
          {running ? "采集中..." : "开始采集"}
        </Button>
      </div>

      {error ? (
        <Typography.Text type="danger">{error}</Typography.Text>
      ) : null}

      {partialWarning ? (
        <Typography.Paragraph type="warning" style={{ marginBottom: 12 }}>
          {partialWarning}
        </Typography.Paragraph>
      ) : null}

      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        状态: {status} · 进度 {progress.completed}/{progress.total}
      </Typography.Paragraph>

      {isCompleted && (
        <FeishuSyncPanel
          columns={COMMENT_COLUMNS}
          records={records}
          fieldOptions={fieldOptions}
          storageKey={FEISHU_TARGET_KEYS.batchComment}
          extraActions={
            <Button
              onClick={() =>
                exportCsv(COMMENT_COLUMNS, records, exportFilename, fieldOptions)
              }>
              导出 CSV
            </Button>
          }
        />
      )}

      <BatchRecordsTable columns={COMMENT_COLUMNS} records={records} />
    </div>
  )
}

const readOnlyInputStyle: React.CSSProperties = {
  background: "#f9fafb",
  cursor: "default",
  color: "#374151"
}
