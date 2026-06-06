import { parseNoteUrl } from "~features/xiaohongshu/api/parsers"
import { NOTE_COLUMNS } from "~features/xiaohongshu/columns/note"
import {
  extractInteractFromDom,
  mergeNoteSources
} from "~features/xiaohongshu/collectors/note-enrich"
import { isCachedFeedNoteUsableForDetail } from "~features/xiaohongshu/collectors/feed-cache"
import { collectNoteByUrl } from "~features/xiaohongshu/feed/collect-note-by-url"
import { buildFeedNoteRecord } from "~features/xiaohongshu/records/build-feed-record"
import {
  getCachedFeedNoteFromPage,
  getWindowValue,
  waitForCachedFeedNoteFromPage
} from "~shared/messaging"

export { buildFeedNoteRecord as buildNoteRecord }

const FEED_CACHE_WAIT_MS = 2000

function parseCommentCount(value?: string) {
  if (!value) return undefined
  const normalized = value.replace(/[^\d]/g, "")
  if (!normalized) return undefined
  const parsed = parseInt(normalized, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

function readCommentCountFromDom() {
  const interact = extractInteractFromDom()
  const fromInteract = parseCommentCount(interact?.comment_count)
  if (fromInteract) return fromInteract

  const root = document.querySelector("#noteContainer")
  const match = root?.textContent?.match(/共\s*([\d.+万千wkWK,]+)\s*条评论/)
  return parseCommentCount(match?.[1])
}

function readNoteTitleFromDom(noteId: string) {
  const selectors = [
    "#noteContainer .title",
    "#noteContainer .note-text",
    "#noteContainer [class*='note-title']",
    "#noteContainer [class*='title']"
  ]
  for (const selector of selectors) {
    const text = document.querySelector(selector)?.textContent?.trim()
    if (text && text.length < 200) return text
  }
  return `笔记 ${noteId}`
}

/** 导出评论跳转所需的最小上下文（无需完整 feed 采集） */
export function resolveCommentExportContext(noteId?: string) {
  const id = resolveNoteId(noteId)
  if (!id) {
    throw new Error("无法识别笔记 ID")
  }

  return {
    noteId: id,
    noteUrl: resolveNoteUrl(id),
    title: readNoteTitleFromDom(id),
    commentCount: readCommentCountFromDom()
  }
}

type NoteDetailEntry = {
  note?: Record<string, unknown>
}

export function getNoteIdFromLocation(url = location.href): string {
  try {
    return parseNoteUrl(url).id
  } catch {
    const segments = new URL(url).pathname.split("/").filter(Boolean)
    const last = segments[segments.length - 1] || ""
    if (last && !["explore", "discovery", "item"].includes(last)) {
      return last
    }
  }
  return ""
}

function getNoteLinkFromDom(noteId?: string) {
  const selectors = noteId
    ? [
        `#noteContainer a[href*="/explore/${noteId}"]`,
        `#noteContainer a[href*="/discovery/item/${noteId}"]`
      ]
    : [
        '#noteContainer a[href*="/explore/"]',
        '#noteContainer a[href*="/discovery/item/"]'
      ]

  for (const selector of selectors) {
    const link = document.querySelector<HTMLAnchorElement>(selector)
    if (!link?.href) continue
    try {
      const parsed = parseNoteUrl(link.href)
      if (!noteId || parsed.id === noteId) {
        return link.href
      }
    } catch {
      // ignore invalid href
    }
  }

  return ""
}

export function getNoteIdFromDom(): string {
  const href = getNoteLinkFromDom()
  if (!href) return ""

  try {
    return parseNoteUrl(href).id
  } catch {
    return ""
  }
}

export function resolveNoteId(noteId?: string): string {
  return noteId || getNoteIdFromLocation() || getNoteIdFromDom()
}

/** 弹层场景下 location 可能不含 token，优先从 DOM 链接解析完整笔记 URL */
export function resolveNoteUrl(noteId?: string) {
  const id = resolveNoteId(noteId)
  if (!id) return location.href

  try {
    const parsed = parseNoteUrl(location.href)
    if (parsed.id === id && parsed.token) {
      return location.href
    }
  } catch {
    // location 不是标准笔记链接
  }

  const domHref = getNoteLinkFromDom(id)
  if (domHref) return domHref

  return location.href
}

export function detectNoteMediaType(): "video" | "normal" {
  return document.querySelector('#noteContainer video[mediatype="video"]')
    ? "video"
    : "normal"
}

async function readNoteDetailMap() {
  const result = await getWindowValue({
    noteDetailMap: ["__INITIAL_STATE__", "note", "noteDetailMap"]
  })
  return (result?.noteDetailMap || null) as Record<string, NoteDetailEntry> | null
}

export async function fetchNoteDetailEntry(noteId: string) {
  const result = await getWindowValue({
    entry: ["__INITIAL_STATE__", "note", "noteDetailMap", noteId]
  })
  return (result?.entry || null) as Record<string, unknown> | null
}

export async function fetchCurrNote(noteId: string) {
  const byId = await getWindowValue({
    currNote: ["__INITIAL_STATE__", "note", "noteDetailMap", noteId, "note"]
  })
  const direct = byId?.currNote as Record<string, unknown> | undefined
  if (direct && Object.keys(direct).length > 0) return direct
  return undefined
}

export async function fetchNoteFromPage(noteId: string) {
  const direct = await fetchCurrNote(noteId)
  const entry = await fetchNoteDetailEntry(noteId)
  const entryNote = entry?.note as Record<string, unknown> | undefined

  if (direct && Object.keys(direct).length > 0) {
    return mergeNoteSources(direct, undefined, entry || undefined)
  }

  const map = await readNoteDetailMap()
  const mapNote = map?.[noteId]?.note
  if (mapNote) {
    return mergeNoteSources(mapNote, undefined, entry || undefined)
  }

  const keys = Object.keys(map || {})
  if (keys.length === 1 && map![keys[0]]?.note) {
    return mergeNoteSources(map![keys[0]].note, undefined, entry || undefined)
  }

  if (entryNote) {
    return mergeNoteSources(entryNote, undefined, entry || undefined)
  }

  return undefined
}

async function resolveFeedCacheForCollect(noteId: string) {
  let cached = await getCachedFeedNoteFromPage(noteId)
  if (cached && isCachedFeedNoteUsableForDetail(cached)) {
    return cached
  }

  if (!cached) {
    cached = await waitForCachedFeedNoteFromPage(noteId, FEED_CACHE_WAIT_MS)
    if (cached && isCachedFeedNoteUsableForDetail(cached)) {
      return cached
    }
  }

  return cached
}

function buildCollectResult(
  id: string,
  noteUrl: string,
  result: NonNullable<Awaited<ReturnType<typeof collectNoteByUrl>>>
) {
  if (result.feedError) {
    console.warn("[qmc] fetchNoteDetail failed", id, result.feedError)
  }

  return {
    noteId: result.noteId,
    noteUrl,
    userUrl: result.userUrl,
    rawNote: result.merged,
    record: result.record,
    commentCount: result.commentCount
  }
}

export async function collectSingleNote(noteId?: string) {
  const id = resolveNoteId(noteId)
  if (!id) {
    throw new Error("无法识别笔记 ID")
  }

  const noteUrl = resolveNoteUrl(id)
  const cachedFeedNote = await resolveFeedCacheForCollect(id)

  if (cachedFeedNote && isCachedFeedNoteUsableForDetail(cachedFeedNote)) {
    const result = await collectNoteByUrl({
      url: noteUrl,
      scene: "single",
      prefetchedFeedNote: cachedFeedNote,
      skipDomEnrichment: true,
      host: location.origin
    })

    if (!result) {
      throw new Error("获取笔记信息失败，请刷新页面后重试")
    }

    return buildCollectResult(id, noteUrl, result)
  }

  const [pageNote, detailEntry] = await Promise.all([
    fetchCurrNote(id),
    fetchNoteDetailEntry(id)
  ])

  let result
  try {
    result = await collectNoteByUrl({
      url: noteUrl,
      scene: "single",
      pageNote,
      detailEntry: detailEntry || undefined,
      prefetchedFeedNote: cachedFeedNote,
      host: location.origin
    })
  } catch (error) {
    console.warn("feed 接口补充笔记信息失败", error)
    throw error
  }

  if (!result) {
    throw new Error("获取笔记信息失败，请刷新页面后重试")
  }

  return buildCollectResult(id, noteUrl, result)
}

export function formatNoteInfoTsv(record: Record<string, unknown>) {
  const columns = NOTE_COLUMNS.filter((c) => c.default !== false)
  const header = columns.map((c) => c.name).join("\t")
  const row = columns
    .map((c) => {
      const value = record[c.key]
      if (Array.isArray(value)) return value.join(";")
      return value ?? ""
    })
    .join("\t")

  return `${header}\n${row}`
}

export async function copyNoteInfo(
  noteId?: string,
  record?: Record<string, unknown>
) {
  const resolved = record ?? (await collectSingleNote(noteId)).record
  await navigator.clipboard.writeText(formatNoteInfoTsv(resolved))
  return resolved
}
