import type { PlasmoCSConfig } from "plasmo"

import {
  getCachedFeedNote,
  handleFeedApiResponse
} from "~features/xiaohongshu/collectors/feed-cache"
import { handlePageNotesApiResponse } from "~features/xiaohongshu/collectors/page-notes-cache"
import type {
  ApiInterceptPayload,
  ExecuteRequestDetail,
  ExecuteResponseDetail,
  HttpRequestConfig
} from "~shared/messaging/types"
import {
  QMC_API_RESPONSE_EVENT,
  QMC_EXECUTE_REQUEST_EVENT,
  QMC_EXECUTE_RESPONSE_EVENT
} from "~shared/messaging/types"

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
  handlePageNotesApiResponse(payload)
  for (const listener of responseListeners) {
    listener(payload)
  }
}

window.addEventListener(QMC_API_RESPONSE_EVENT, (event) => {
  const payload = (event as CustomEvent<ApiInterceptPayload>).detail
  if (payload) dispatchApiResponse(payload)
})

function bridgeRequestToMainWorld(config: HttpRequestConfig) {
  return new Promise<ExecuteResponseDetail["result"]>((resolve) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    let settled = false

    const onResponse = (event: Event) => {
      const detail = (event as CustomEvent<ExecuteResponseDetail>).detail
      if (!detail || detail.requestId !== requestId) return

      settled = true
      window.removeEventListener(QMC_EXECUTE_RESPONSE_EVENT, onResponse)
      resolve(detail.result)
    }

    window.addEventListener(QMC_EXECUTE_RESPONSE_EVENT, onResponse)
    window.dispatchEvent(
      new CustomEvent<ExecuteRequestDetail>(QMC_EXECUTE_REQUEST_EVENT, {
        detail: { requestId, config }
      })
    )

    window.setTimeout(() => {
      if (settled) return
      window.removeEventListener(QMC_EXECUTE_RESPONSE_EVENT, onResponse)
      resolve({
        status: 500,
        statusText: "Error",
        data: null,
        headers: {},
        error: "页面脚本未响应，请刷新小红书页面后重试"
      })
    }, 30000)
  })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "response" && message.data) {
    dispatchApiResponse(message.data as ApiInterceptPayload)
    return false
  }

  if (message?.type === "request" && message.data) {
    void bridgeRequestToMainWorld(message.data as HttpRequestConfig).then(
      (result) => sendResponse(result)
    )
    return true
  }

  if (message?.type === "qmc:get-cached-feed-note" && message.noteId) {
    sendResponse(getCachedFeedNote(String(message.noteId)))
    return false
  }

  return false
})

console.info("[quanmediacrawl] isolated content script loaded")
