import {
  parseFeedNoteCard,
  extractFeedItemsFromPayload
} from "~features/xiaohongshu/feed/parse-feed-note"

import { unwrapXhsResponsePayload } from "./unwrap-payload"

export { unwrapXhsResponsePayload } from "./unwrap-payload"

/** @deprecated 请使用 extractFeedItemsFromPayload */
export const extractFeedItems = extractFeedItemsFromPayload

/** @deprecated 请使用 parseFeedNoteCard；保留兼容 feed-cache 等旧引用 */
export function extractNoteCardFromFeedPayload(feed: unknown) {
  return parseFeedNoteCard(feed) ?? undefined
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
