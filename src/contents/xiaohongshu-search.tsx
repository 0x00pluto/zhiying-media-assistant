import type { PlasmoCSConfig, PlasmoGetInlineAnchor } from "plasmo"
import { useEffect, useState } from "react"

import { CsuiCollectButton } from "~features/xiaohongshu/ui/csui-button"

export const config: PlasmoCSConfig = {
  matches: [
    "*://www.xiaohongshu.com/search_result*",
    "*://www.rednote.com/search_result*"
  ]
}

export const getInlineAnchor: PlasmoGetInlineAnchor = async () =>
  document.querySelector("div.feeds-page") ||
  document.querySelector("div.ai-feeds-page") ||
  document.body

function SearchPageCsui() {
  const [keyword, setKeyword] = useState("")
  const [tab, setTab] = useState("all")

  useEffect(() => {
    const params = new URL(location.href).searchParams
    const kw = params.get("keyword")
    if (kw) setKeyword(decodeURIComponent(kw))

    const tabs = document.querySelectorAll(".content-container>div[id]")
    const onClick = (event: Event) => {
      const target = event.target as HTMLElement
      const id = target.id || target.parentElement?.id
      if (id) setTab(id)
    }
    tabs.forEach((el) => el.addEventListener("click", onClick))
    return () => tabs.forEach((el) => el.removeEventListener("click", onClick))
  }, [])

  if (!keyword) return null

  if (tab === "user") {
    return (
      <CsuiCollectButton
        label="批量采集博主"
        to="/xiaohongshu/batch-collect/blogger"
        state={{
          name: `关键词「${keyword}」的博主数据`,
          collectBy: "keyword",
          keyword,
          limit: 300
        }}
      />
    )
  }

  const noteType = tab === "image" ? 2 : tab === "video" ? 1 : 0

  return (
    <CsuiCollectButton
      label="批量采集笔记"
      to="/xiaohongshu/batch-collect/note"
      state={{
        collectBy: "keyword",
        name: `关键词「${keyword}」的笔记数据`,
        keyword,
        limit: 200,
        note_type: noteType,
        sort: "general"
      }}
    />
  )
}

export default SearchPageCsui
