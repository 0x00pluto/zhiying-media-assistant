import {
  isXhsNoteId,
  parseNoteUrl,
  resolveXhsNoteId
} from "~features/xiaohongshu/api/parsers"
import type { XhsApiType } from "~shared/columns/types"

import type { FeedRequestParams } from "./fetch-note-detail"

export type FeedNoteSeed = {
  id?: string
  url?: string
  xsec_token?: string
  noteCard?: Record<string, unknown>
  api?: XhsApiType
}

type ResolveFeedOptions = {
  forcePcFeed?: boolean
}

function apiToXsecSource(api?: XhsApiType) {
  if (api === "homefeed_notes") return "pc_feed"
  if (api === "search_notes") return "pc_search"
  if (api === "user_posted") return "pc_user"
  if (api === "board_notes") return "pc_board"
  return undefined
}

/** 从 URL + 列表 seed 解析可 feed 的 note_id */
export function resolveFeedNoteId(url: string, seed?: FeedNoteSeed) {
  const parsed = parseNoteUrl(url)
  const fromCard = seed?.noteCard
    ? resolveXhsNoteId(undefined, seed.noteCard)
    : ""
  const fromSeed = seed?.id && isXhsNoteId(seed.id) ? seed.id : ""
  const fromPath = parsed.noteId || (isXhsNoteId(parsed.id) ? parsed.id : "")
  return fromCard || fromSeed || fromPath
}

export function resolveFeedParams(
  url: string,
  seed?: FeedNoteSeed,
  options?: ResolveFeedOptions
) {
  const parsed = parseNoteUrl(url)
  const id = resolveFeedNoteId(url, seed) || parsed.id

  let token = parsed.token
  if (!token && seed?.xsec_token) {
    token = seed.xsec_token
  }
  if (!token && seed?.noteCard?.xsec_token) {
    token = String(seed.noteCard.xsec_token)
  }
  if (!token && seed?.url) {
    try {
      token = parseNoteUrl(seed.url).token
    } catch {
      // ignore
    }
  }

  let source = apiToXsecSource(seed?.api) || parsed.source || "pc_feed"
  if (options?.forcePcFeed) {
    source = "pc_feed"
  }

  return { id, token, source }
}

export function buildFeedRequest(
  url: string,
  feedNoteId: string,
  seed?: FeedNoteSeed,
  options?: ResolveFeedOptions
): FeedRequestParams {
  const { token, source } = resolveFeedParams(url, seed, options)
  const sourceNoteId = isXhsNoteId(feedNoteId)
    ? feedNoteId
    : resolveFeedNoteId(url, seed)

  return {
    source_note_id: sourceNoteId,
    image_formats: ["jpg", "webp", "avif"],
    extra: { need_body_topic: "1" },
    xsec_source: source,
    xsec_token: token
  }
}
