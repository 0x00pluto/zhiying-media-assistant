import { useEffect, useLayoutEffect, useState } from "react"

import {
  activatePageCollectContext,
  bootstrapPageNotesFromFeeds,
  bootstrapPageNotesFromPosted,
  scanDomNoteLinks,
  subscribePageNotes,
  type PageCollectType
} from "~features/xiaohongshu/collectors/page-notes-cache"
import { getWindowValue } from "~shared/messaging"
import { useNoteBatchCollectEnabled } from "~features/xiaohongshu/use-note-batch-enabled"
import {
  CollectPageNotesModal
} from "~features/xiaohongshu/ui/collect-page-notes-modal"
import { qmcCsuiButtonStyle } from "~features/xiaohongshu/ui/csui-theme"
import { computeExploreChannelMarginLeft } from "~features/xiaohongshu/utils/csui-mount-ready"

type Props = {
  label?: string
  pageType: PageCollectType
  layout?: "inline" | "explore-channel"
}

async function bootstrapPageNotes(pageType: PageCollectType) {
  try {
    if (pageType === "explore") {
      activatePageCollectContext("explore")
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
  const isExploreChannel = layout === "explore-channel"
  const [channelMarginLeft, setChannelMarginLeft] = useState<number | undefined>(
    () => (isExploreChannel ? computeExploreChannelMarginLeft() : undefined)
  )

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

  useLayoutEffect(() => {
    if (!isExploreChannel) return

    const updateLayout = () => {
      setChannelMarginLeft(computeExploreChannelMarginLeft())
    }

    updateLayout()
    window.addEventListener("resize", updateLayout)

    const channel =
      document.getElementById("channel-container") ||
      document.querySelector("div.feeds-page > div.channel-container")
    const observer = new MutationObserver(updateLayout)
    if (channel) {
      observer.observe(channel, { childList: true, subtree: true, attributes: true })
    }

    return () => {
      window.removeEventListener("resize", updateLayout)
      observer.disconnect()
    }
  }, [isExploreChannel])

  if (ready && !noteBatchEnabled) {
    return null
  }

  if (isExploreChannel && channelMarginLeft === undefined) {
    return null
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          marginLeft: isExploreChannel ? channelMarginLeft : undefined,
          marginBottom: isExploreChannel ? 8 : 12,
          marginTop: pageType === "profile" ? 12 : 0,
          position: isExploreChannel ? "relative" : undefined,
          zIndex: isExploreChannel ? 0 : undefined,
          pointerEvents: isExploreChannel ? "none" : undefined
        }}>
        <button
          type="button"
          className="qmc-csui-btn"
          onClick={() => setOpen(true)}
          style={{
            ...qmcCsuiButtonStyle,
            pointerEvents: isExploreChannel ? "auto" : undefined
          }}>
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
