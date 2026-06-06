import type {
  ExecuteRequestDetail,
  ExecuteResponseDetail,
  GetWindowValuePayload,
  HttpRequestConfig
} from "~shared/messaging/types"
import {
  QMC_EXECUTE_REQUEST_EVENT,
  QMC_EXECUTE_RESPONSE_EVENT
} from "~shared/messaging/types"

import { getDomainSuffix, installFetchHook, installXhrHook } from "./hooks"
import { executeHttpRequest, installSmzsHttpRequest, tryHookWebpackHttpClient } from "./http"

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

function installExecuteRequestBridge() {
  window.addEventListener(QMC_EXECUTE_REQUEST_EVENT, (event) => {
    const detail = (event as CustomEvent<ExecuteRequestDetail>).detail
    if (!detail?.requestId || !detail.config) return

    void executeHttpRequest(detail.config)
      .then((result) => {
        window.dispatchEvent(
          new CustomEvent<ExecuteResponseDetail>(QMC_EXECUTE_RESPONSE_EVENT, {
            detail: { requestId: detail.requestId, result }
          })
        )
      })
      .catch((error) => {
        window.dispatchEvent(
          new CustomEvent<ExecuteResponseDetail>(QMC_EXECUTE_RESPONSE_EVENT, {
            detail: {
              requestId: detail.requestId,
              result: {
                status: 500,
                statusText: "Error",
                data: null,
                headers: {},
                error: (error as Error).message || "请求失败"
              }
            }
          })
        )
      })
  })
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
  tryHookWebpackHttpClient()
  window.addEventListener("load", () => tryHookWebpackHttpClient(), {
    once: true
  })
  let attempts = 0
  const hookTimer = window.setInterval(() => {
    attempts++
    if (tryHookWebpackHttpClient() || attempts >= 15) {
      window.clearInterval(hookTimer)
    }
  }, 2000)
}

export function bootstrapMainWorld() {
  const suffix = getDomainSuffix()
  if (suffix) {
    installFetchHook(suffix)
    installXhrHook(suffix)
  }

  installSmzsHttpRequest()
  installExecuteRequestBridge()
  installMessageHandlers()
  hookWebpackHttpClient()
}
