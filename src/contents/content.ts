import type { PlasmoCSConfig } from "plasmo"

import type { ApiInterceptPayload } from "~shared/messaging/types"

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

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "response" && message.data) {
    for (const listener of responseListeners) {
      listener(message.data as ApiInterceptPayload)
    }
  }
})

console.info("[quanmediacrawl] isolated content script loaded")
