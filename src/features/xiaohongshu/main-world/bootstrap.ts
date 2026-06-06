import type {
  ExecuteRequestDetail,
  ExecuteResponseDetail
} from "~shared/messaging/types"
import {
  QMC_EXECUTE_REQUEST_EVENT,
  QMC_EXECUTE_RESPONSE_EVENT
} from "~shared/messaging/types"

import { getDomainSuffix, installFetchHook, installXhrHook } from "./hooks"
import { executeHttpRequest, installSmzsHttpRequest, tryHookWebpackHttpClient } from "./http"

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
  hookWebpackHttpClient()
}
