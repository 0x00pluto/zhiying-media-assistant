import type { GetWindowValuePayload, HttpRequestConfig } from "~shared/messaging/types"

import { readWindowValues } from "./read-window-values"

const XHS_HOSTS = ["www.xiaohongshu.com", "www.rednote.com", "pgy.xiaohongshu.com"]

export async function findXiaohongshuTab(tabId?: number): Promise<number> {
  if (tabId) {
    const tab = await chrome.tabs.get(tabId).catch(() => null)
    if (tab?.id) return tab.id
  }

  const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (active?.id && active.url && XHS_HOSTS.some((h) => active.url!.includes(h))) {
    return active.id
  }

  const tabs = await chrome.tabs.query({ url: ["*://www.xiaohongshu.com/*", "*://www.rednote.com/*"] })
  if (tabs[0]?.id) return tabs[0].id

  throw new Error("请先打开小红书页面后再执行采集")
}

export async function sendMainWorldMessage<T>(
  tabId: number,
  message: { type: string; data?: unknown }
): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message) as Promise<T>
}

export async function requestViaMainWorld(
  config: HttpRequestConfig,
  tabId?: number
) {
  const id = await findXiaohongshuTab(tabId)
  return sendMainWorldMessage(id, { type: "request", data: config })
}

export async function getWindowValueViaMainWorld(
  paths: GetWindowValuePayload,
  tabId?: number
) {
  const id = await findXiaohongshuTab(tabId)

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: id },
    world: "MAIN",
    func: readWindowValues,
    args: [paths]
  })

  return (injection?.result || {}) as Record<string, unknown>
}
