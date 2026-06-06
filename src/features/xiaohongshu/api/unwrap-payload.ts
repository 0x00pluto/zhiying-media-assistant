/** 页面 webpack axios 常返回 camelCase，demo 用 jT 转 snake_case；此处仅补常见别名 */
const XHS_KEY_ALIASES: ReadonlyArray<readonly [snake: string, camel: string]> = [
  ["has_more", "hasMore"],
  ["xsec_token", "xsecToken"],
  ["sub_comment_has_more", "subCommentHasMore"],
  ["sub_comment_cursor", "subCommentCursor"],
  ["sub_comment_count", "subCommentCount"],
  ["sub_comments", "subComments"],
  ["info_list", "infoList"],
  ["url_default", "urlDefault"],
  ["url_pre", "urlPre"],
  ["image_scene", "imageScene"],
  ["like_count", "likeCount"],
  ["liked_count", "likedCount"],
  ["create_time", "createTime"],
  ["ip_location", "ipLocation"],
  ["user_info", "userInfo"],
  ["user_id", "userId"],
  ["target_comment", "targetComment"],
  ["reply_control", "replyControl"],
  ["nick_name", "nickName"]
]

export function normalizeXhsApiKeys(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object") return raw

  if (Array.isArray(raw)) {
    return raw.map((item) => normalizeXhsApiKeys(item))
  }

  const obj = raw as Record<string, unknown>
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    out[key] = normalizeXhsApiKeys(value)
  }

  for (const [snake, camel] of XHS_KEY_ALIASES) {
    if (out[snake] === undefined && camel in out) {
      out[snake] = out[camel]
    }
  }

  return out
}

/** 统一解包小红书 API 响应（axios 包装 / 业务 envelope / 已解包 payload） */
export function unwrapXhsResponsePayload(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object") return raw

  const value = raw as Record<string, unknown>

  if (
    typeof value.status === "number" &&
    value.status >= 100 &&
    value.status < 600 &&
    "data" in value &&
    value.data !== undefined
  ) {
    return unwrapXhsResponsePayload(value.data)
  }

  if (
    typeof value.code === "number" &&
    "data" in value &&
    value.data != null &&
    typeof value.data === "object"
  ) {
    return value.data
  }

  return raw
}

/** v1/feed 专用：归一化为含 items 的业务层（与 curl 解包后 { items, current_time } 对齐） */
export function normalizeFeedListPayload(raw: unknown): Record<string, unknown> {
  if (raw == null || typeof raw !== "object") {
    return {}
  }

  let payload = unwrapXhsResponsePayload(raw) as Record<string, unknown>

  if (
    typeof payload.code === "number" &&
    payload.data != null &&
    typeof payload.data === "object"
  ) {
    payload = payload.data as Record<string, unknown>
  }

  if (Array.isArray(payload.items)) {
    return payload
  }

  const nested = payload.data as Record<string, unknown> | undefined
  if (nested && Array.isArray(nested.items)) {
    return nested
  }

  return payload
}
