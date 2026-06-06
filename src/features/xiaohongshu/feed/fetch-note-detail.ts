import { fetchNoteFeed } from "~features/xiaohongshu/api/client"
import { isCachedFeedNoteUsableForDetail } from "~features/xiaohongshu/collectors/feed-cache"
import {
  enrichInteractFromStatistics,
  flattenNoteCard,
  mergeNoteSources
} from "~features/xiaohongshu/collectors/note-enrich"
import { resolveVideoUrl } from "~features/xiaohongshu/media/extract"
import {
  getCachedFeedNoteFromPage,
  waitForCachedFeedNoteFromPage
} from "~shared/messaging"

import {
  extractFeedItemsFromPayload,
  hasFeedTextContent,
  hasInteractCounts,
  isFeedDetailComplete,
  parseFeedNoteCard
} from "./parse-feed-note"

export type FeedRequestParams = {
  source_note_id: string
  image_formats?: string[]
  extra?: Record<string, string>
  xsec_source?: string
  xsec_token?: string
}

export type FetchNoteDetailOptions = {
  prefetchedFeedNote?: Record<string, unknown>
  /** 已有 prefetched 时不再 wait 轮询 */
  skipCacheWait?: boolean
}

export type FetchNoteDetailResult = {
  noteCard: Record<string, unknown> | null
  error?: string
}

const CACHE_WAIT_MS = 2000

function normalizeParsedNoteCard(
  noteCard: Record<string, unknown>,
  noteId: string
) {
  const flat = flattenNoteCard(noteCard, noteId)
  if (!flat || Object.keys(flat).length === 0) return null

  enrichInteractFromStatistics(flat)

  return {
    ...flat,
    note_id: flat.note_id || flat.id || noteId,
    title: flat.title || flat.display_title
  }
}

function logFeedDebug(
  params: FeedRequestParams,
  raw: unknown,
  noteCard: Record<string, unknown> | null,
  normalized: Record<string, unknown> | null,
  extra?: {
    cache_hit?: boolean
    text_complete?: boolean
    text_cache_hit?: boolean
    api_skipped?: boolean
  }
) {
  const rawObj =
    raw != null && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : undefined
  const items = extractFeedItemsFromPayload(raw)
  const interact = normalized?.interact_info as Record<string, unknown> | undefined

  console.debug("[qmc] fetchNoteDetail", {
    source_note_id: params.source_note_id,
    xsec_source: params.xsec_source,
    token_prefix: params.xsec_token?.slice(0, 8),
    raw_keys: rawObj ? Object.keys(rawObj) : [],
    has_items_array: Array.isArray(rawObj?.items),
    items_length: items.length,
    parsed: Boolean(noteCard),
    liked_count: interact?.liked_count,
    user_id: (normalized?.user as Record<string, unknown> | undefined)?.user_id,
    detail_complete: normalized ? isFeedDetailComplete(normalized) : false,
    text_complete: normalized ? hasFeedTextContent(normalized) : false,
    cache_hit: extra?.cache_hit,
    text_cache_hit: extra?.text_cache_hit,
    api_skipped: extra?.api_skipped
  })
}

function needsPageFeedCacheMerge(apiParsed: Record<string, unknown>) {
  const needsInteract = !hasInteractCounts(apiParsed)
  const needsText = !hasFeedTextContent(apiParsed)
  const needsVideo =
    apiParsed.type === "video" && !resolveVideoUrl(apiParsed)
  return needsInteract || needsText || needsVideo
}

async function readPageFeedCache(
  params: FeedRequestParams,
  options?: FetchNoteDetailOptions
) {
  if (options?.prefetchedFeedNote) return options.prefetchedFeedNote
  if (options?.skipCacheWait) {
    return getCachedFeedNoteFromPage(params.source_note_id)
  }
  return waitForCachedFeedNoteFromPage(params.source_note_id, CACHE_WAIT_MS)
}

