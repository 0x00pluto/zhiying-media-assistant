export type SmzsMessage<T = unknown> = {
  id?: number
  type: string
  data?: T
  timestamp?: number
}

export type ApiInterceptPayload = {
  url: string
  method: string
  body?: unknown
  result: unknown
}

/** MAIN world 与 isolated content script 之间传递 API 拦截结果 */
export const QMC_API_RESPONSE_EVENT = "qmc:api-response"

export type HttpRequestConfig = {
  url: string
  method?: string
  params?: Record<string, string | number | boolean | undefined>
  data?: unknown
  headers?: Record<string, string>
  enhanced?: boolean
  skipErrorHandler?: boolean
}

/** isolated → MAIN world 请求桥接 */
export const QMC_EXECUTE_REQUEST_EVENT = "qmc:execute-request"
export const QMC_EXECUTE_RESPONSE_EVENT = "qmc:execute-response"

export type ExecuteRequestDetail = {
  requestId: string
  config: HttpRequestConfig
}

export type ExecuteResponseDetail = {
  requestId: string
  result: {
    status: number
    statusText: string
    data: unknown
    headers: Record<string, string>
    error?: string
  }
}

export type NavigatePayload = {
  to: string
  options?: {
    state?: Record<string, unknown>
    blobUrl?: string
  }
}

export type GetWindowValuePayload = Record<string, string[]>
