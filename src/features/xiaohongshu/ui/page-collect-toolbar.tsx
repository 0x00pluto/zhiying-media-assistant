import { useEffect, useState } from "react"

import {
  bootstrapPageNotesFromFeeds,
  bootstrapPageNotesFromPosted,
  scanDomNoteLinks,
  subscribePageNotes
} from "~features/xiaohongshu/collectors/page-notes-cache"
import { getWindowValue } from "~shared/messaging"
import { useNoteBatchCollectEnabled } from "~features/xiaohongshu/use-note-batch-enabled"
import {
  CollectPageNotesModal,
  type PageCollectType
} from "~features/xiaohongshu/ui/collect-page-notes-modal"

type Props = {
  label?: string
  pageType: PageCollectType
  layout?: "inline" | "explore-channel"
}

async function bootstrapPageNotes(pageType: PageCollectType) {
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

    if (pageType === "profile") {
      const result = await getWindowValue({
        notes: ["__INITIAL_STATE__", "user", "notes", "_rawValue", 0]
      })
      const notes = (result.notes as Array<Record<string, unknown>>) || []
      if (notes.length) bootstrapPageNotesFromPosted(notes)
    }
  } catch {
    // 读取失败时依赖 API 拦截
  }
}

export function PageCollectToolbar({
  label = "采集本页笔记",
  pageType,
  layout = "inline"
}: Props) {
  const { enabled: noteBatchEnabled, ready } = useNoteBatchCollectEnabled()
  const [open, setOpen] = useState(false)
  const [channelWidth, setChannelWidth] = useState<number | undefined>()

  useEffect(() => {
    void bootstrapPageNotes(pageType)
    return subscribePageNotes(() => {})
  }, [pageType])

  useEffect(() => {
    if (pageType !== "explore") return

    const target = document.querySelector("#exploreFeeds")
    if (!target) return

    const observer = new MutationObserver(() => {
      scanDomNoteLinks()
    })
    observer.observe(target, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [pageType])

  useEffect(() => {
    if (layout !== "explore-channel") return

    const updateWidth = () => {
      const channel =
        document.getElementById("channel-container") ||
        document.querySelector("div.feeds-page > div.channel-container")
      const width = channel?.getBoundingClientRect().width
      if (width) setChannelWidth(width)
    }

    updateWidth()
    window.addEventListener("resize", updateWidth)
    return () => window.removeEventListener("resize", updateWidth)
  }, [layout])

  const buttonStyle: React.CSSProperties = {
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

  const isExploreChannel = layout === "explore-channel"

  if (ready && !noteBatchEnabled) {
    return null
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: isExploreChannel ? "center" : "flex-start",
          width: isExploreChannel ? channelWidth : undefined,
          maxWidth: "100%",
          marginBottom: isExploreChannel ? 8 : 12,
          marginTop: pageType === "profile" ? 12 : 0
        }}>
        <button type="button" onClick={() => setOpen(true)} style={buttonStyle}>
          {label}
        </button>
      </div>

      <CollectPageNotesModal
        open={open}
        pageType={pageType}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
