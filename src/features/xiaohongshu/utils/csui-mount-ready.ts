import { useLayoutEffect, useState } from "react"

import { resolveNoteId } from "~features/xiaohongshu/collectors/single-note"
import {
  findNoteDetailAnchorElement,
  findNoteDetailAvatarElement
} from "~features/xiaohongshu/ui/note-detail-anchor"
import {
  findExploreFeedAnchorElement,
  installXhsSpaHrefWatcher,
  isExploreFeedPage,
  isSearchResultPage,
  SPA_HREF_EVENT
} from "~features/xiaohongshu/utils/spa-location"
import { findSearchAnchorElement } from "~features/xiaohongshu/ui/search-toolbar-anchor"
import { parseSearchKeyword } from "~features/xiaohongshu/utils/parse-search-keyword"

export {
  findNoteDetailAnchorElement,
  findNoteDetailAvatarElement
} from "~features/xiaohongshu/ui/note-detail-anchor"

type InsertPosition = "beforebegin" | "afterbegin" | "beforeend" | "afterend"

export type MountPollerOptions = {
  isPageMatch: () => boolean
  findAnchor: () => Element | null
  insertPosition: InsertPosition
  isAnchorReady?: (element: Element) => boolean
  pollIntervalMs?: number
  stableChecks?: number
}

const STABLE_FRAME_COUNT = 2

export function isDocumentLoadedSync() {
  return typeof document === "undefined" || document.readyState === "complete"
}

export function isElementLayoutReady(element: Element | null | undefined) {
  if (!element) return false
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function getRectKey(element: Element) {
  const rect = element.getBoundingClientRect()
  return `${rect.top}|${rect.left}|${rect.width}|${rect.height}`
}

function subscribeMountPresenceBump(onBump: () => void) {
  installXhsSpaHrefWatcher()

  window.addEventListener(SPA_HREF_EVENT, onBump)
  window.addEventListener("popstate", onBump)

  const observer = new MutationObserver(onBump)
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true })
  }

  return () => {
    window.removeEventListener(SPA_HREF_EVENT, onBump)
    window.removeEventListener("popstate", onBump)
    observer.disconnect()
  }
}

function runUntilStableReady(
  isReady: () => boolean,
  onStable: () => void,
  onUnstable?: () => void
) {
  let cancelled = false
  let stableCount = 0
  let frame = 0

  const tick = () => {
    if (cancelled) return

    if (!isDocumentLoadedSync() || !isReady()) {
      stableCount = 0
      onUnstable?.()
      frame = requestAnimationFrame(tick)
      return
    }

    stableCount++
    if (stableCount >= STABLE_FRAME_COUNT) {
      onStable()
      return
    }

    frame = requestAnimationFrame(tick)
  }

  tick()

  return () => {
    cancelled = true
    cancelAnimationFrame(frame)
  }
}

export function computeExploreChannelMarginLeft() {
  const channel =
    document.getElementById("channel-container") ||
    document.querySelector("div.feeds-page > div.channel-container")
  const feedsPage = document.querySelector("div.feeds-page")
  if (!channel || !feedsPage) return undefined

  const firstTab =
    channel.querySelector(".channel-list .channel") ||
    channel.querySelector(".channel") ||
    channel.firstElementChild
  if (!isElementLayoutReady(firstTab)) return undefined

  const feedsLeft = feedsPage.getBoundingClientRect().left
  const alignLeft = (firstTab as Element).getBoundingClientRect().left
  return Math.max(0, Math.round(alignLeft - feedsLeft))
}

export function isExploreFeedMountReady() {
  if (!isExploreFeedPage() || !isDocumentLoadedSync()) return false

  const anchor = findExploreFeedAnchorElement()
  if (!isElementLayoutReady(anchor)) return false

  const firstTab =
    anchor?.querySelector(".channel-list .channel") ||
    anchor?.querySelector(".channel") ||
    anchor?.firstElementChild
  if (!isElementLayoutReady(firstTab)) return false

  return computeExploreChannelMarginLeft() !== undefined
}

export function isSearchMountReady() {
  if (!isSearchResultPage() || !parseSearchKeyword() || !isDocumentLoadedSync()) {
    return false
  }
  return isElementLayoutReady(findSearchAnchorElement())
}

export function isProfileMountReady() {
  if (!isDocumentLoadedSync()) return false
  return isElementLayoutReady(findProfileAnchorElement())
}

export function isNoteDetailMountReady() {
  if (!isDocumentLoadedSync()) return false
  if (!findNoteDetailAvatarElement()) return false
  return isElementLayoutReady(findNoteDetailAnchorElement())
}

export function findProfileAnchorElement() {
  return document.querySelector("#userPageContainer .user-info .info-part .info")
}

export function createMountPoller(options: MountPollerOptions) {
  installXhsSpaHrefWatcher()

  const stableChecks = options.stableChecks ?? STABLE_FRAME_COUNT

  return new Promise<{ element: Element; insertPosition: InsertPosition }>(
    (resolve) => {
      let stableCount = 0
      let lastRectKey = ""
      let resolved = false

      const tryMount = () => {
        if (resolved) return true

        if (!options.isPageMatch()) {
          stableCount = 0
          lastRectKey = ""
          return false
        }

        if (!isDocumentLoadedSync()) return false

        const element = options.findAnchor()
        if (!element) {
          stableCount = 0
          lastRectKey = ""
          return false
        }

        if (options.isAnchorReady && !options.isAnchorReady(element)) {
          stableCount = 0
          lastRectKey = ""
          return false
        }

        if (!isElementLayoutReady(element)) {
          stableCount = 0
          lastRectKey = ""
          return false
        }

        const rectKey = getRectKey(element)
        if (rectKey === lastRectKey) {
          stableCount++
        } else {
          stableCount = 1
          lastRectKey = rectKey
        }

        if (stableCount < stableChecks) return false

        resolved = true
        resolve({
          element,
          insertPosition: options.insertPosition
        })
        return true
      }

      if (tryMount()) return

      const timer = window.setInterval(() => {
        if (tryMount()) window.clearInterval(timer)
      }, options.pollIntervalMs ?? 250)

      const onRouteChange = () => {
        if (tryMount()) window.clearInterval(timer)
      }

      window.addEventListener(SPA_HREF_EVENT, onRouteChange)
      window.addEventListener("popstate", onRouteChange)
    }
  )
}

export function useCsuiMountVisible(isReady: () => boolean) {
  const [visible, setVisible] = useState(false)

  useLayoutEffect(() => {
    if (visible) return

    return runUntilStableReady(isReady, () => setVisible(true))
  }, [isReady, visible])

  return visible
}

export function useNoteDetailPresence() {
  const [noteId, setNoteId] = useState("")
  const [visible, setVisible] = useState(false)

  useLayoutEffect(() => {
    let stopStableCheck = () => {}

    const bump = () => {
      stopStableCheck()
      setNoteId(resolveNoteId())

      stopStableCheck = runUntilStableReady(
        () => {
          const id = resolveNoteId()
          setNoteId(id)
          return Boolean(id) && isNoteDetailMountReady()
        },
        () => setVisible(true),
        () => setVisible(false)
      )
    }

    bump()
    const unsubscribe = subscribeMountPresenceBump(bump)

    return () => {
      stopStableCheck()
      unsubscribe()
    }
  }, [])

  return { noteId, visible }
}
