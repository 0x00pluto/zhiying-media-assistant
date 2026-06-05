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

export type HttpRequestConfig = {
  url: string
  method?: string
  params?: Record<string, string | number | boolean | undefined>
  data?: unknown
  headers?: Record<string, string>
  enhanced?: boolean
  skipErrorHandler?: boolean
}

export type NavigatePayload = {
  to: string
  options?: {
    state?: Record<string, unknown>
    blobUrl?: string
  }
}

export type GetWindowValuePayload = Record<string, string[]>
