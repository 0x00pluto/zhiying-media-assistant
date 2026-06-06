import { smzsRequest } from "~shared/messaging"
import type { HttpRequestConfig } from "~shared/messaging/types"

import {
  normalizeFeedListPayload,
  normalizeXhsApiKeys,
  unwrapXhsResponsePayload
} from "./unwrap-payload"
import { XHS_ENDPOINTS } from "./endpoints"

export { unwrapXhsResponsePayload } from "./unwrap-payload"

async function xhsRequest<T = unknown>(config: HttpRequestConfig): Promise<T> {
  const response = await smzsRequest({
    enhanced: true,
    ...config
  })

  if (!response) {
    throw new Error("接口请求失败：页面未响应，请刷新小红书页面后重试")
  }

  if (response.error) {
    throw new Error(response.error)
  }

  if (response.data == null || response.data === "") {
    throw new Error("接口未返回数据（连接中断或被小红书限流），请稍后重试")
  }

  if (typeof response.status === "number" && (response.status < 200 || response.status >= 300)) {
    throw new Error(response.error || `接口请求失败（HTTP ${response.status}）`)
  }

  const body = normalizeXhsApiKeys(unwrapXhsResponsePayload(response.data)) as {
    code?: number
    success?: boolean
    data?: T
    msg?: string
    items?: unknown
  }

  if (body && typeof body === "object") {
    const code = body.code
    // 正数错误码（如 300011 风控）视为业务失败；-1 等负数部分接口仍带可用 data
    if (code !== undefined && code > 0 && code !== 1000) {
      throw new Error(body.msg || `接口请求失败（${code}）`)
    }
    if (
      code === -1 &&
      body.success === false &&
      !("data" in body && body.data != null)
    ) {
      throw new Error(body.msg || "接口请求失败，请刷新小红书页面后重试")
    }
    if (body.success === false && body.msg && (code === undefined || code >= 0)) {
      throw new Error(body.msg)
    }
    if ("data" in body && body.data != null) {
      return normalizeXhsApiKeys(body.data) as T
    }
  }

  return body as T
}

export async function fetchNoteFeed(payload: {
  source_note_id: string
  image_formats?: string[]
  extra?: Record<string, string>
  xsec_source?: string
  xsec_token?: string
}) {
  const data = await xhsRequest<Record<string, unknown>>({
    url: XHS_ENDPOINTS.feed,
    method: "POST",
    data: payload
  })
  return normalizeFeedListPayload(data)
}

export async function fetchUserInfo(params: { target_user_id: string }) {
  return xhsRequest({
    url: XHS_ENDPOINTS.userOtherInfo,
    params
  })
}

export async function fetchUserPosted(params: Record<string, string | number>) {
  return xhsRequest({
    url: XHS_ENDPOINTS.userPosted,
    params
  })
}

export async function searchNotes(data: Record<string, unknown>) {
  return xhsRequest<{
    items?: Array<Record<string, unknown>>
    has_more?: boolean
  }>({
    url: XHS_ENDPOINTS.searchNotes,
    method: "POST",
    data
  })
}

export async function searchUsers(params: Record<string, string | number>) {
  return xhsRequest<{
    users?: Array<Record<string, unknown>>
    has_more?: boolean
  }>({
    url: XHS_ENDPOINTS.searchUser,
    params
  })
}

export async function fetchBoardNotes(params: Record<string, string | number>) {
  return xhsRequest({
    url: XHS_ENDPOINTS.boardNotes,
    params
  })
}

export async function fetchComments(params: Record<string, string | number>) {
  return xhsRequest({
    url: XHS_ENDPOINTS.commentPage,
    params
  })
}

export async function fetchSubComments(params: Record<string, string | number>) {
  return xhsRequest({
    url: XHS_ENDPOINTS.commentSubPage,
    params
  })
}

export async function createShortUrl(data: { original_url: string }) {
  return xhsRequest({
    url: XHS_ENDPOINTS.shortUrl,
    method: "POST",
    data
  })
}

export async function fetchHomefeed(data: Record<string, unknown>) {
  return xhsRequest({
    url: XHS_ENDPOINTS.homefeed,
    method: "POST",
    data
  })
}
