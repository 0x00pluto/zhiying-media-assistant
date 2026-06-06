import type { ApiInterceptPayload } from "~shared/messaging/types"
import type { XhsApiType } from "~shared/columns/types"
import {
  isXhsNoteId,
  parseNoteUrl,
  resolveXhsNoteId
} from "~features/xiaohongshu/api/parsers"
import {
  flattenNoteCard,
  mergeNoteSources
} from "~features/xiaohongshu/collectors/note-enrich"

export const QMC_PAGE_NOTES_CHANGED_EVENT = "qmc:page-notes-changed"

export type PageNoteEntry = {
  id: string
  xsec_token: string
  url: string
  api: XhsApiType
  /** 列表 API 拦截到的 note_card，批量采集时可直接复用 */
  noteCard?: Record<string, unknown>
}

declare global {
  interface Window {
    __qmcPageNotesStore?: Map<string, PageNoteEntry>
  }
}

/** CSUI 与 content.ts 分 bundle 打包，store 必须挂 window 才能共享 */
function getPageNotesStore() {
  if (!window.__qmcPageNotesStore) {
    window.__qmcPageNotesStore = new Map<string, PageNoteEntry>()
  }
  return window.__qmcPageNotesStore
}

function getHost() {
  return location.hostname || "www.xiaohongshu.com"
}

function buildNoteUrl(
  id: string,
  token: string,
  source: "pc_feed" | "pc_search" | "pc_user"
) {
  const host = getHost()
  return `https://${host}/explore/${id}?xsec_token=${encodeURIComponent(token)}&xsec_source=${source}`
}

function notifyChange() {
  const count = getCollectiblePageNotesCount()
  window.dispatchEvent(
    new CustomEvent(QMC_PAGE_NOTES_CHANGED_EVENT, {
      detail: { count }
    })
  )
}

function normalizeFeedItem(item: Record<string, unknown>) {
  const noteCard = (item.note_card || item.noteCard) as
    | Record<string, unknown>
    | undefined

  const id = resolveXhsNoteId(item, noteCard)
  const token = String(
    item.xsec_token || item.xsecToken || noteCard?.xsec_token || ""
  )

  return {
    id,
    token,
    noteCard: noteCard || (Object.keys(item).length ? item : undefined)
  }
}

function isNoteFeedItem(item: Record<string, unknown>) {
  if (item.model_type === "note" || item.modelType === "note") return true
  if (item.note_id || item.noteId || item.note_card || item.noteCard) return true
  return Boolean(item.id && (item.xsec_token || item.xsecToken))
}

function mergeEntryNoteCard(
  base?: Record<string, unknown>,
  extra?: Record<string, unknown>
) {
  if (!base && !extra) return undefined
  return mergeNoteSources(flattenNoteCard(base), flattenNoteCard(extra))
}

function mergePageNoteEntry(
  existing: PageNoteEntry,
  incoming: PageNoteEntry
): PageNoteEntry {
  const noteCard = mergeEntryNoteCard(existing.noteCard, incoming.noteCard)
  const preferIncoming =
    incoming.api === "homefeed_notes" && existing.api === "search_notes"

  return {
    id: existing.id,
    xsec_token: incoming.xsec_token || existing.xsec_token,
    url: incoming.url || existing.url,
    api: preferIncoming ? incoming.api : existing.api || incoming.api,
    noteCard
  }
}

function isSamePageNoteEntry(before: PageNoteEntry, after: PageNoteEntry) {
  return (
    before.xsec_token === after.xsec_token &&
    before.url === after.url &&
    before.api === after.api &&
    JSON.stringify(before.noteCard) === JSON.stringify(after.noteCard)
  )
}

function addNote(entry: PageNoteEntry) {
  if (!isXhsNoteId(entry.id)) return false

  const normalized: PageNoteEntry = {
    ...entry,
    noteCard: entry.noteCard
      ? flattenNoteCard(entry.noteCard, entry.id)
      : undefined
  }

  const store = getPageNotesStore()
  const existing = store.get(entry.id)
  if (existing) {
    const merged = mergePageNoteEntry(existing, normalized)
    if (isSamePageNoteEntry(existing, merged)) return false

    store.set(entry.id, merged)
    notifyChange()
    return true
  }

  store.set(entry.id, normalized)
  notifyChange()
  return true
}

function addFromFeedItems(
  items: Array<Record<string, unknown>>,
  source: "pc_feed" | "pc_search"
) {
  for (const item of items) {
    if (!isNoteFeedItem(item)) continue

    const { id, token, noteCard } = normalizeFeedItem(item)
    if (!id || !token) continue

    addNote({
      id,
      xsec_token: token,
      url: buildNoteUrl(id, token, source),
      api: source === "pc_feed" ? "homefeed_notes" : "search_notes",
      noteCard
    })
  }
}

