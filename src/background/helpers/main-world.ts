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

  const tabs = await chrome.tabs.query({
    url: ["*://www.xiaohongshu.com/*", "*://www.rednote.com/*"]
  })
  if (tabs[0]?.id) return tabs[0].id

  throw new Error("请先打开小红书页面后再执行采集")
}

export async function sendMainWorldMessage<T>(
  tabId: number,
  message: { type: string; data?: unknown }
): Promise<T> {
  try {
    const result = await chrome.tabs.sendMessage(tabId, message)
    if (result !== undefined) {
      return result as T
    }
  } catch (error) {
    const messageText = (error as Error).message || ""
    if (
      !messageText.includes("Receiving end does not exist") &&
      !messageText.includes("Could not establish connection")
    ) {
      throw error
    }
  }

  throw new Error("页面脚本未就绪，请刷新小红书页面后重试")
}

async function requestViaExecuteScript(config: HttpRequestConfig, tabId: number) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async (requestConfig: HttpRequestConfig) => {
      const runner = (
        window as Window & {
          smzsHttpRequest?: (input: HttpRequestConfig) => Promise<{
            status: number
            statusText: string
            data: unknown
            headers: Record<string, string>
            error?: string
          }>
        }
      ).smzsHttpRequest

      if (!runner) {
        return {
          status: 500,
          statusText: "Error",
          data: null,
          headers: {},
          error: "页面脚本未就绪，请刷新小红书页面后重试"
        }
      }

      try {
        const result = await runner(requestConfig)
        return (
          result || {
            status: 500,
            statusText: "Error",
            data: null,
            headers: {},
            error: "页面未返回数据，请刷新小红书页面后重试"
          }
        )
      } catch (error) {
        return {
          status: 500,
          statusText: "Error",
          data: null,
          headers: {},
          error: (error as Error).message || "请求失败"
        }
      }
    },
    args: [config]
  })

  if (injection?.result) {
    return injection.result
  }

  if (injection?.error) {
    throw injection.error
  }

  return null
}

export async function requestViaMainWorld(
  config: HttpRequestConfig,
  tabId?: number
) {
  const id = await findXiaohongshuTab(tabId)

  const scriptResult = await requestViaExecuteScript(config, id)
  if (scriptResult) {
    return scriptResult
  }

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
