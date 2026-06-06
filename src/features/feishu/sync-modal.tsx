import {
  AutoComplete,
  Checkbox,
  Form,
  Input,
  Modal,
  Radio,
  Spin,
  Switch,
  message
} from "antd"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { ColumnDef } from "~shared/columns/types"
import { openExtensionOptions } from "~shared/messaging"

import { resolveBitableRef, resolveBitableTargetDisplay } from "./bitable"
import { FeishuFieldPicker } from "./feishu-field-picker"
import { getFeishuModalProps } from "./modal-utils"
import {
  type FeishuBitableTarget,
  formatBitableTargetLabel,
  getTargetUrl,
  loadFeishuQuickSync,
  loadFeishuTargetHistories,
  mergeFieldOptions,
  saveFeishuQuickSync,
  saveFeishuTargetHistory,
  saveFeishuUrl
} from "./sync-prefs"
import { syncRecordsToFeishu, type FieldOptions } from "./sync-records"

export type FeishuSyncModalProps = {
  open: boolean
  onClose: () => void
  columns: ColumnDef[]
  records: Record<string, unknown>[]
  recordsLoading?: boolean
  storageKey?: string
  skipDialogKey?: string
  defaultFieldOptions?: FieldOptions
}

type FormValues = {
  url: string
  mode: "merge" | "append"
  shouldUploadMedia: boolean
  fieldOptions: FieldOptions
  remark?: string
}

type TargetDisplayStatus = "empty" | "resolving" | "ready" | "error"

export function shouldSkipFeishuDialog(skipDialogKey?: string) {
  if (!skipDialogKey) return false
  return sessionStorage.getItem(skipDialogKey) === "1"
}

export function setSkipFeishuDialog(skipDialogKey: string, skip: boolean) {
  if (skip) sessionStorage.setItem(skipDialogKey, "1")
  else sessionStorage.removeItem(skipDialogKey)
}

function historyOptionLabel(item: FeishuBitableTarget) {
  if (item.appName && item.tableName) {
    return formatBitableTargetLabel(item)
  }
  return item.url
}

function truncateUrlHint(url: string, max = 24) {
  try {
    const parsed = new URL(url)
    const hint = parsed.pathname.split("/").filter(Boolean).slice(-2).join("/")
    if (hint.length <= max) return hint
    return `${hint.slice(0, max)}…`
  } catch {
    return url.length > max ? `${url.slice(0, max)}…` : url
  }
}

function mergeHistoriesWithSavedTarget(
  history: FeishuBitableTarget[],
  savedTarget?: FeishuBitableTarget
) {
  if (!savedTarget?.url) return history
  if (history.some((item) => item.url === savedTarget.url)) return history
  return [savedTarget, ...history]
}

function buildUrlOptions(histories: FeishuBitableTarget[]) {
  const labels = histories.map(historyOptionLabel)
  const labelCounts = new Map<string, number>()
  for (const label of labels) {
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1)
  }

  return histories.map((item) => {
    const baseLabel = historyOptionLabel(item)
    const label =
      (labelCounts.get(baseLabel) ?? 0) > 1
        ? `${baseLabel}（${truncateUrlHint(item.url)}）`
        : baseLabel
    return { value: item.url, label }
  })
}

