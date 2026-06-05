import {
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Radio,
  Spin,
  Switch,
  message
} from "antd"
import { useEffect, useState } from "react"

import type { ColumnDef } from "~shared/columns/types"
import { createTab, openExtensionOptions } from "~shared/messaging"

import { resolveBitableRef } from "./bitable"
import { FeishuFieldPicker } from "./feishu-field-picker"
import { getFeishuModalProps } from "./modal-utils"
import {
  loadFeishuQuickSync,
  loadFeishuUrlHistories,
  mergeFieldOptions,
  saveFeishuQuickSync,
  saveFeishuUrl,
  saveFeishuUrlHistory
} from "./sync-prefs"
import { syncRecordsToFeishu, type FieldOptions } from "./sync-records"

export type FeishuSyncModalProps = {
  open: boolean
  onClose: () => void
  columns: ColumnDef[]
  records: Record<string, unknown>[]
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

export function shouldSkipFeishuDialog(skipDialogKey?: string) {
  if (!skipDialogKey) return false
  return sessionStorage.getItem(skipDialogKey) === "1"
}

export function setSkipFeishuDialog(skipDialogKey: string, skip: boolean) {
  if (skip) sessionStorage.setItem(skipDialogKey, "1")
  else sessionStorage.removeItem(skipDialogKey)
}

export function FeishuSyncModal({
  open,
  onClose,
  columns,
  records,
  storageKey = "qmc-quickSyncFeishu-default",
  skipDialogKey,
  defaultFieldOptions
}: FeishuSyncModalProps) {
  const [form] = Form.useForm<FormValues>()
  const [loading, setLoading] = useState(false)
  const [histories, setHistories] = useState<string[]>([])
  const [prefsReady, setPrefsReady] = useState(false)

  useEffect(() => {
    if (!open) {
      setPrefsReady(false)
      return
    }

    let cancelled = false

    void (async () => {
      const saved = await loadFeishuQuickSync(storageKey)
      const history = await loadFeishuUrlHistories(storageKey)
      if (cancelled) return

      form.setFieldsValue({
        url: saved?.url || history[0] || "",
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
    })()

    return () => {
      cancelled = true
    }
  }, [open, columns, defaultFieldOptions, form, storageKey])

  const handleSync = async (values: FormValues) => {
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
      await saveFeishuQuickSync(storageKey, {
        url: savedUrl,
        mode: values.mode,
        shouldUploadMedia: values.shouldUploadMedia,
        fieldOptions: values.fieldOptions,
        remark: values.remark
      })
      await saveFeishuUrlHistory(storageKey, savedUrl)
      setHistories(await loadFeishuUrlHistories(storageKey))
      form.setFieldValue("url", savedUrl)

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
      <Spin spinning={loading || !prefsReady} tip="正在同步中...">
        <Form form={form} layout="horizontal" labelCol={{ span: 6 }} style={{ marginTop: 16 }}>
          <Form.Item
            label="表格链接"
            required
            style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Form.Item
                name="url"
                noStyle
                rules={[{ required: true, message: "请填写飞书多维表格链接" }]}>
                <Input
                  placeholder="https://xxx.feishu.cn/base/... 或 /wiki/...?table=..."
                  list="qmc-feishu-url-history"
                />
              </Form.Item>
              <Button
                type="primary"
                onClick={() => {
                  void createTab({ url: "https://www.feishu.cn/base" })
                }}>
                + 新建
              </Button>
            </div>
          </Form.Item>
          <datalist id="qmc-feishu-url-history">
            {histories.map((url) => (
              <option key={url} value={url} />
            ))}
          </datalist>
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
