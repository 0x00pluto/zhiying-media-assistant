/** 统一解包小红书 API 响应（axios 包装 / 业务 envelope / 已解包 payload） */
export function unwrapXhsResponsePayload(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object") return raw

  const value = raw as Record<string, unknown>

  if (
    typeof value.status === "number" &&
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
