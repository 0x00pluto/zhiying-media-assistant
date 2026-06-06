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

export function extractFeedItems(feed: unknown): Array<Record<string, unknown>> {
  const payload = unwrapXhsResponsePayload(feed) as {
    items?: Array<Record<string, unknown>>
    data?: { items?: Array<Record<string, unknown>> }
  }

  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
}

/** 对齐社媒助手：items[0].note_card */
export function extractNoteCardFromFeedPayload(feed: unknown) {
  const item = extractFeedItems(feed)[0]
  if (!item) return undefined

  return (item.note_card || item.noteCard) as Record<string, unknown> | undefined
}

export function recoverHttpDataFromAxiosError(error: unknown): unknown {
  const err = error as { response?: { data?: unknown } }
  const data = err.response?.data
  if (!data || typeof data !== "object") return undefined

  const body = data as {
    code?: number
    success?: boolean
    items?: unknown
    data?: unknown
  }

  if (
    body.code === 0 ||
    body.success === true ||
    Array.isArray(body.items) ||
    (body.data != null && typeof body.data === "object")
  ) {
    return data
  }

  return undefined
}
