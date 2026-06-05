import { Button, message } from "antd"
import { useMemo, useState } from "react"

import {
  FeishuSyncModal,
  shouldSkipFeishuDialog
} from "~features/feishu/sync-modal"
import { resolveBitableRef } from "~features/feishu/bitable"
import {
  loadFeishuQuickSync,
  mergeFieldOptions
} from "~features/feishu/sync-prefs"
import { syncRecordsToFeishu } from "~features/feishu/sync-records"
import {
  collectSingleNote,
  copyNoteInfo,
  detectNoteMediaType,
  resolveNoteId
} from "~features/xiaohongshu/collectors/single-note"
import { NOTE_COLUMNS } from "~features/xiaohongshu/columns/note"
import { extractNoteMediaFiles } from "~features/xiaohongshu/media/extract"
import { downloadConfigStorage } from "~features/xiaohongshu/storage/download-config"
import { downloadFile, navigateSidepanel } from "~shared/messaging"

const FEISHU_STORAGE_KEY = "qmc-quickSyncFeishu-note"
const FEISHU_SKIP_DIALOG_KEY = "qmc-skipFeishuDialog-note"

function applyNamingTemplate(
  template: string,
  vars: Record<string, string | number | undefined>
) {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = vars[key]
    return value !== undefined && value !== null ? String(value) : ""
  })
}

type Props = {
  noteId?: string
}

export function NoteDetailToolbar({ noteId: propNoteId }: Props) {
  const noteId = resolveNoteId(propNoteId)
  const mediaType = useMemo(() => detectNoteMediaType(), [])
  const [downloading, setDownloading] = useState(false)
  const [copying, setCopying] = useState(false)
  const [feishuOpen, setFeishuOpen] = useState(false)
  const [feishuSyncing, setFeishuSyncing] = useState(false)
  const [feishuRecords, setFeishuRecords] = useState<Record<string, unknown>[]>(
    []
  )

  const downloadLabel = mediaType === "video" ? "下载视频" : "下载图片"

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const { rawNote, record } = await collectSingleNote(noteId)
      const files = extractNoteMediaFiles(rawNote, noteId)
      if (!files.length) {
        message.warning("未找到可下载的媒体文件")
        return
      }

      const config = await downloadConfigStorage.get()
      const nickname = String(record.nickname || "未知博主")
      const title = String(record.title || noteId)

      for (const file of files) {
        const path = applyNamingTemplate(config.namingTemplate, {
          博主昵称: nickname,
          笔记ID: noteId,
          发布时间: "",
          笔记标题: title
        })
        await downloadFile({
          url: file.url,
          filename: `${path}/${file.filename}`,
          conflictAction: config.conflictAction,
          saveAs: false
        })
      }

      message.success(`已开始下载 ${files.length} 个文件`)
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setDownloading(false)
    }
  }

  const handleCopy = async () => {
    setCopying(true)
    try {
      await copyNoteInfo(noteId)
      message.success("笔记信息已复制到剪贴板")
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setCopying(false)
    }
  }

  const handleFeishu = async () => {
    try {
      const { record } = await collectSingleNote(noteId)
      const records = [record]

      if (shouldSkipFeishuDialog(FEISHU_SKIP_DIALOG_KEY)) {
        const saved = await loadFeishuQuickSync(FEISHU_STORAGE_KEY)
        if (!saved?.url) {
          setFeishuRecords(records)
          setFeishuOpen(true)
          return
        }

        setFeishuSyncing(true)
        const hide = message.loading("正在同步飞书，请稍候...", 0)
        try {
          const ref = await resolveBitableRef(saved.url)
          const result = await syncRecordsToFeishu(
            { appToken: ref.appToken, tableId: ref.tableId },
            records,
            NOTE_COLUMNS,
            {
              appToken: ref.appToken,
              tableId: ref.tableId,
              mode: saved?.mode || "merge",
              shouldUploadMedia: saved?.shouldUploadMedia ?? true,
              fieldOptions: mergeFieldOptions(
                NOTE_COLUMNS,
                saved?.fieldOptions
              ),
              remark: saved?.remark
            }
          )

          const parts = []
          if (result.created) parts.push(`新增 ${result.created} 条`)
          if (result.updated) parts.push(`更新 ${result.updated} 条`)
          message.success(
            parts.length ? `同步成功，${parts.join("，")}` : "同步完成"
          )
        } finally {
          hide()
          setFeishuSyncing(false)
        }
        return
      }

      setFeishuRecords(records)
      setFeishuOpen(true)
    } catch (error) {
      message.error((error as Error).message)
    }
  }

  const handleExportComments = async () => {
    try {
      const { noteUrl, record, commentCount, rawNote } =
        await collectSingleNote(noteId)
      const title = String(record.title || rawNote.title || "笔记")

      await navigateSidepanel({
        to: "/xiaohongshu/batch-collect/comment",
        options: {
          state: {
            name: `笔记「${title}」的评论数据`,
            urls: [noteUrl],
            limitPerId: commentCount || 500,
            includeSub: true
          }
        }
      })
    } catch (error) {
      message.error((error as Error).message)
    }
  }

  return (
    <>
      {!feishuOpen ? (
        <div
          className="qmc-note-toolbar"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            padding: "16px 16px 0",
            width: "100%",
            boxSizing: "border-box"
          }}>
          <Button
            type="primary"
            className="qmc-toolbar-btn"
            loading={downloading}
            onClick={handleDownload}>
            {downloadLabel}
          </Button>
          <Button
            type="primary"
            className="qmc-toolbar-btn"
            loading={copying}
            onClick={handleCopy}>
            复制笔记信息
          </Button>
          <Button
            type="primary"
            className="qmc-toolbar-btn"
            loading={feishuSyncing}
            onClick={handleFeishu}>
            同步飞书
          </Button>
          <Button
            type="primary"
            className="qmc-toolbar-btn"
            onClick={handleExportComments}>
            导出评论
          </Button>
        </div>
      ) : null}

      <FeishuSyncModal
        open={feishuOpen}
        onClose={() => setFeishuOpen(false)}
        columns={NOTE_COLUMNS}
        records={feishuRecords}
        storageKey={FEISHU_STORAGE_KEY}
        skipDialogKey={FEISHU_SKIP_DIALOG_KEY}
      />
    </>
  )
}
