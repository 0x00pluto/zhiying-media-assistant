import { fetchForJson } from "~shared/messaging"

import { feishuConfigStorage } from "./storage"

const FEISHU_BASE = "https://open.feishu.cn"

let cachedToken = ""
let tokenExpireAt = 0

export async function getTenantAccessToken(force = false): Promise<string> {
  if (!force && cachedToken && Date.now() < tokenExpireAt) {
    return cachedToken
  }

  const config = await feishuConfigStorage.get()
  if (!config.appId || !config.appSecret) {
    throw new Error("请先配置飞书 App ID 与 App Secret")
  }

  const data = await fetchForJson<{
    code?: number
    tenant_access_token?: string
    expire?: number
    msg?: string
    __error?: string
  }>(`${FEISHU_BASE}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: config.appId,
      app_secret: config.appSecret
    })
  })

  if (data.__error) {
    if (data.__error === "Failed to fetch") {
      throw new Error(
        "飞书网络请求失败，请确认扩展已重载、可访问 open.feishu.cn，且已在选项页配置 App ID/Secret"
      )
    }
    throw new Error(data.__error)
  }

  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(data.msg || "获取飞书 access_token 失败")
  }

  cachedToken = data.tenant_access_token
  tokenExpireAt = Date.now() + ((data.expire || 7200) - 300) * 1000
  return cachedToken
}

export async function feishuRequest<T = unknown>(
  path: string,
  init?: {
    method?: string
    body?: unknown
    retry?: boolean
  }
): Promise<T> {
  const token = await getTenantAccessToken(init?.retry)
  const response = await fetchForJson<{
    code: number
    data?: T
    msg?: string
    __error?: string
  }>(`${FEISHU_BASE}${path}`, {
    method: init?.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: init?.body ? JSON.stringify(init.body) : undefined
  })

  if (response.__error) {
    if (response.__error === "Failed to fetch") {
      throw new Error(
        "飞书网络请求失败，请确认扩展已重载、可访问 open.feishu.cn，且已在选项页配置 App ID/Secret"
      )
    }
    throw new Error(response.__error)
  }

  if (response.code === 99991663 && !init?.retry) {
    return feishuRequest(path, { ...init, retry: true })
  }

  if (response.code !== 0) {
    const detail = (response as { error?: { message?: string } }).error?.message
    const message = [response.msg, detail].filter(Boolean).join("：")
    throw new Error(message || "飞书请求失败")
  }

  return response.data as T
}
