import { CloseOutlined } from "@ant-design/icons"
import { Button, Modal, message } from "antd"
import { useEffect, useState } from "react"

import {
  bootstrapPageNotesFromFeeds,
  bootstrapPageNotesFromPosted,
  clearPageNotes,
  getCollectiblePageNotes,
  getCollectiblePageNotesCount,
  getPageNoteUrls,
  scanDomNoteLinks,
  subscribePageNotes
} from "~features/xiaohongshu/collectors/page-notes-cache"
import {
  NOTE_BATCH_COLLECT_DISABLED_HINT,
  useNoteBatchCollectEnabled
} from "~features/xiaohongshu/use-note-batch-enabled"
import { getFeishuModalProps } from "~features/feishu/modal-utils"
import { QMC_CSUI_PRIMARY } from "~features/xiaohongshu/ui/csui-theme"
import { getWindowValue, navigateSidepanel } from "~shared/messaging"

export type PageCollectType = "explore" | "search" | "profile"

const TASK_NAME: Record<PageCollectType, string> = {
  explore: "发现页的笔记数据",
  search: "搜索页的笔记数据",
  profile: "博主页的笔记数据"
}

type Props = {
  open: boolean
  pageType: PageCollectType
  onClose: () => void
}

async function refreshBootstrap(pageType: PageCollectType) {
  try {
    if (pageType === "explore") {
      const result = await getWindowValue({
        feeds: ["__INITIAL_STATE__", "feed", "feeds", "_rawValue"]
      })
      const feeds = (result.feeds as Array<Record<string, unknown>>) || []
      if (feeds.length) bootstrapPageNotesFromFeeds(feeds)
      scanDomNoteLinks()
      return
    }

    if (pageType === "search") {
      scanDomNoteLinks(".feeds-container", "pc_search")
      return
    }

    if (pageType === "profile") {
      const result = await getWindowValue({
        notes: ["__INITIAL_STATE__", "user", "notes", "_rawValue", 0]
      })
      const notes = (result.notes as Array<Record<string, unknown>>) || []
      if (notes.length) bootstrapPageNotesFromPosted(notes)
    }
  } catch {
    // ignore
  }
}

export function CollectPageNotesModal({ open, pageType, onClose }: Props) {
  const { enabled: noteBatchEnabled } = useNoteBatchCollectEnabled()
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return

    // 仅发现页需要清缓存（避免搜索页 pc_search 污染）；搜索页笔记靠 API 拦截累积，不能清空
    if (pageType === "explore") {
      clearPageNotes()
    }
    void refreshBootstrap(pageType)
    return subscribePageNotes(setCount)
  }, [open, pageType])

  const handleCopyLinks = async () => {
    const urls = getPageNoteUrls()
    if (!urls.length) {
      message.warning("数据为空，无法复制链接")
      return
    }

    try {
      await navigator.clipboard.writeText(urls.join("\n"))
      message.success("笔记链接已复制到剪贴板")
    } catch {
      message.error("复制失败，请检查浏览器剪贴板权限")
    }
  }

  const handleConfirm = async () => {
    if (!noteBatchEnabled) {
      message.warning(NOTE_BATCH_COLLECT_DISABLED_HINT)
      return
    }

    const pageNotes = getCollectiblePageNotes()
    const urls = pageNotes.map((note) => note.url)
    if (!urls.length) {
      message.warning("数据为空，无法采集")
      return
    }

    setLoading(true)
    try {
      await navigateSidepanel({
        to: "/xiaohongshu/batch-collect/note",
        options: {
          state: {
            name: TASK_NAME[pageType],
            pageCollectType: pageType,
            collectBy: "links",
            urls,
            limit: urls.length,
            pageNotes: pageNotes.map((note) => ({
              id: note.id,
              url: note.url,
              xsec_token: note.xsec_token,
              noteCard: note.noteCard,
              api: note.api
            }))
          }
        }
      })
      onClose()
    } catch (error) {
      message.error((error as Error).message || "跳转失败")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    onClose()
  }

  return (
    <Modal
      open={open}
      title="采集本页笔记"
      onCancel={handleClose}
      mask={{ closable: true }}
      closable={{ onClose: handleClose }}
      closeIcon={
        <button
          type="button"
          aria-label="关闭"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            handleClose()
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 4,
            pointerEvents: "auto"
          }}>
          <CloseOutlined />
        </button>
      }
      footer={[
        <Button key="copy" onClick={handleCopyLinks}>
          复制链接
        </Button>,
        <Button
          key="confirm"
          type="primary"
          loading={loading}
          disabled={!noteBatchEnabled}
          onClick={handleConfirm}>
          确认采集
        </Button>
      ]}
      {...getFeishuModalProps()}>
      {!noteBatchEnabled && (
        <p
          style={{
            margin: "0 0 12px",
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            fontSize: 13,
            lineHeight: 1.5
          }}>
          {NOTE_BATCH_COLLECT_DISABLED_HINT}
        </p>
      )}
      <p style={{ margin: "0 0 12px", color: "#6b7280", fontSize: 13 }}>
        手动滚动可继续检测本页笔记数据变化
      </p>
      <div
        style={{
          padding: 16,
          borderRadius: 12,
          border: "1px solid rgba(22, 119, 255, 0.2)",
          background:
            "linear-gradient(135deg, rgba(22, 119, 255, 0.08), rgba(22, 119, 255, 0.02))"
        }}>
        <p style={{ margin: 0, fontSize: 14, color: "#374151" }}>本页笔记检测</p>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6b7280" }}>
          检测到{" "}
          <strong style={{ fontSize: 28, color: QMC_CSUI_PRIMARY, lineHeight: 1 }}>
            {open ? count : getCollectiblePageNotesCount()}
          </strong>{" "}
          条笔记
        </p>
      </div>
    </Modal>
  )
}
