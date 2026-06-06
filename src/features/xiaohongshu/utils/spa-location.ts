import { useEffect, useState } from "react"

import { findNoteDetailAvatarElement } from "~features/xiaohongshu/ui/note-detail-anchor"

const SPA_HREF_EVENT = "qmc:xhs-spa-href-change"

export { SPA_HREF_EVENT }

export function isSearchResultPage(href?: string): boolean {
  try {
    const target =
      href ?? (typeof location !== "undefined" ? location.href : "")
    if (!target) return false

    const { pathname } = new URL(target)
    return pathname.startsWith("/search_result")
  } catch {
    return false
  }
}

/** 发现页首页 feed（/explore，含 ?channel_id= 等 query） */
export function isExploreFeedPage(href?: string): boolean {
  try {
    const target =
      href ?? (typeof location !== "undefined" ? location.href : "")
    if (!target) return false

    const { pathname } = new URL(target)
    return pathname === "/explore" || pathname === "/explore/"
  } catch {
    return false
  }
}

export function findExploreFeedAnchorElement() {
  if (!isExploreFeedPage()) return null
  return document.querySelector("div.feeds-page > div.channel-container")
}

export function getNoteIdFromPathname(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)
  if (segments[0] === "explore" && segments[1]) {
    return segments[1]
  }
  if (segments[0] === "discovery" && segments[1] === "item" && segments[2]) {
    return segments[2]
  }
  return ""
}

/** 独立笔记页 URL，或弹层内已出现 #noteContainer */
export function isNoteDetailPage(href?: string) {
  try {
    const target =
      href ?? (typeof location !== "undefined" ? location.href : "")
    if (target && getNoteIdFromPathname(new URL(target).pathname)) {
      return true
    }
  } catch {
    // ignore invalid href
  }
  return Boolean(findNoteDetailAvatarElement())
}

function notifySpaHrefChange() {
  window.dispatchEvent(new Event(SPA_HREF_EVENT))
}

let spaHistoryPatched = false

export function installXhsSpaHrefWatcher() {
  if (spaHistoryPatched) return
  spaHistoryPatched = true

  const { pushState, replaceState } = history

  history.pushState = function (...args) {
    const result = pushState.apply(this, args)
    notifySpaHrefChange()
    return result
  }

  history.replaceState = function (...args) {
    const result = replaceState.apply(this, args)
    notifySpaHrefChange()
    return result
  }

  window.addEventListener("popstate", notifySpaHrefChange)
}

export function useXhsSpaHref() {
  const [href, setHref] = useState(() => location.href)

  useEffect(() => {
    installXhsSpaHrefWatcher()

    const syncHref = () => {
      setHref((current) => {
        const next = location.href
        return current === next ? current : next
      })
    }

    window.addEventListener(SPA_HREF_EVENT, syncHref)
    window.addEventListener("popstate", syncHref)

    // 兜底：部分页面路由不触发 history API
    const observer = new MutationObserver(syncHref)
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    })

    return () => {
      window.removeEventListener(SPA_HREF_EVENT, syncHref)
      window.removeEventListener("popstate", syncHref)
      observer.disconnect()
    }
  }, [])

  return href
}
