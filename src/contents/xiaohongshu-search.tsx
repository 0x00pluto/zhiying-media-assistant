import type { PlasmoCSConfig, PlasmoGetInlineAnchor } from "plasmo"
import { App, ConfigProvider } from "antd"
import { useEffect, useState } from "react"

import { SearchPageToolbar } from "~features/xiaohongshu/ui/search-page-toolbar"
import { parseSearchKeyword } from "~features/xiaohongshu/utils/parse-search-keyword"

export const config: PlasmoCSConfig = {
  matches: [
    "*://www.xiaohongshu.com/search_result*",
    "*://www.rednote.com/search_result*"
  ],
  run_at: "document_idle"
}

const SEARCH_ANCHOR_SELECTORS = [
  "div.ai-feeds-page",
  "div.feeds-page",
  ".search-layout .content-container",
  ".content-container",
  ".search-layout"
]

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function findSearchAnchor() {
  for (let i = 0; i < 40; i++) {
    for (const selector of SEARCH_ANCHOR_SELECTORS) {
      const element = document.querySelector(selector)
      if (element) return element
    }
    await wait(250)
  }
  return null
}

export const getInlineAnchor: PlasmoGetInlineAnchor = async () => {
  const element = (await findSearchAnchor()) || document.body

  return {
    element,
    insertPosition: "afterbegin"
  }
}

function SearchPageCsui() {
  const [keyword, setKeyword] = useState(() => parseSearchKeyword())
  const [tab, setTab] = useState("all")

  useEffect(() => {
    setKeyword(parseSearchKeyword())

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
  }, [])

  if (!keyword) return null

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#ff2442",
          borderRadius: 8
        }
      }}>
      <App>
        <SearchPageToolbar keyword={keyword} tab={tab} />
      </App>
    </ConfigProvider>
  )
}

export default SearchPageCsui
