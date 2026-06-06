import type { PlasmoCSConfig, PlasmoGetInlineAnchor } from "plasmo"
import { useCallback, useEffect, useMemo, useState } from "react"

import { SearchPageToolbar } from "~features/xiaohongshu/ui/search-page-toolbar"
import { CsuiRoot } from "~features/xiaohongshu/ui/csui-root"
import { createPlasmoCsuiStyleGetter } from "~features/xiaohongshu/ui/csui-theme"
import { findSearchAnchorElement } from "~features/xiaohongshu/ui/search-toolbar-anchor"
import {
  createMountPoller,
  isSearchMountReady,
  useCsuiMountVisible
} from "~features/xiaohongshu/utils/csui-mount-ready"
import { parseSearchKeyword } from "~features/xiaohongshu/utils/parse-search-keyword"
import {
  isSearchResultPage,
  useXhsSpaHref
} from "~features/xiaohongshu/utils/spa-location"

import antdResetCss from "data-text:antd/dist/reset.css"

export const config: PlasmoCSConfig = {
  matches: ["*://www.xiaohongshu.com/*", "*://www.rednote.com/*"],
  run_at: "document_idle"
}

export const getStyle = createPlasmoCsuiStyleGetter(antdResetCss)

export const getInlineAnchor: PlasmoGetInlineAnchor = async () =>
  createMountPoller({
    isPageMatch: () => isSearchResultPage() && Boolean(parseSearchKeyword()),
    findAnchor: findSearchAnchorElement,
    insertPosition: "afterbegin"
  })

function SearchPageCsui() {
  const href = useXhsSpaHref()
  const keyword = useMemo(() => parseSearchKeyword(href), [href])
  const [tab, setTab] = useState("all")
  const onSearchPage = isSearchResultPage(href)
  const checkReady = useCallback(() => isSearchMountReady(), [])
  const visible = useCsuiMountVisible(checkReady)

  useEffect(() => {
    if (!onSearchPage) return

    const syncTab = () => {
      const active = document.querySelector(
        ".content-container > div.active[id], .content-container > div[id].active"
      ) as HTMLElement | null
      if (active?.id) {
        setTab(active.id)
        return
      }

      const tabs = document.querySelectorAll(".content-container > div[id]")
      tabs.forEach((el) => {
        if (el.classList.contains("active")) {
          setTab(el.id)
        }
      })
    }

    syncTab()

    const tabs = document.querySelectorAll(".content-container > div[id]")
    const onClick = (event: Event) => {
      const target = event.target as HTMLElement
      const id = target.id || target.parentElement?.id
      if (id) setTab(id)
    }
    tabs.forEach((el) => el.addEventListener("click", onClick))

    const observer = new MutationObserver(syncTab)
    const container = document.querySelector(".content-container")
    if (container) {
      observer.observe(container, {
        attributes: true,
        subtree: true,
        attributeFilter: ["class"]
      })
    }

    return () => {
      tabs.forEach((el) => el.removeEventListener("click", onClick))
      observer.disconnect()
    }
  }, [href, onSearchPage])

  if (!onSearchPage || !keyword || !visible) return null

  return (
    <CsuiRoot>
      <div
        style={{
          position: "relative",
          zIndex: 0,
          pointerEvents: "none",
          marginBottom: 12,
          paddingTop: 4
        }}>
        <div style={{ pointerEvents: "auto" }}>
          <SearchPageToolbar keyword={keyword} tab={tab} />
        </div>
      </div>
    </CsuiRoot>
  )
}

export default SearchPageCsui
