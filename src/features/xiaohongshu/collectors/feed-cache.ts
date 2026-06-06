import type { ApiInterceptPayload } from "~shared/messaging/types"

import { extractFeedItems, extractNoteCardFromFeedPayload } from "~features/xiaohongshu/api/response"

const feedNoteCache = new Map<string, Record<string, unknown>>()

/** 对齐原版 MRe：拦截页面发起的 feed 请求，缓存完整 note_card */
export function handleFeedApiResponse(payload: ApiInterceptPayload) {
  try {
    const url = new URL(payload.url)
    if (!url.pathname.endsWith("/api/sns/web/v1/feed")) return

    const result = payload.result
    const noteCard = extractNoteCardFromFeedPayload(result)
    if (!noteCard || Object.keys(noteCard).length === 0) return

    const body = payload.body as { source_note_id?: string } | undefined
    const itemId = extractFeedItems(result)[0]?.id
    const noteId =
      body?.source_note_id ||
      (noteCard.note_id as string | undefined) ||
      (itemId != null ? String(itemId) : undefined)
    if (!noteId) return

    feedNoteCache.set(noteId, noteCard)
  } catch {
    // ignore malformed intercept payload
  }
}

export function getCachedFeedNote(noteId: string) {
  return feedNoteCache.get(noteId)
}

/** 笔记弹层打开后 feed 请求可能稍晚返回，短暂等待拦截缓存 */
export async function waitForCachedFeedNote(noteId: string, timeoutMs = 2500) {
  const immediate = getCachedFeedNote(noteId)
  if (immediate) return immediate

  return new Promise<Record<string, unknown> | undefined>((resolve) => {
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      const cached = getCachedFeedNote(noteId)
      if (cached || Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(timer)
        resolve(cached)
      }
    }, 120)
  })
}

export function clearFeedNoteCache(noteId?: string) {
  if (noteId) {
    feedNoteCache.delete(noteId)
    return
  }
  feedNoteCache.clear()
}
