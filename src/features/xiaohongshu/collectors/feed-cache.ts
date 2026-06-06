import type { ApiInterceptPayload } from "~shared/messaging/types"

import { flattenNoteCard } from "~features/xiaohongshu/collectors/note-enrich"
import {
  extractFeedItemsFromPayload,
  hasFeedTextContent,
  hasInteractCounts,
  parseFeedNoteCard
} from "~features/xiaohongshu/feed/parse-feed-note"
import { resolveVideoUrl } from "~features/xiaohongshu/media/extract"

const feedNoteCache = new Map<string, Record<string, unknown>>()

/** 对齐原版 MRe：拦截页面发起的 feed 请求，缓存完整 note_card */
export function handleFeedApiResponse(payload: ApiInterceptPayload) {
  try {
    const url = new URL(payload.url)
    if (!url.pathname.endsWith("/api/sns/web/v1/feed")) return

    const result = payload.result
    const parsed = parseFeedNoteCard(result)
    if (!parsed || Object.keys(parsed).length === 0) return

    const body = payload.body as { source_note_id?: string } | undefined
    const items = extractFeedItemsFromPayload(result)
    const itemId = items[0]?.id
    const noteId =
      body?.source_note_id ||
      (parsed.note_id as string | undefined) ||
      (itemId != null ? String(itemId) : undefined)
    if (!noteId) return

    const noteCard = flattenNoteCard(parsed, noteId) || parsed
    feedNoteCache.set(noteId, noteCard)
  } catch {
    // ignore malformed intercept payload
  }
}

export function getCachedFeedNote(noteId: string) {
  return feedNoteCache.get(noteId)
}

/** 页面 feed 拦截缓存是否可直接用于单条笔记采集（跳过重复 API） */
export function isCachedFeedNoteUsableForDetail(noteCard: Record<string, unknown>) {
  if (!noteCard || Object.keys(noteCard).length === 0) return false
  if (!hasInteractCounts(noteCard)) return false
  if (!hasFeedTextContent(noteCard)) return false
  if (noteCard.type === "video" && !resolveVideoUrl(noteCard)) return false
  return true
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
