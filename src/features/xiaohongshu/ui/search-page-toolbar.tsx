import { useEffect, useState } from "react"

import {
  scanDomNoteLinks,
  subscribePageNotes
} from "~features/xiaohongshu/collectors/page-notes-cache"
import {
  NOTE_BATCH_COLLECT_DISABLED_HINT,
  useNoteBatchCollectEnabled
} from "~features/xiaohongshu/use-note-batch-enabled"
import { CollectPageNotesModal } from "~features/xiaohongshu/ui/collect-page-notes-modal"
import { navigateSidepanel } from "~shared/messaging"

type Props = {
  keyword: string
  tab: string
}

const primaryBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  background: "#ff2442",
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(255, 36, 66, 0.25)"
}

export function SearchPageToolbar({ keyword, tab }: Props) {
  const { enabled: noteBatchEnabled } = useNoteBatchCollectEnabled()
  const [pageModalOpen, setPageModalOpen] = useState(false)
  const [keywordLoading, setKeywordLoading] = useState(false)

  useEffect(() => {
    scanDomNoteLinks(".feeds-container", "pc_search")
    return subscribePageNotes(() => {})
  }, [])

  useEffect(() => {
    const target = document.querySelector(".feeds-container")
    if (!target) return

    const observer = new MutationObserver(() => {
      scanDomNoteLinks(".feeds-container", "pc_search")
    })
    observer.observe(target, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  const handleKeywordCollect = async () => {
    if (tab !== "user" && !noteBatchEnabled) {
      window.alert(NOTE_BATCH_COLLECT_DISABLED_HINT)
      return
    }

    setKeywordLoading(true)
    try {
      if (tab === "user") {
        await navigateSidepanel({
          to: "/xiaohongshu/batch-collect/blogger",
          options: {
            state: {
              name: `关键词「${keyword}」的博主数据`,
              collectBy: "keyword",
              keyword,
              limit: 300
            }
          }
        })
        return
      }

      const noteType = tab === "image" ? 2 : tab === "video" ? 1 : 0
      await navigateSidepanel({
        to: "/xiaohongshu/batch-collect/note",
        options: {
          state: {
            collectBy: "keyword",
            name: `关键词「${keyword}」的笔记数据`,
            keyword,
            limit: 200,
            note_type: noteType,
            sort: "general"
          }
        }
      })
    } finally {
      setKeywordLoading(false)
    }
  }

  const keywordLabel =
    tab === "user" ? "关键词博主采集" : "关键词笔记采集"

  return (
    <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 12,
          paddingTop: 4
        }}>
        {(tab === "user" || noteBatchEnabled) && (
          <button
            type="button"
            onClick={handleKeywordCollect}
            disabled={keywordLoading}
            style={primaryBtnStyle}>
            {keywordLoading ? "跳转中..." : keywordLabel}
          </button>
        )}

        {tab !== "user" && noteBatchEnabled && (
          <button
            type="button"
            onClick={() => setPageModalOpen(true)}
            style={primaryBtnStyle}>
            采集本页笔记
          </button>
        )}
      </div>

      <CollectPageNotesModal
        open={pageModalOpen}
        pageType="search"
        onClose={() => setPageModalOpen(false)}
      />
    </>
  )
}