function addFromUserPosted(notes: Array<Record<string, unknown>>) {
  for (const note of notes) {
    const id = String(note.note_id || note.noteId || "")
    const token = String(note.xsec_token || note.xsecToken || "")
    if (!isXhsNoteId(id) || !token) continue

    addNote({
      id,
      xsec_token: token,
      url: buildNoteUrl(id, token, "pc_user"),
      api: "user_posted",
      noteCard: note
    })
  }
}

/** 对齐社媒助手：拦截列表 API 响应，累积本页已加载笔记 */
export function handlePageNotesApiResponse(payload: ApiInterceptPayload) {
  try {
    const pathname = new URL(payload.url).pathname
    const result = payload.result as
      | {
          data?: {
            items?: Array<Record<string, unknown>>
            notes?: Array<Record<string, unknown>>
          }
        }
      | undefined

    if (
      pathname.endsWith("/api/sns/web/v2/homefeed") ||
      pathname.endsWith("/api/sns/web/v1/homefeed")
    ) {
      const items =
        result?.data?.items ||
        ((result as { items?: Array<Record<string, unknown>> })?.items ?? [])
      addFromFeedItems(items, "pc_feed")
      return
    }

    if (
      pathname.endsWith("/api/sns/web/v1/search/notes") ||
      pathname.endsWith("/api/sns/web/v2/search/notes")
    ) {
      const items = result?.data?.items || []
      addFromFeedItems(items, "pc_search")
      return
    }

    if (pathname.endsWith("/api/sns/web/v1/user_posted")) {
      const notes = result?.data?.notes || []
      addFromUserPosted(notes)
    }
  } catch {
    // ignore malformed intercept payload
  }
}

/** 从 __INITIAL_STATE__ 等页面数据引导首批笔记 */
export function bootstrapPageNotesFromFeeds(
  feeds: Array<Record<string, unknown>>
) {
  const notes = feeds.filter(isNoteFeedItem)
  addFromFeedItems(notes, "pc_feed")
}

export function bootstrapPageNotesFromPosted(
  notes: Array<Record<string, unknown>>
) {
  addFromUserPosted(notes)
}

/** DOM 兜底：从已渲染卡片链接提取笔记 */
export function scanDomNoteLinks(
  rootSelector?: string,
  source: "pc_feed" | "pc_search" = "pc_feed"
) {
  const root =
    (rootSelector ? document.querySelector(rootSelector) : null) ||
    document.querySelector("#exploreFeeds") ||
    document.querySelector(".feeds-container") ||
    document
  const anchors = root.querySelectorAll('a[href*="/explore/"]')

  for (const anchor of anchors) {
    const href = anchor.getAttribute("href")
    if (!href) continue

    try {
      const parsed = parseNoteUrl(new URL(href, location.origin).href)
      if (!isXhsNoteId(parsed.id) || !parsed.token) continue

      addNote({
        id: parsed.id,
        xsec_token: parsed.token,
        url: buildNoteUrl(parsed.id, parsed.token, source),
        api: source === "pc_feed" ? "homefeed_notes" : "search_notes"
      })
    } catch {
      // ignore invalid href
    }
  }
}

export function getPageNotes(): PageNoteEntry[] {
  return Array.from(getPageNotesStore().values())
}

/** 仅含可 feed 采集的有效笔记（24 位 note_id） */
export function getCollectiblePageNotes(): PageNoteEntry[] {
  return getPageNotes().filter((note) => isXhsNoteId(note.id))
}

export function getPageNoteUrls(): string[] {
  return getCollectiblePageNotes().map((note) => note.url)
}

export function getPageNotesCount(): number {
  return getPageNotesStore().size
}

export function getCollectiblePageNotesCount(): number {
  return getCollectiblePageNotes().length
}

export function clearPageNotes() {
  getPageNotesStore().clear()
  notifyChange()
}

export function subscribePageNotes(callback: (count: number) => void) {
  const handler = (event: Event) => {
    const count =
      (event as CustomEvent<{ count: number }>).detail?.count ??
      getCollectiblePageNotesCount()
    callback(count)
  }

  window.addEventListener(QMC_PAGE_NOTES_CHANGED_EVENT, handler)
  callback(getCollectiblePageNotesCount())

  return () => window.removeEventListener(QMC_PAGE_NOTES_CHANGED_EVENT, handler)
}
