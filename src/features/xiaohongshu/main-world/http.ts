import type { HttpRequestConfig } from "~shared/messaging/types"

import { buildSignedHeaders } from "./sign"

declare global {
  interface Window {
    _smzsHttpRequest?: {
      get?: (url: string, config: HttpRequestConfig) => Promise<unknown>
      post?: (url: string, data: unknown, config: HttpRequestConfig) => Promise<unknown>
      request?: (config: HttpRequestConfig) => Promise<{
        status: number
        statusText: string
        data: unknown
        headers: Record<string, string>
        error?: string
      }>
    }
    smzsHttpRequest?: (config: HttpRequestConfig) => Promise<{
      status: number
      statusText: string
      data: unknown
      headers: Record<string, string>
      error?: string
    }>
  }
}

function getBaseUrl(): string {
  return location.hostname.includes("rednote.com")
    ? "https://webapi.rednote.com"
    : "https://edith.xiaohongshu.com"
}

function buildUrl(path: string, params?: HttpRequestConfig["params"]): string {
  const base = getBaseUrl()
  const url = new URL(path.startsWith("http") ? path : `${base}${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

async function enhancedRequest(config: HttpRequestConfig) {
  const client = window._smzsHttpRequest
  if (!client) {
    return standardRequest(config)
  }

  const method = (config.method || "GET").toUpperCase()
  const url = buildUrl(config.url, config.params)

  try {
    if (["GET", "DELETE", "HEAD"].includes(method) && client.get) {
      const data = await client.get(url, config)
      return { status: 200, statusText: "OK", data, headers: {} }
    }

    if (["POST", "PUT", "PATCH"].includes(method) && client.post) {
      const data = await client.post(url, config.data, config)
      return { status: 200, statusText: "OK", data, headers: {} }
    }
  } catch (error) {
    const err = error as { message?: string; response?: { status?: number; statusText?: string; data?: unknown; headers?: Record<string, string> } }
    return {
      error: err.message || "请求失败",
      status: err.response?.status || 500,
      statusText: err.response?.statusText || "",
      data: err.response?.data,
      headers: err.response?.headers || {}
    }
  }

  return standardRequest(config)
}

async function standardRequest(config: HttpRequestConfig) {
  const method = (config.method || "GET").toUpperCase()
  const path = config.url.startsWith("http")
    ? new URL(config.url).pathname + new URL(config.url).search
    : config.url
  const signed = await buildSignedHeaders(path, config.data)
  const url = buildUrl(config.url, config.params)

  const headers: Record<string, string> = {
    "content-type": "application/json;charset=UTF-8",
    ...signed,
    ...config.headers
  }

  const init: RequestInit = {
    method,
    headers,
    credentials: "include"
  }

  if (config.data !== undefined && !["GET", "HEAD"].includes(method)) {
    init.body =
      typeof config.data === "string" ? config.data : JSON.stringify(config.data)
  }

  const response = await fetch(url, init)
  const text = await response.text()
  let data: unknown = text

  try {
    data = JSON.parse(text)
  } catch {
    // keep text
  }

  if (!response.ok) {
    return {
      status: response.status,
      statusText: response.statusText,
      data,
      headers: Object.fromEntries(response.headers.entries()),
      error: (data as { msg?: string })?.msg || response.statusText
    }
  }

  const body = data as { code?: number; msg?: string }
  if (body?.code && body.code !== 1000 && body.code !== 0) {
    return {
      status: response.status,
      statusText: response.statusText,
      data,
      headers: Object.fromEntries(response.headers.entries()),
      error: body.msg || "接口请求失败"
    }
  }

  return {
    status: response.status,
    statusText: response.statusText,
    data,
    headers: Object.fromEntries(response.headers.entries())
  }
}

export async function executeHttpRequest(config: HttpRequestConfig) {
  if (config.enhanced) {
    return enhancedRequest(config)
  }

  if (window.smzsHttpRequest) {
    return window.smzsHttpRequest(config)
  }

  return standardRequest(config)
}

export function installSmzsHttpRequest() {
  window.smzsHttpRequest = executeHttpRequest
}
