import { message } from "antd"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  FeishuSyncModal,
  shouldSkipFeishuDialog
} from "~features/feishu/sync-modal"
import { resolveBitableRef } from "~features/feishu/bitable"
import {
  FEISHU_TARGET_KEYS,
  formatBitableTargetLabel,
  getTargetUrl,
  loadFeishuQuickSync,
  mergeFieldOptions
} from "~features/feishu/sync-prefs"
import { syncRecordsToFeishu } from "~features/feishu/sync-records"
import {
  collectSingleNote,
  copyNoteInfo,
  detectNoteMediaType,
  resolveCommentExportContext,
  resolveNoteId
} from "~features/xiaohongshu/collectors/single-note"
import { NOTE_COLUMNS } from "~features/xiaohongshu/columns/note"
import { extractNoteMediaFiles } from "~features/xiaohongshu/media/extract"
import { downloadConfigStorage } from "~features/xiaohongshu/storage/download-config"
import { qmcCsuiButtonStyle } from "~features/xiaohongshu/ui/csui-theme"
import { downloadFile, navigateSidepanel } from "~shared/messaging"

const FEISHU_STORAGE_KEY = FEISHU_TARGET_KEYS.noteDetail
const FEISHU_SKIP_DIALOG_KEY = "qmc-skipFeishuDialog:note-detail"

