import { sendToBackground } from "@plasmohq/messaging"

import type {
  GetWindowValuePayload,
  HttpRequestConfig,
  NavigatePayload
} from "./messaging/types"
import { getActiveXhsTabId } from "./sidepanel-route"

export async function openSidePanel() {
  return sendToBackground({ name: "open-sidepanel" })
}

export async function smzsRequest(config: HttpRequestConfig & { tabId?: number }) {
  const tabId = config.tabId ?? (await getActiveXhsTabId())
  return sendToBackground<{
    status: number
    statusText: string
    data: unknown
    headers: Record<string, string>
    error?: string
  }>({
    name: "request",
    body: { ...config, tabId }
  })
}

export async function getWindowValue(
  paths: GetWindowValuePayload,
  tabId?: number
) {
  return sendToBackground<Record<string, unknown>>({
    name: "get-window-value",
    body: { ...paths, tabId }
  })
}

export async function navigateSidepanel(payload: NavigatePayload) {
  await sendToBackground({ name: "navigate", body: payload })
  await openSidePanel()
}

export async function feishuUploadMedia(options: {
  url: string
  file_name: string
  parent_type: string
  parent_node: string
  token: string
}) {
  return sendToBackground({
    name: "feishu-upload",
    body: options
  })
}

export async function fetchForJson<T = unknown>(
  url: string,
  init?: Omit<RequestInit, "body"> & { body?: string }
) {
  try {
    const result = await chrome.runtime.sendMessage({
      type: "qmc:fetch-json",
      url,
      ...init
    })

    if (result === undefined) {
      throw new Error("飞书请求失败：后台服务未响应，请在 chrome://extensions 重新加载扩展")
    }

    return result as T
  } catch (error) {
    const message = (error as Error).message || ""
    if (
      message.includes("Receiving end does not exist") ||
      message.includes("Could not establish connection")
    ) {
      throw new Error("飞书请求失败：后台服务未启动，请在 chrome://extensions 重新加载扩展")
    }
    throw error
  }
}

export async function downloadFile(options: chrome.downloads.DownloadOptions) {
  return sendToBackground<{ downloadId: number }>({
    name: "download-file",
    body: options
  })
}

export async function getAuthToken() {
  return sendToBackground<{ token: string }>({ name: "get-auth-token" })
}

export async function getRealUrl(url: string) {
  return sendToBackground<{ url: string }>({
    name: "get-real-url",
    body: { url }
  })
}

export async function createTab(options: chrome.tabs.CreateProperties) {
  return sendToBackground<chrome.tabs.Tab>({
    name: "create-tab",
    body: options
  })
}

export async function openExtensionOptions(section = "sync-feishu") {
  const hash = section.startsWith("#") ? section : `#${section}`
  return createTab({
    url: chrome.runtime.getURL(`options.html${hash}`)
  })
}

/** 从当前小红书 tab 的 content script feed 拦截缓存读取 note_card */
export async function getCachedFeedNoteFromPage(
  noteId: string,
  tabId?: number
): Promise<Record<string, unknown> | undefined> {
  const targetTabId = tabId ?? (await getActiveXhsTabId())
  try {
    const cached = await chrome.tabs.sendMessage(targetTabId, {
      type: "qmc:get-cached-feed-note",
      noteId
    })
    if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
      return cached as Record<string, unknown>
    }
  } catch {
    // content script 未注入或 tab 不可用
  }
  return undefined
}

/** sidepanel 批量：等待页面 feed 拦截缓存（与 waitForCachedFeedNote 对齐） */
export async function waitForCachedFeedNoteFromPage(
  noteId: string,
  timeoutMs = 2000,
  tabId?: number
): Promise<Record<string, unknown> | undefined> {
  const immediate = await getCachedFeedNoteFromPage(noteId, tabId)
  if (immediate) return immediate

  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 120))
    const cached = await getCachedFeedNoteFromPage(noteId, tabId)
    if (cached) return cached
  }

  return undefined
}
