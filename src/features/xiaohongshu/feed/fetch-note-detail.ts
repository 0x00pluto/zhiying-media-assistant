import { fetchNoteFeed } from "~features/xiaohongshu/api/client"
import {
  enrichInteractFromStatistics,
  flattenNoteCard,
  mergeNoteSources
} from "~features/xiaohongshu/collectors/note-enrich"
import { waitForCachedFeedNoteFromPage } from "~shared/messaging"

import {
  extractFeedItemsFromPayload,
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

export type FetchNoteDetailResult = {
  noteCard: Record<string, unknown> | null
  error?: string
}

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
  extra?: { cache_hit?: boolean }
) {
  const rawObj =
    raw != null && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : undefined
  const items = extractFeedItemsFromPayload(raw)
  const interact = normalized?.interact_info as Record<string, unknown> | undefined

  console.warn("[qmc] fetchNoteDetail", {
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
    cache_hit: extra?.cache_hit
  })
}

async function resolveWithFeedCache(
  params: FeedRequestParams,
  apiParsed: Record<string, unknown>
) {
  if (hasInteractCounts(apiParsed)) return apiParsed

  const cached = await waitForCachedFeedNoteFromPage(params.source_note_id, 2000)
  if (!cached) return apiParsed

  const merged = mergeNoteSources(cached, apiParsed)
  enrichInteractFromStatistics(merged)
  return merged
}

/** 统一 v1/feed 拉取 + 多形状解析 */
export async function fetchNoteDetail(
  params: FeedRequestParams
): Promise<FetchNoteDetailResult> {
  try {
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

    if (normalized && !hadInteract) {
      normalized = normalizeParsedNoteCard(
        await resolveWithFeedCache(params, normalized),
        params.source_note_id
      )
    }

    logFeedDebug(params, raw, noteCard, normalized, {
      cache_hit: Boolean(normalized && !hadInteract && hasInteractCounts(normalized))
    })

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
