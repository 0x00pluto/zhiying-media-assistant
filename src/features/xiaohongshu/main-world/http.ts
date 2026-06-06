import type { HttpRequestConfig } from "~shared/messaging/types"

import {
  recoverHttpDataFromAxiosError,
  unwrapXhsResponsePayload
} from "~features/xiaohongshu/api/response"

import { buildSignedHeaders } from "./sign"

declare global {
  interface Window {
    _smzsHttpRequest?: {
      get?: (url: string, config: HttpRequestConfig) => Promise<{
        status: number
        statusText: string
        data: unknown
        headers: Record<string, string>
      }>
      post?: (
        url: string,
        data: unknown,
        config: HttpRequestConfig
      ) => Promise<{
        status: number
        statusText: string
        data: unknown
        headers: Record<string, string>
      }>
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

type HttpResponse = {
  status: number
  statusText: string
  data: unknown
  headers: Record<string, string>
  error?: string
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

function normalizeRequestError(error: unknown): HttpResponse {
  const err = error as {
    message?: string
    response?: {
      status?: number
      statusText?: string
      data?: unknown
      headers?: Record<string, string>
    }
  }

  return {
    error: err.message || "请求失败",
    status: err.response?.status || 500,
    statusText: err.response?.statusText || "",
    data: err.response?.data,
    headers: err.response?.headers || {}
  }
}

function extractHttpClientFromExport(exp: unknown): boolean {
  if (!exp || typeof exp !== "object") return false

  const candidates = [exp, (exp as { default?: unknown }).default]
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue
    const client = candidate as Window["_smzsHttpRequest"]
    if (
      typeof client?.post === "function" &&
      typeof client?.get === "function"
    ) {
      window._smzsHttpRequest = client
      return true
    }
    if (typeof client?.request === "function") {
      window._smzsHttpRequest = client
      return true
    }
  }
  return false
}

type WebpackRequire = {
  m?: Record<string, unknown>
  c?: Record<string, unknown>
  (id: string | number): unknown
}

function scanWebpackModules(requireFn: WebpackRequire) {
  const moduleIds = Object.keys(requireFn.m || requireFn.c || {})
  for (const id of moduleIds) {
    try {
      const exp = requireFn(id)
      if (extractHttpClientFromExport(exp)) return true
    } catch {
      // 部分模块未就绪
    }
  }
  return false
}

const patchedWebpackChunks = new WeakSet<object>()

function patchWebpackChunkPush(chunk: { push?: (...args: unknown[]) => unknown }) {
  if (patchedWebpackChunks.has(chunk) || typeof chunk.push !== "function") return
  patchedWebpackChunks.add(chunk)

  const originalPush = chunk.push.bind(chunk)
  chunk.push = (...args: unknown[]) => {
    const requireFn = args[2]
    if (typeof requireFn === "function") {
      scanWebpackModules(requireFn as WebpackRequire)
    }
    return originalPush(...args)
  }
}

export function tryHookWebpackHttpClient() {
  if (
    (window._smzsHttpRequest?.post &&
      typeof window._smzsHttpRequest.post === "function") ||
    (window._smzsHttpRequest?.request &&
      typeof window._smzsHttpRequest.request === "function")
  ) {
    return true
  }

  try {
    for (const key of Object.keys(window)) {
      if (!key.startsWith("webpackChunk")) continue
      const chunk = (window as Record<string, unknown>)[key] as {
        push?: (...args: unknown[]) => unknown
      }
      if (typeof chunk?.push !== "function") continue

      patchWebpackChunkPush(chunk)

      chunk.push([
        [Symbol("qmc")],
        {},
        (requireFn: WebpackRequire) => {
          scanWebpackModules(requireFn)
        }
      ])
    }
  } catch (error) {
    console.warn("hook xiaohongshu http client failed", error)
  }

  return Boolean(
    (window._smzsHttpRequest?.post &&
      typeof window._smzsHttpRequest.post === "function") ||
      (window._smzsHttpRequest?.request &&
        typeof window._smzsHttpRequest.request === "function")
  )
}

async function waitForNativeClient(maxAttempts = 40, delayMs = 250) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    tryHookWebpackHttpClient()
    const client = window._smzsHttpRequest
    if (
      (client?.post && typeof client.post === "function") ||
      (client?.request && typeof client.request === "function")
    ) {
      return client
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  return undefined
}

function normalizeNativeResponse(response: unknown): HttpResponse | null {
  if (response == null) return null

  const envelope = response as {
    status?: number
    statusText?: string
    data?: unknown
    headers?: Record<string, string>
    error?: string
  }

  return {
    status: envelope.status ?? 200,
    statusText: envelope.statusText ?? "",
    data: unwrapXhsResponsePayload(
      envelope.data !== undefined ? envelope.data : response
    ),
    headers: envelope.headers || {},
    error: envelope.error
  }
}

function recoverHttpResponseFromError(error: unknown): HttpResponse | null {
  const data = recoverHttpDataFromAxiosError(error)
  if (data === undefined) return null

  const err = error as {
    response?: {
      status?: number
      statusText?: string
      headers?: Record<string, string>
    }
  }

  return {
    status: err.response?.status ?? 200,
    statusText: err.response?.statusText ?? "",
    data: unwrapXhsResponsePayload(data),
    headers: err.response?.headers || {}
  }
}

async function nativePost(
  client: NonNullable<Window["_smzsHttpRequest"]>,
  url: string,
  data: unknown
) {
  if (client.post && typeof client.post === "function") {
    return client.post(url, data, {})
  }
  if (client.request && typeof client.request === "function") {
    return client.request({
      url,
      method: "POST",
      data
    })
  }
  throw new Error("页面 HTTP 客户端未就绪，请刷新小红书页面后再采集")
}

async function enhancedRequest(config: HttpRequestConfig): Promise<HttpResponse> {
  const client = await waitForNativeClient()
  if (
    !client ||
    ((!client.post || typeof client.post !== "function") &&
      (!client.request || typeof client.request !== "function"))
  ) {
    return {
      status: 500,
      statusText: "Error",
      data: null,
      headers: {},
      error: "页面 HTTP 客户端未就绪，请刷新小红书页面后再采集"
    }
  }

  const method = (config.method || "GET").toUpperCase()

  try {
    if (["GET", "DELETE", "HEAD"].includes(method)) {
      const response = client.get
        ? await client.get(config.url, { ...config, method })
        : await client.request?.({ ...config, method })
      const normalized = normalizeNativeResponse(response)
      if (!normalized) {
        return {
          status: 500,
          statusText: "Error",
          data: null,
          headers: {},
          error: "页面未返回数据，请刷新小红书页面后重试"
        }
      }
      return normalized
    }

    if (["POST", "PUT", "PATCH"].includes(method)) {
      const response = await nativePost(client, config.url, config.data)
      const normalized = normalizeNativeResponse(response)
      if (!normalized) {
        return {
          status: 500,
          statusText: "Error",
          data: null,
          headers: {},
          error: "页面未返回数据，请刷新小红书页面后重试"
        }
      }
      return normalized
    }
  } catch (error) {
    const recovered = recoverHttpResponseFromError(error)
    if (recovered) return recovered
    return normalizeRequestError(error)
  }

  return {
    status: 500,
    statusText: "Error",
    data: null,
    headers: {},
    error: "不支持的 HTTP 方法"
  }
}

async function standardRequest(config: HttpRequestConfig): Promise<HttpResponse> {
  const method = (config.method || "GET").toUpperCase()
  const path = config.url.startsWith("http")
    ? new URL(config.url).pathname + new URL(config.url).search
    : config.url
  const signed = await buildSignedHeaders(path, config.data)
  const url = buildUrl(config.url, config.params)

  const origin = location.origin
  const headers: Record<string, string> = {
    accept: "application/json, text/plain, */*",
    "content-type": "application/json",
    origin,
    referer: `${origin}/`,
    ...signed,
    ...config.headers
  }

  const init: RequestInit = {
    method,
    headers,
    credentials: "include",
    mode: "cors"
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

  const body = data as { code?: number; msg?: string; success?: boolean }
  if (body?.code && body.code > 0 && body.code !== 1000) {
    return {
      status: response.status,
      statusText: response.statusText,
      data,
      headers: Object.fromEntries(response.headers.entries()),
      error: body.msg || "接口请求失败"
    }
  }
  if (
    body?.code === -1 &&
    body.success === false &&
    !(data as { data?: unknown }).data
  ) {
    return {
      status: response.status,
      statusText: response.statusText,
      data,
      headers: Object.fromEntries(response.headers.entries()),
      error: body.msg || "接口请求失败，请刷新小红书页面后重试"
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