type CollectedNote = Awaited<ReturnType<typeof collectSingleNote>>

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
  const noteCollectCacheRef = useRef<CollectedNote | null>(null)
  const collectPromiseRef = useRef<Promise<CollectedNote> | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [copying, setCopying] = useState(false)
  const [feishuOpen, setFeishuOpen] = useState(false)
  const [feishuSyncing, setFeishuSyncing] = useState(false)
  const [feishuRecordsLoading, setFeishuRecordsLoading] = useState(false)
  const [feishuRecords, setFeishuRecords] = useState<Record<string, unknown>[]>(
    []
  )
  const [exportingComments, setExportingComments] = useState(false)

  const ensureNoteCollected = () => {
    if (noteCollectCacheRef.current) {
      return Promise.resolve(noteCollectCacheRef.current)
    }
    if (collectPromiseRef.current) {
      return collectPromiseRef.current
    }

    collectPromiseRef.current = collectSingleNote(noteId)
      .then((result) => {
        noteCollectCacheRef.current = result
        collectPromiseRef.current = null
        return result
      })
      .catch((error) => {
        collectPromiseRef.current = null
        throw error
      })

    return collectPromiseRef.current
  }

  useEffect(() => {
    if (!noteId) return

    noteCollectCacheRef.current = null
    collectPromiseRef.current = null
    void ensureNoteCollected()

    return () => {
      noteCollectCacheRef.current = null
      collectPromiseRef.current = null
    }
  }, [noteId])

  const downloadLabel = mediaType === "video" ? "下载视频" : "下载图片"

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const { rawNote, record } = await ensureNoteCollected()
      const files = extractNoteMediaFiles(rawNote, noteId, {
        videoOnly: mediaType === "video"
      })
      if (!files.length) {
        if (mediaType === "video") {
          message.error("未找到视频地址，请刷新页面后重试")
        } else {
          message.warning("未找到可下载的媒体文件")
        }
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
      const { record } = await ensureNoteCollected()
      await copyNoteInfo(noteId, record)
      message.success("笔记信息已复制到剪贴板")
    } catch (error) {
      message.error((error as Error).message)
    } finally {
      setCopying(false)
    }
  }

  const runQuickFeishuSync = async () => {
    setFeishuSyncing(true)
    const hide = message.loading("正在同步飞书，请稍候...", 0)
    try {
      const { record } = await ensureNoteCollected()
      const records = [record]
      const saved = await loadFeishuQuickSync(FEISHU_STORAGE_KEY)
      const targetUrl = getTargetUrl(saved)
      if (!targetUrl) {
        setFeishuRecords(records)
        setFeishuOpen(true)
        return
      }

      const ref = await resolveBitableRef(targetUrl)
      const result = await syncRecordsToFeishu(
        { appToken: ref.appToken, tableId: ref.tableId },
        records,
        NOTE_COLUMNS,
        {
          appToken: ref.appToken,
          tableId: ref.tableId,
          mode: saved?.mode || "merge",
          shouldUploadMedia: saved?.shouldUploadMedia ?? true,
          fieldOptions: mergeFieldOptions(NOTE_COLUMNS, saved?.fieldOptions),
          remark: saved?.remark
        }
      )

      const parts = []
      if (result.created) parts.push(`新增 ${result.created} 条`)
      if (result.updated) parts.push(`更新 ${result.updated} 条`)
      message.success(
        parts.length ? `同步成功，${parts.join("，")}` : "同步完成"
      )
    } catch (error) {
      const saved = await loadFeishuQuickSync(FEISHU_STORAGE_KEY)
      const targetUrl = getTargetUrl(saved)
      const label = saved?.target
        ? formatBitableTargetLabel(saved.target)
        : targetUrl
      const errMsg = (error as Error).message
      message.error(label ? `同步到「${label}」失败：${errMsg}` : errMsg)
    } finally {
      hide()
      setFeishuSyncing(false)
    }
  }

  const handleFeishu = async () => {
    if (shouldSkipFeishuDialog(FEISHU_SKIP_DIALOG_KEY)) {
      await runQuickFeishuSync()
      return
    }

    if (noteCollectCacheRef.current) {
      setFeishuRecords([noteCollectCacheRef.current.record])
      setFeishuOpen(true)
      return
    }

    setFeishuOpen(true)
    setFeishuRecords([])
    setFeishuRecordsLoading(true)

    try {
      const { record } = await ensureNoteCollected()
      setFeishuRecords([record])
    } catch (error) {
      message.error((error as Error).message)
      setFeishuOpen(false)
    } finally {
      setFeishuRecordsLoading(false)
    }
  }

  const handleExportComments = async () => {
    setExportingComments(true)
    try {
      const { noteUrl, title, commentCount } = resolveCommentExportContext(noteId)

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
    } finally {
      setExportingComments(false)
    }
  }

  return (
    <>
      {!feishuOpen ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            padding: "16px 16px 0",
            width: "100%",
            boxSizing: "border-box"
          }}>
          <button
            type="button"
            className="qmc-csui-btn"
            disabled={downloading}
            onClick={handleDownload}
            style={{
              ...qmcCsuiButtonStyle,
              cursor: downloading ? "wait" : "pointer"
            }}>
            {downloading ? "下载中..." : downloadLabel}
          </button>
          <button
            type="button"
            className="qmc-csui-btn"
            disabled={copying}
            onClick={handleCopy}
            style={{
              ...qmcCsuiButtonStyle,
              cursor: copying ? "wait" : "pointer"
            }}>
            {copying ? "复制中..." : "复制笔记信息"}
          </button>
          <button
            type="button"
            className="qmc-csui-btn"
            disabled={feishuSyncing}
            onClick={handleFeishu}
            style={{
              ...qmcCsuiButtonStyle,
              cursor: feishuSyncing ? "wait" : "pointer"
            }}>
            {feishuSyncing ? "同步中..." : "同步飞书"}
          </button>
          <button
            type="button"
            className="qmc-csui-btn"
            disabled={exportingComments}
            onClick={handleExportComments}
            style={{
              ...qmcCsuiButtonStyle,
              cursor: exportingComments ? "wait" : "pointer"
            }}>
            {exportingComments ? "跳转中..." : "导出评论"}
          </button>
        </div>
      ) : null}

      <FeishuSyncModal
        open={feishuOpen}
        onClose={() => setFeishuOpen(false)}
        columns={NOTE_COLUMNS}
        records={feishuRecords}
        recordsLoading={feishuRecordsLoading}
        storageKey={FEISHU_STORAGE_KEY}
        skipDialogKey={FEISHU_SKIP_DIALOG_KEY}
      />
    </>
  )
}
