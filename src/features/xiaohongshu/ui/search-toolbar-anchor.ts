import { isSearchResultPage } from "~features/xiaohongshu/utils/spa-location"
import { parseSearchKeyword } from "~features/xiaohongshu/utils/parse-search-keyword"

export const SEARCH_ANCHOR_SELECTORS = [
  "div.ai-feeds-page",
  ".search-layout .content-container",
  ".search-layout",
  "div.feeds-page"
]

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function findSearchAnchorElement() {
  if (!isSearchResultPage()) return null

  for (const selector of SEARCH_ANCHOR_SELECTORS) {
    const element = document.querySelector(selector)
    if (element) return element
  }
  return null
}

type WaitOptions = {
  timeoutMs?: number
}

export async function waitForSearchMountReady(options: WaitOptions = {}) {
  const timeoutMs = options.timeoutMs ?? 120_000
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (isSearchResultPage() && parseSearchKeyword()) {
      const element = findSearchAnchorElement()
      if (element) return element
    }
    await wait(250)
  }

  return null
}
