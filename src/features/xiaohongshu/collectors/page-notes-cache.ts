import type { ApiInterceptPayload } from "~shared/messaging/types"
import type { XhsApiType } from "~shared/columns/types"

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
  return `https://${host}/explore/${id}?xsec_token=${token}&xsec_source=${source}`
}

function notifyChange() {
  const count = getPageNotesStore().size
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

  const id = String(
    item.id || item.note_id || item.noteId || noteCard?.note_id || ""
  )
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

function addNote(entry: PageNoteEntry) {
  const store = getPageNotesStore()
  if (!entry.id || store.has(entry.id)) return false
  store.set(entry.id, entry)
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
    if (!id || !token) continue

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
export function scanDomNoteLinks(rootSelector?: string) {
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
      const url = new URL(href, location.origin)
      const match = url.pathname.match(/\/explore\/([^/?]+)/)
      if (!match) continue

      const token = url.searchParams.get("xsec_token") || ""
      if (!token) continue

      addNote({
        id: match[1],
        xsec_token: token,
        url: url.href,
        api: "homefeed_notes"
      })
    } catch {
      // ignore invalid href
    }
  }
}

export function getPageNotes(): PageNoteEntry[] {
  return Array.from(getPageNotesStore().values())
}

export function getPageNoteUrls(): string[] {
  return getPageNotes().map((note) => note.url)
}

export function getPageNotesCount(): number {
  return getPageNotesStore().size
}

export function clearPageNotes() {
  getPageNotesStore().clear()
  notifyChange()
}

export function subscribePageNotes(callback: (count: number) => void) {
  const handler = (event: Event) => {
    const count =
      (event as CustomEvent<{ count: number }>).detail?.count ??
      getPageNotesCount()
    callback(count)
  }

  window.addEventListener(QMC_PAGE_NOTES_CHANGED_EVENT, handler)
  callback(getPageNotesCount())

  return () => window.removeEventListener(QMC_PAGE_NOTES_CHANGED_EVENT, handler)
}
