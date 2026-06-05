import type { PlasmoCSConfig } from "plasmo"

import { handleFeedApiResponse } from "~features/xiaohongshu/collectors/feed-cache"
import type { ApiInterceptPayload } from "~shared/messaging/types"
import { QMC_API_RESPONSE_EVENT } from "~shared/messaging/types"

// matches 必须为字面量数组，Plasmo 才能在构建时写入 manifest（不可从常量 spread）
export const config: PlasmoCSConfig = {
  matches: [
    "*://b23.tv/*",
    "*://live.kuaishou.com/*",
    "*://pgy.xiaohongshu.com/*",
    "*://search.bilibili.com/*",
    "*://space.bilibili.com/*",
    "*://v.douyin.com/*",
    "*://v.kuaishou.com/*",
    "*://vt.tiktok.com/*",
    "*://www.bilibili.com/*",
    "*://www.douyin.com/*",
    "*://www.iesdouyin.com/*",
    "*://www.kuaishou.com/*",
    "*://www.rednote.com/*",
    "*://www.tiktok.com/*",
    "*://www.xiaohongshu.com/*",
    "*://www.xingtu.cn/*",
    "*://xhslink.com/*"
  ],
  run_at: "document_start"
}

declare global {
  interface Window {
    platform?: { code: string; name: string }
    router?: {
      navigate: (to: string, options?: { state?: Record<string, unknown> }) => void
      location?: { pathname: string }
    }
  }
}

const responseListeners = new Set<(payload: ApiInterceptPayload) => void>()

export function onApiResponse(listener: (payload: ApiInterceptPayload) => void) {
  responseListeners.add(listener)
  return () => responseListeners.delete(listener)
}

function dispatchApiResponse(payload: ApiInterceptPayload) {
  handleFeedApiResponse(payload)
  for (const listener of responseListeners) {
    listener(payload)
  }
}

window.addEventListener(QMC_API_RESPONSE_EVENT, (event) => {
  const payload = (event as CustomEvent<ApiInterceptPayload>).detail
  if (payload) dispatchApiResponse(payload)
})

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "response" && message.data) {
    dispatchApiResponse(message.data as ApiInterceptPayload)
  }
})

console.info("[quanmediacrawl] isolated content script loaded")