async function resolveWithPageFeedCache(
  params: FeedRequestParams,
  apiParsed: Record<string, unknown>,
  options?: FetchNoteDetailOptions
) {
  if (!needsPageFeedCacheMerge(apiParsed)) return apiParsed

  const cached = await readPageFeedCache(params, options)
  if (!cached) return apiParsed

  const merged = mergeNoteSources(cached, apiParsed)
  enrichInteractFromStatistics(merged)
  return merged
}

async function tryReturnFromInterceptCache(
  params: FeedRequestParams,
  options?: FetchNoteDetailOptions
): Promise<FetchNoteDetailResult | null> {
  const cached =
    options?.prefetchedFeedNote ??
    (await getCachedFeedNoteFromPage(params.source_note_id))

  if (!cached) return null

  const normalized = normalizeParsedNoteCard(cached, params.source_note_id)
  if (!normalized || !isCachedFeedNoteUsableForDetail(normalized)) {
    return null
  }

  logFeedDebug(params, null, cached, normalized, {
    cache_hit: true,
    api_skipped: true,
    text_complete: true
  })

  return { noteCard: normalized }
}

/** 统一 v1/feed 拉取 + 多形状解析 */
export async function fetchNoteDetail(
  params: FeedRequestParams,
  options?: FetchNoteDetailOptions
): Promise<FetchNoteDetailResult> {
  try {
    const fromCache = await tryReturnFromInterceptCache(params, options)
    if (fromCache) return fromCache

    const raw = await fetchNoteFeed(params)
    const noteCard = parseFeedNoteCard(raw)

    if (!noteCard) {
      const items = extractFeedItemsFromPayload(raw)
      logFeedDebug(params, raw, null, null)
      if (items.length > 0) {
        return { noteCard: null, error: "feed 成功但未解析 note_card" }
      }
      return { noteCard: null, error: "feed 响应未能解析 note_card" }
    }

    let normalized = normalizeParsedNoteCard(noteCard, params.source_note_id)
    const hadInteract = normalized ? hasInteractCounts(normalized) : false
    const hadText = normalized ? hasFeedTextContent(normalized) : false

    const hadVideo =
      normalized?.type === "video" && Boolean(resolveVideoUrl(normalized))

    if (normalized && needsPageFeedCacheMerge(normalized)) {
      const beforeText = hadText
      const beforeVideo = hadVideo
      normalized = normalizeParsedNoteCard(
        await resolveWithPageFeedCache(params, normalized, options),
        params.source_note_id
      )
      logFeedDebug(params, raw, noteCard, normalized, {
        cache_hit: Boolean(
          normalized &&
            ((!hadInteract && hasInteractCounts(normalized)) ||
              (!beforeVideo &&
                normalized.type === "video" &&
                Boolean(resolveVideoUrl(normalized))))
        ),
        text_complete: normalized ? hasFeedTextContent(normalized) : false,
        text_cache_hit: Boolean(
          normalized && !beforeText && hasFeedTextContent(normalized)
        )
      })
    } else {
      logFeedDebug(params, raw, noteCard, normalized, {
        cache_hit: false,
        text_complete: hadText
      })
    }

    if (!normalized) {
      return { noteCard: null, error: "feed 响应未能解析 note_card" }
    }

    if (!isFeedDetailComplete(normalized)) {
      console.warn(
        "[qmc] feed note_card 不完整",
        params.source_note_id,
        extractFeedItemsFromPayload(raw).length === 0
          ? "raw 无 items，可能误解析为列表种子"
          : "items 存在但 note_card 缺少互动计数"
      )
      return {
        noteCard: null,
        error: "feed 详情缺少互动计数，请检查 Network 中 v1/feed 响应"
      }
    }

    return { noteCard: normalized }
  } catch (error) {
    const message = (error as Error).message?.trim() || "采集失败"
    return { noteCard: null, error: message }
  }
}
