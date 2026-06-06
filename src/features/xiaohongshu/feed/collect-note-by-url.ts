import { buildNoteExploreUrl, isXhsNoteId, parseNoteUrl, resolveXhsNoteId } from "~features/xiaohongshu/api/parsers"
import {
  applyDomEnrichment,
  flattenNoteCard,
  mergeNoteSources
} from "~features/xiaohongshu/collectors/note-enrich"
import { buildFeedNoteRecord } from "~features/xiaohongshu/records/build-feed-record"

import { fetchNoteDetail } from "./fetch-note-detail"
import { hasInteractCounts } from "./parse-feed-note"
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

  const feedResult = await fetchNoteDetail(
    buildFeedRequest(feedUrl, feedNoteId, options.seed, {
      forcePcFeed: options.forcePcFeed
    })
  )

  let feedNote = options.prefetchedFeedNote
  if (feedResult.noteCard) {
    feedNote = feedResult.noteCard
  }

  const pageNote =
    options.scene === "batch"
      ? pageNoteFromSeed(options.seed)
      : options.pageNote

  let merged = mergeNoteSources(pageNote, feedNote, options.detailEntry)

  if (options.scene === "single") {
    merged = await applyDomEnrichment(merged, feedNoteId)
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

export function parseNoteUrlOrNull(url: string) {
  try {
    return parseNoteUrl(url)
  } catch {
    return null
  }
}