export function FeishuSyncModal({
  open,
  onClose,
  columns,
  records,
  recordsLoading = false,
  storageKey = "qmc-feishu-target:default",
  skipDialogKey,
  defaultFieldOptions
}: FeishuSyncModalProps) {
  const [form] = Form.useForm<FormValues>()
  const [loading, setLoading] = useState(false)
  const [histories, setHistories] = useState<FeishuBitableTarget[]>([])
  const [prefsReady, setPrefsReady] = useState(false)
  const [displayStatus, setDisplayStatus] =
    useState<TargetDisplayStatus>("empty")
  const [displayLabel, setDisplayLabel] = useState("")
  const [urlDropdownOpen, setUrlDropdownOpen] = useState(false)
  const resolveRequestId = useRef(0)
  const lastResolvedUrl = useRef("")

  const resolveTargetDisplay = useCallback(
    async (url: string, cachedTarget?: FeishuBitableTarget) => {
      const trimmed = url.trim()
      if (!trimmed) {
        setDisplayStatus("empty")
        setDisplayLabel("")
        lastResolvedUrl.current = ""
        return
      }

      const hasCachedLabel = Boolean(
        cachedTarget?.appName && cachedTarget?.tableName
      )
      if (hasCachedLabel && cachedTarget) {
        setDisplayStatus("ready")
        setDisplayLabel(formatBitableTargetLabel(cachedTarget))
      } else {
        setDisplayStatus("resolving")
        setDisplayLabel("正在识别表格…")
      }

      const requestId = ++resolveRequestId.current
      try {
        const resolved = await resolveBitableTargetDisplay(trimmed)
        if (requestId !== resolveRequestId.current) return

        lastResolvedUrl.current = trimmed
        setDisplayStatus("ready")
        setDisplayLabel(`${resolved.appName} · ${resolved.tableName}`)
      } catch (error) {
        if (requestId !== resolveRequestId.current) return
        lastResolvedUrl.current = trimmed
        setDisplayStatus("error")
        setDisplayLabel((error as Error).message)
      }
    },
    []
  )

  useEffect(() => {
    if (!open) {
      setPrefsReady(false)
      setDisplayStatus("empty")
      setDisplayLabel("")
      setUrlDropdownOpen(false)
      lastResolvedUrl.current = ""
      resolveRequestId.current += 1
      return
    }

    let cancelled = false

    void (async () => {
      const saved = await loadFeishuQuickSync(storageKey)
      const history = mergeHistoriesWithSavedTarget(
        await loadFeishuTargetHistories(storageKey),
        saved?.target
      )
      if (cancelled) return

      const url = getTargetUrl(saved) || history[0]?.url || ""
      form.setFieldsValue({
        url,
        mode: saved?.mode || "merge",
        shouldUploadMedia: saved?.shouldUploadMedia ?? true,
        fieldOptions: mergeFieldOptions(
          columns,
          saved?.fieldOptions ?? defaultFieldOptions
        ),
        remark: saved?.remark || ""
      })
      setHistories(history)
      setPrefsReady(true)

      if (url) {
        await resolveTargetDisplay(url, saved?.target)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    open,
    columns,
    defaultFieldOptions,
    form,
    resolveTargetDisplay,
    storageKey
  ])

  const handleUrlBlur = async () => {
    const url = form.getFieldValue("url")?.trim() || ""
    if (!url) {
      setDisplayStatus("empty")
      setDisplayLabel("")
      lastResolvedUrl.current = ""
      return
    }
    if (url === lastResolvedUrl.current && displayStatus === "ready") {
      return
    }
    await resolveTargetDisplay(url)
  }

  const handleHistorySelect = async (url: string) => {
    form.setFieldValue("url", url)
    const cached = histories.find((item) => item.url === url)
    await resolveTargetDisplay(url, cached)
  }

  const handleSync = async (values: FormValues) => {
    if (recordsLoading) {
      message.warning("正在读取笔记，请稍候")
      return false
    }

    if (!records.length) {
      message.warning("没有可同步的数据")
      return false
    }

    const url = values.url.trim()
    await saveFeishuUrl(storageKey, url)

    setLoading(true)
    try {
      const ref = await resolveBitableRef(url)
      const result = await syncRecordsToFeishu(
        { appToken: ref.appToken, tableId: ref.tableId },
        records,
        columns,
        {
          appToken: ref.appToken,
          tableId: ref.tableId,
          mode: values.mode,
          shouldUploadMedia: values.shouldUploadMedia,
          fieldOptions: values.fieldOptions,
          remark: values.remark?.trim() || undefined
        }
      )

      const savedUrl = ref.normalizedUrl || url
      const display = await resolveBitableTargetDisplay(savedUrl)
      const target: FeishuBitableTarget = {
        url: savedUrl,
        appName: display.appName,
        tableName: display.tableName,
        resolvedAt: Date.now()
      }

      await saveFeishuQuickSync(storageKey, {
        target,
        mode: values.mode,
        shouldUploadMedia: values.shouldUploadMedia,
        fieldOptions: values.fieldOptions,
        remark: values.remark
      })
      await saveFeishuTargetHistory(storageKey, target)
      setHistories(await loadFeishuTargetHistories(storageKey))
      form.setFieldValue("url", savedUrl)
      lastResolvedUrl.current = savedUrl
      setDisplayStatus("ready")
      setDisplayLabel(formatBitableTargetLabel(target))

      const parts = []
      if (result.created) parts.push(`新增 ${result.created} 条`)
      if (result.updated) parts.push(`更新 ${result.updated} 条`)
      message.success(parts.length ? `同步成功，${parts.join("，")}` : "同步完成")
      return true
    } catch (error) {
      message.error((error as Error).message)
      return false
    } finally {
      setLoading(false)
    }
  }

  const submit = async () => {
    const values = await form.validateFields()
    const ok = await handleSync(values)
    if (ok) onClose()
  }

  const uniqueColumnName = columns[0]?.name || "主键"
  const spinTip = loading
    ? "正在同步中..."
    : !prefsReady
      ? "加载中..."
      : undefined
  const formBusy = loading || !prefsReady

  const urlOptions = useMemo(() => buildUrlOptions(histories), [histories])

  const subtitleStyle: React.CSSProperties = {
    margin: "4px 0 0 25%",
    fontSize: 12,
    lineHeight: "18px"
  }

  return (
    <Modal
      title={
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            一键同步数据到飞书多维表格
          </div>
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 400, color: "#666" }}>
            如需修改上传素材的文件限制可
            <a
              href="#"
              style={{ color: "#1677ff" }}
              onClick={(event) => {
                event.preventDefault()
                void openExtensionOptions("sync-feishu")
              }}>
              前往设置页面
            </a>
            进行修改。
          </div>
        </div>
      }
      open={open}
      width={480}
      onCancel={onClose}
      onOk={submit}
      okText="确定"
      cancelText="取消"
      confirmLoading={loading}
      okButtonProps={{ disabled: recordsLoading || !records.length }}
      {...getFeishuModalProps()}
      footer={(_, { OkBtn, CancelBtn }) => (
        <>
          {skipDialogKey ? (
            <Checkbox
              style={{ float: "left", marginTop: 6 }}
              onChange={(event) =>
                setSkipFeishuDialog(skipDialogKey, event.target.checked)
              }>
              本次会话不再弹框
            </Checkbox>
          ) : null}
          <CancelBtn />
          <OkBtn />
        </>
      )}>
      <Spin spinning={formBusy} tip={spinTip}>
        <Form form={form} layout="horizontal" labelCol={{ span: 6 }} style={{ marginTop: 16 }}>
          {recordsLoading ? (
            <div
              style={{
                marginBottom: 12,
                padding: "8px 12px",
                fontSize: 12,
                color: "#1677ff",
                background: "#e6f4ff",
                borderRadius: 6
              }}>
              正在读取笔记…
            </div>
          ) : null}
          <Form.Item
            label="表格链接"
            required
            style={{ marginBottom: displayStatus === "empty" ? 8 : 0 }}>
            <Form.Item
              name="url"
              noStyle
              rules={[{ required: true, message: "请填写飞书多维表格链接" }]}>
              <AutoComplete
                style={{ width: "100%" }}
                options={urlOptions}
                open={histories.length > 0 ? urlDropdownOpen : false}
                placeholder="https://xxx.feishu.cn/base/... 或 /wiki/...?table=..."
                filterOption={false}
                onOpenChange={setUrlDropdownOpen}
                onFocus={() => {
                  if (histories.length) setUrlDropdownOpen(true)
                }}
                onBlur={() => {
                  setUrlDropdownOpen(false)
                  void handleUrlBlur()
                }}
                onSelect={(value) => {
                  setUrlDropdownOpen(false)
                  void handleHistorySelect(String(value))
                }}
              />
            </Form.Item>
          </Form.Item>
          {displayStatus !== "empty" ? (
            <div
              style={{
                ...subtitleStyle,
                color:
                  displayStatus === "error"
                    ? "#ff4d4f"
                    : displayStatus === "resolving"
                      ? "#999"
                      : "#666",
                marginBottom: 8
              }}>
              {displayStatus === "error"
                ? "无法识别该链接，请检查格式或飞书配置"
                : displayLabel}
            </div>
          ) : null}
          <div
            style={{
              margin: "-8px 0 16px 25%",
              padding: "8px 12px",
              fontSize: 12,
              color: "#1677ff",
              background: "#e6f4ff",
              borderRadius: 6
            }}>
            支持飞书多维表格直链（/base/）或知识库 Wiki 链接（/wiki/），需带 table 参数
          </div>

          <Form.Item
            label="同步模式"
            name="mode"
            rules={[{ required: true, message: "同步模式不能为空" }]}>
            <Radio.Group buttonStyle="solid" style={{ width: "100%" }}>
              <Radio.Button value="merge" style={{ width: "50%", textAlign: "center" }}>
                合并
              </Radio.Button>
              <Radio.Button value="append" style={{ width: "50%", textAlign: "center" }}>
                追加
              </Radio.Button>
            </Radio.Group>
          </Form.Item>
          <div style={{ margin: "-8px 0 16px 25%", fontSize: 12, color: "#999" }}>
            合并模式会根据表格中已有的数据进行合并，若存在{uniqueColumnName}相同的行会更新，不存在则新增
          </div>

          <Form.Item
            label="上传素材"
            name="shouldUploadMedia"
            valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="自定义同步字段" name="fieldOptions">
            <FeishuFieldPicker columns={columns} />
          </Form.Item>

          <Form.Item label="备注" name="remark">
            <Input placeholder="本次同步的备注信息，可为空" allowClear />
          </Form.Item>
        </Form>
      </Spin>
    </Modal>
  )
}
