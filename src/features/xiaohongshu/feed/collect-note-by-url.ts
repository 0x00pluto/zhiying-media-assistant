import { buildNoteExploreUrl, isXhsNoteId, parseNoteUrl, resolveXhsNoteId } from "~features/xiaohongshu/api/parsers"
import {
  fetchCurrNote,
  fetchNoteDetailEntry
} from "~features/xiaohongshu/collectors/single-note"
import {
  applyDomEnrichment,
  flattenNoteCard,
  mergeNoteSources
} from "~features/xiaohongshu/collectors/note-enrich"
import { buildFeedNoteRecord } from "~features/xiaohongshu/records/build-feed-record"
import { resolveVideoUrl } from "~features/xiaohongshu/media/extract"
import { getCachedFeedNoteFromPage, waitForCachedFeedNoteFromPage } from "~shared/messaging"

import { fetchNoteDetail } from "./fetch-note-detail"
import { hasFeedTextContent, hasInteractCounts } from "./parse-feed-note"
import {
  buildFeedRequest,
  resolveFeedNoteId,
  resolveFeedParams,
  type FeedNoteSeed
} from "./resolve-feed-request"

export type CollectNoteScene = "batch" | "single"

export type CollectNoteByUrlOptions = {
  url: string
  seed?: FeedNoteSeed
  forcePcFeed?: boolean
  scene: CollectNoteScene
  pageNote?: Record<string, unknown>
  detailEntry?: Record<string, unknown>
  prefetchedFeedNote?: Record<string, unknown>
  /** feed 拦截缓存已完整时跳过 DOM 富化（含 800ms 视频等待） */
  skipDomEnrichment?: boolean
  host?: string
}

export type CollectNoteByUrlResult = {
  noteId: string
  feedUrl: string
  merged: Record<string, unknown>
  record: Record<string, unknown>
  feedNote?: Record<string, unknown>
  feedError?: string
  userUrl?: string
  commentCount?: number
}

function pageNoteFromSeed(seed?: FeedNoteSeed) {
  if (!seed?.noteCard) return undefined
  return flattenNoteCard(
    {
      ...seed.noteCard,
      note_id: resolveXhsNoteId(undefined, seed.noteCard) || seed.id
    },
    seed.id
  )
}

function buildUserUrl(merged: Record<string, unknown>, host: string) {
  const user = merged.user as Record<string, unknown> | undefined
  if (!user?.user_id) return undefined
  return `${host.startsWith("http") ? host : `https://${host}`}/user/profile/${user.user_id}`
}

function readCommentCount(merged: Record<string, unknown>) {
  const interact = merged.interact_info as Record<string, unknown> | undefined
  if (!interact?.comment_count) return undefined
  const parsed = parseInt(String(interact.comment_count), 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

const CACHE_WAIT_MS = 2000

async function enrichFeedTextFromPage(
  noteId: string,
  pageNote: Record<string, unknown> | undefined,
  feedNote: Record<string, unknown> | undefined,
  detailEntry?: Record<string, unknown>
) {
  let merged = mergeNoteSources(pageNote, feedNote, detailEntry)
  if (hasFeedTextContent(merged)) return merged

  const [currNote, entry] = await Promise.all([
    fetchCurrNote(noteId),
    fetchNoteDetailEntry(noteId)
  ])
  const entryNote = entry?.note as Record<string, unknown> | undefined

  if (currNote || entryNote) {
    merged = mergeNoteSources(pageNote, feedNote, {
      ...(detailEntry || {}),
      ...(entry || {}),
      note: currNote || entryNote
    })
    if (hasFeedTextContent(merged)) return merged
  }

  const cached = await getCachedFeedNoteFromPage(noteId)
  if (cached) {
    merged = mergeNoteSources(pageNote, cached, feedNote)
  }

  return merged
}

/** L3：url + seed + 场景 → 合并后的 note_card 与表格行 */
export async function collectNoteByUrl(
  options: CollectNoteByUrlOptions
): Promise<CollectNoteByUrlResult | null> {
  const host = options.host || "www.xiaohongshu.com"

  let feedNoteId: string
  try {
    feedNoteId = resolveFeedNoteId(options.url, options.seed)
  } catch {
    return null
  }

  if (!isXhsNoteId(feedNoteId)) return null

  const { token, source } = resolveFeedParams(options.url, options.seed, {
    forcePcFeed: options.forcePcFeed
  })
  const feedUrl = token
    ? buildNoteExploreUrl(feedNoteId, token, source, host)
    : options.url

  const feedRequest = buildFeedRequest(feedUrl, feedNoteId, options.seed, {
    forcePcFeed: options.forcePcFeed
  })
  const fetchOptions = {
    prefetchedFeedNote: options.prefetchedFeedNote,
    skipCacheWait: Boolean(options.prefetchedFeedNote)
  }

  const feedResult = await fetchNoteDetail(feedRequest, fetchOptions)

  let feedNote = options.prefetchedFeedNote
  if (feedResult.noteCard) {
    feedNote = feedResult.noteCard
  } else if (!feedNote && feedResult.error) {
    console.warn("[qmc] fetchNoteDetail", feedNoteId, feedResult.error)
  }

  const pageNote =
    options.scene === "batch"
      ? pageNoteFromSeed(options.seed)
      : options.pageNote

  let merged = mergeNoteSources(pageNote, feedNote, options.detailEntry)

  if (!hasFeedTextContent(merged)) {
    merged = await enrichFeedTextFromPage(
      feedNoteId,
      pageNote,
      feedNote,
      options.detailEntry
    )
  }

  if (options.scene === "single" && !options.skipDomEnrichment) {
    merged = await applyDomEnrichment(merged, feedNoteId)

    if (merged.type === "video" && !resolveVideoUrl(merged)) {
      const cached =
        (feedNote && resolveVideoUrl(feedNote) ? feedNote : undefined) ||
        options.prefetchedFeedNote ||
        (await waitForCachedFeedNoteFromPage(feedNoteId, CACHE_WAIT_MS))
      if (cached) {
        merged = mergeNoteSources(pageNote, cached, options.detailEntry)
        merged = await applyDomEnrichment(merged, feedNoteId)
      }
    }
  }

  if (!merged || Object.keys(merged).length === 0) return null

  const noteId = String(merged.note_id || merged.id || feedNoteId)
  const record = buildFeedNoteRecord(merged, noteId, feedUrl)

  return {
    noteId,
    feedUrl,
    merged,
    record,
    feedNote,
    feedError: feedResult.error,
    userUrl: buildUserUrl(merged, host),
    commentCount: readCommentCount(merged)
  }
}

export function shouldWarnFeedOnlySeed(
  feedNote: Record<string, unknown> | undefined,
  merged: Record<string, unknown>
) {
  return !feedNote && Boolean(merged) && !hasInteractCounts(merged)
}

export function shouldWarnFeedMissingText(merged: Record<string, unknown>) {
  return !hasFeedTextContent(merged) && hasInteractCounts(merged)
}

export function parseNoteUrlOrNull(url: string) {
  try {
    return parseNoteUrl(url)
  } catch {
    return null
  }
}
