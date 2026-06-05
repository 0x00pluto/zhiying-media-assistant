import { Button, Form, Input, InputNumber, Switch, Typography } from "antd"
import { useEffect, useMemo, useState } from "react"

import { FeishuFieldPicker } from "~features/feishu/feishu-field-picker"
import type { FieldOptions } from "~features/feishu/sync-records"
import { COMMENT_COLUMNS } from "~features/xiaohongshu/columns/comment"
import { FeishuSyncPanel } from "~sidepanel/components/feishu-sync-panel"
import { getCurrentTask, runTask } from "~sidepanel/store/task"
import { copyToClipboard, exportCsv } from "~sidepanel/utils/export"
import {
  loadExportFieldOptions,
  saveExportFieldOptions
} from "~shared/export-prefs"
import { TaskStatus } from "~shared/task-runner"

const EXPORT_FIELD_STORAGE_KEY = "xiaohongshu:comment:customColumns"

type Props = {
  initialState?: Record<string, unknown>
}

export function BatchCommentPage({ initialState }: Props) {
  const [taskName, setTaskName] = useState(
    (initialState?.name as string) || "评论批量采集"
  )
  const [links, setLinks] = useState(
    ((initialState?.urls as string[]) || []).join("\n")
  )
  const [limitPerId, setLimitPerId] = useState(
    Number(initialState?.limitPerId) || 100
  )
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
  const [error, setError] = useState("")

  const linkCount = useMemo(
    () => links.split("\n").map((item) => item.trim()).filter(Boolean).length,
    [links]
  )

  const commentCountHint = Number(initialState?.limitPerId) || 0
  const showCommentCountHint =
    linkCount === 1 &&
    commentCountHint > 0 &&
    ((initialState?.urls as string[]) || []).length === 1

  useEffect(() => {
    if (initialState?.name) setTaskName(initialState.name as string)
    if (initialState?.urls) {
      setLinks((initialState.urls as string[]).join("\n"))
    }
    if (initialState?.limitPerId !== undefined) {
      setLimitPerId(Number(initialState.limitPerId) || 100)
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
    setError("")
    setRunning(true)

    const condition = {
      name: taskName.trim() || "评论批量采集",
      collectBy: "links" as const,
      urls: links.split("\n").map((item) => item.trim()).filter(Boolean),
      limitPerId,
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
  const exportFilename = taskName.trim() || "小红书评论"

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>批量导出评论数据</h2>

      <Form layout="vertical" disabled={running}>
        <Form.Item label="任务名称">
          <Input
            value={taskName}
            onChange={(event) => setTaskName(event.target.value)}
            placeholder="评论批量采集"
          />
        </Form.Item>

        <Form.Item
          label="笔记链接"
          extra={
            <Typography.Text type="secondary">
              共输入了 {linkCount} 个链接
            </Typography.Text>
          }>
          <Input.TextArea
            value={links}
            onChange={(event) => setLinks(event.target.value)}
            rows={6}
            placeholder="每行一条笔记链接"
          />
        </Form.Item>

        <Form.Item
          label="导出数量"
          extra={
            showCommentCountHint ? (
              <Typography.Text type="secondary">
                当前笔记共有 {commentCountHint} 条评论
              </Typography.Text>
            ) : (
              <Typography.Text type="secondary">
                每篇笔记最多导出的评论条数（含子评论）
              </Typography.Text>
            )
          }>
          <InputNumber
            min={1}
            style={{ width: "100%" }}
            value={limitPerId}
            onChange={(value) => setLimitPerId(Number(value) || 100)}
          />
        </Form.Item>

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
        <Button type="primary" onClick={startTask} loading={running}>
          {running ? "采集中..." : "开始采集"}
        </Button>
        <Button
          disabled={!records.length}
          onClick={() =>
            exportCsv(COMMENT_COLUMNS, records, exportFilename, fieldOptions)
          }>
          导出 CSV
        </Button>
        <Button
          disabled={!records.length}
          onClick={() =>
            copyToClipboard(COMMENT_COLUMNS, records, fieldOptions)
          }>
          复制
        </Button>
      </div>

      {error ? (
        <Typography.Text type="danger">{error}</Typography.Text>
      ) : null}

      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        状态: {status} · 进度 {progress.completed}/{progress.total}
      </Typography.Paragraph>

      {records.length > 0 ? (
        <FeishuSyncPanel
          columns={COMMENT_COLUMNS}
          records={records}
          fieldOptions={fieldOptions}
          storageKey="qmc-quickSyncFeishu-comment"
          skipDialogKey="qmc-skipFeishuDialog-comment"
        />
      ) : null}
    </div>
  )
}
