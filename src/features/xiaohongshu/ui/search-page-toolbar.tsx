import { useEffect, useState } from "react"

import {
  scanDomNoteLinks,
  subscribePageNotes
} from "~features/xiaohongshu/collectors/page-notes-cache"
import { useNoteBatchCollectEnabled } from "~features/xiaohongshu/use-note-batch-enabled"
import { CollectPageNotesModal } from "~features/xiaohongshu/ui/collect-page-notes-modal"
import { qmcCsuiButtonStyle } from "~features/xiaohongshu/ui/csui-theme"
import { navigateSidepanel } from "~shared/messaging"

type Props = {
  keyword: string
  tab: string
}

export function SearchPageToolbar({ keyword, tab }: Props) {
  const { enabled: noteBatchEnabled } = useNoteBatchCollectEnabled()
  const [pageModalOpen, setPageModalOpen] = useState(false)
  const [bloggerLoading, setBloggerLoading] = useState(false)

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

  const handleBloggerCollect = async () => {
    setBloggerLoading(true)
    try {
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
    } finally {
      setBloggerLoading(false)
    }
  }

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
        {tab === "user" && (
          <button
            type="button"
            className="qmc-csui-btn"
            onClick={handleBloggerCollect}
            disabled={bloggerLoading}
            style={{
              ...qmcCsuiButtonStyle,
              cursor: bloggerLoading ? "wait" : "pointer"
            }}>
            {bloggerLoading ? "跳转中..." : "关键词博主采集"}
          </button>
        )}

        {tab !== "user" && noteBatchEnabled && (
          <button
            type="button"
            className="qmc-csui-btn"
            onClick={() => setPageModalOpen(true)}
            style={qmcCsuiButtonStyle}>
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
