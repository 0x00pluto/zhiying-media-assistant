import { fetchNoteFeed } from "~features/xiaohongshu/api/client"
import { extractNoteCardFromFeedPayload } from "~features/xiaohongshu/api/response"
import { parseNoteUrl } from "~features/xiaohongshu/api/parsers"
import { NOTE_COLUMNS } from "~features/xiaohongshu/columns/note"
import {
  getCachedFeedNote,
  waitForCachedFeedNote
} from "~features/xiaohongshu/collectors/feed-cache"
import {
  applyDomEnrichment,
  mergeNoteSources
} from "~features/xiaohongshu/collectors/note-enrich"
import { getWindowValue } from "~shared/messaging"

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

async function fetchNoteDetailEntry(noteId: string) {
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

async function fetchNoteFromApi(
  noteId: string,
  noteUrl: string,
  pageNote?: Record<string, unknown>
) {
  let token = ""
  let source = "pc_feed"

  try {
    const parsed = parseNoteUrl(noteUrl)
    token = parsed.token
    source = parsed.source
  } catch {
    // URL 不含 token 时从页面数据补全
  }

  if (!token && pageNote?.xsec_token) {
    token = String(pageNote.xsec_token)
  }
  if (!source || source === "pc_feed") {
    source = String(pageNote?.xsec_source || source || "pc_feed")
  }

  const feed = await fetchNoteFeed({
    source_note_id: noteId,
    image_formats: ["jpg", "webp", "avif"],
    extra: { need_body_topic: "1" },
    xsec_source: source,
    xsec_token: token
  })

  const noteCard = extractNoteCardFromFeedPayload(feed)
  if (!noteCard) return undefined

  return {
    ...noteCard,
    note_id: noteCard.note_id || noteCard.id || noteId,
    title: noteCard.title || noteCard.display_title
  }
}

export function buildNoteRecord(
  rawNote: Record<string, unknown>,
  noteId: string,
  pageUrl: string
) {
  const record: Record<string, unknown> = {}

  for (const column of NOTE_COLUMNS) {
    if (!column.apis.includes("feed")) continue
    const value = column.handle({
      data: rawNote,
      api: "feed",
      pageUrl
    })
    if (value !== undefined) {
      record[column.key] = value
    }
  }

  if (!record.note_id) {
    record.note_id = rawNote.note_id || noteId
  }
  if (!record.url) {
    record.url = pageUrl
  }

  return record
}

export async function collectSingleNote(noteId?: string) {
  const id = resolveNoteId(noteId)
  if (!id) {
    throw new Error("无法识别笔记 ID")
  }

  const noteUrl = resolveNoteUrl(id)
  const [pageNote, detailEntry] = await Promise.all([
    fetchCurrNote(id),
    fetchNoteDetailEntry(id)
  ])

  const cachedFeedNote = await waitForCachedFeedNote(id)
  let feedNote = cachedFeedNote

  try {
    const apiFeedNote = await fetchNoteFromApi(id, noteUrl, pageNote)
    if (apiFeedNote) feedNote = apiFeedNote
  } catch (error) {
    console.warn("feed 接口补充笔记信息失败", error)
  }

  let rawNote = mergeNoteSources(pageNote, feedNote, detailEntry || undefined)
  rawNote = await applyDomEnrichment(rawNote, id)

  if (!rawNote || Object.keys(rawNote).length === 0) {
    throw new Error("获取笔记信息失败，请刷新页面后重试")
  }

  const record = buildNoteRecord(rawNote, id, noteUrl)
  const user = rawNote.user as Record<string, unknown> | undefined
  const userUrl = user?.user_id
    ? `${location.origin}/user/profile/${user.user_id}`
    : undefined

  const interact = rawNote.interact_info as Record<string, unknown> | undefined
  let commentCount: number | undefined
  if (interact?.comment_count) {
    const parsed = parseInt(String(interact.comment_count), 10)
    if (!Number.isNaN(parsed)) commentCount = parsed
  }

  return {
    noteId: id,
    noteUrl,
    userUrl,
    rawNote,
    record,
    commentCount
  }
}

export async function copyNoteInfo(noteId?: string) {
  const { record } = await collectSingleNote(noteId)
  const columns = NOTE_COLUMNS.filter((c) => c.default !== false)
  const header = columns.map((c) => c.name).join("\t")
  const row = columns
    .map((c) => {
      const value = record[c.key]
      if (Array.isArray(value)) return value.join(";")
      return value ?? ""
    })
    .join("\t")

  await navigator.clipboard.writeText(`${header}\n${row}`)
  return record
}
