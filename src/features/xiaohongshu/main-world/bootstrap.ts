import type { GetWindowValuePayload, HttpRequestConfig } from "~shared/messaging/types"

import { getDomainSuffix, installFetchHook, installXhrHook } from "./hooks"
import { executeHttpRequest, installSmzsHttpRequest } from "./http"

type SmzsHandlerMessage = {
  type: string
  data?: unknown
}

function getWindowValues(paths: GetWindowValuePayload) {
  const result: Record<string, unknown> = {}

  for (const [key, chain] of Object.entries(paths)) {
    let current: unknown = window
    for (const segment of chain) {
      if (current == null) {
        result[key] = undefined
        break
      }
      current = (current as Record<string, unknown>)[segment]
    }
    if (current !== undefined || key in result === false) {
      result[key] = current
    }
  }

  return result
}

function installMessageHandlers() {
  chrome.runtime.onMessage.addListener((message: SmzsHandlerMessage, _sender, sendResponse) => {
    if (!message?.type) return false

    if (message.type === "getWindowValue") {
      sendResponse(getWindowValues((message.data || {}) as GetWindowValuePayload))
      return true
    }

    if (message.type === "request") {
      executeHttpRequest((message.data || {}) as HttpRequestConfig)
        .then((res) => sendResponse(res))
        .catch((error) =>
          sendResponse({
            status: 500,
            statusText: "Error",
            data: null,
            headers: {},
            error: error?.message || String(error)
          })
        )
      return true
    }

    return false
  })
}

function hookWebpackHttpClient() {
  window.addEventListener(
    "load",
    () => {
      try {
        for (const key of Object.keys(window)) {
          if (!key.startsWith("webpackChunk")) continue
          const chunk = (window as Record<string, unknown>)[key] as {
            push?: (args: unknown[]) => unknown
          }
          if (typeof chunk?.push !== "function") continue

          chunk.push([
            [Symbol("qmc")],
            {},
            (modules: Record<string, { exports?: unknown }>) => {
              for (const mod of Object.values(modules)) {
                const exp = mod?.exports as {
                  __esModule?: boolean
                  get?: (...args: unknown[]) => unknown
                  post?: (...args: unknown[]) => unknown
                }
                if (
                  exp?.__esModule &&
                  typeof exp.get === "function" &&
                  typeof exp.post === "function"
                ) {
                  window._smzsHttpRequest = exp as Window["_smzsHttpRequest"]
                  return
                }
              }
            }
          ])
        }
      } catch (error) {
        console.warn("hook xiaohongshu http client failed", error)
      }
    },
    { once: true }
  )
}

export function bootstrapMainWorld() {
  const suffix = getDomainSuffix()
  if (suffix) {
    installFetchHook(suffix)
    installXhrHook(suffix)
  }

  installSmzsHttpRequest()
  installMessageHandlers()
  hookWebpackHttpClient()
}
