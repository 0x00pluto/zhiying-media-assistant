import { parseUserUrl, resolveXhsNoteId } from "~features/xiaohongshu/api/parsers"
import {
  buildImageUrl,
  buildVideoUrl,
  normalizeVideoObject,
  resolveCoverUrl,
  resolveVideoUrl
} from "~features/xiaohongshu/media/extract"
import { hasInteractCounts } from "~features/xiaohongshu/feed/parse-feed-note"
import { getWindowValue } from "~shared/messaging"

function isEmptyValue(value: unknown) {
  if (value === undefined || value === null || value === "") return true
  if (Array.isArray(value) && value.length === 0) return true
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) {
    return true
  }
  return false
}

function preferValue<T>(page?: T, api?: T) {
  if (!isEmptyValue(api)) return api
  if (!isEmptyValue(page)) return page
  return undefined
}

function mergeStreamLists(
  base?: Array<Record<string, unknown>>,
  extra?: Array<Record<string, unknown>>
) {
  if (!base?.length) return extra
  if (!extra?.length) return base
  return [...base, ...extra]
}

function mergeVideoObjects(
  ...sources: Array<Record<string, unknown> | undefined>
) {
  const merged: Record<string, unknown> = {}

  for (const source of sources) {
    if (!source) continue

    const currentMedia = (merged.media || {}) as Record<string, unknown>
    const sourceMedia = (source.media || {}) as Record<string, unknown>
    const currentStream = (currentMedia.stream || {}) as Record<
      string,
      Array<Record<string, unknown>>
    >
    const sourceStream = (sourceMedia.stream || {}) as Record<
      string,
      Array<Record<string, unknown>>
    >

    merged.media = {
      ...currentMedia,
      ...sourceMedia,
      stream: {
        ...currentStream,
        h266: mergeStreamLists(currentStream.h266, sourceStream.h266),
        h265: mergeStreamLists(currentStream.h265, sourceStream.h265),
        h264: mergeStreamLists(currentStream.h264, sourceStream.h264),
        av1: mergeStreamLists(currentStream.av1, sourceStream.av1)
      }
    }

    const currentConsumer = (merged.consumer || {}) as Record<string, unknown>
    const sourceConsumer = (source.consumer || {}) as Record<string, unknown>
    merged.consumer = { ...currentConsumer, ...sourceConsumer }

    for (const [key, value] of Object.entries(source)) {
      if (key === "media" || key === "consumer") continue
      if (!isEmptyValue(value)) merged[key] = value
    }
  }

  return Object.keys(merged).length ? merged : undefined
}

function pickResolvableVideo(
  ...candidates: Array<Record<string, unknown> | undefined>
) {
  for (const candidate of candidates) {
    if (candidate && buildVideoUrl(normalizeVideoObject(candidate))) {
      return normalizeVideoObject(candidate)
    }
  }

  const merged = mergeVideoObjects(...candidates)
  if (merged && buildVideoUrl(normalizeVideoObject(merged))) {
    return normalizeVideoObject(merged)
  }

  for (const candidate of candidates) {
    if (!isEmptyValue(candidate)) return candidate
  }
  return undefined
}

function mergeObjects<T extends Record<string, unknown>>(
  base?: T,
  extra?: T
): T | undefined {
  if (!base && !extra) return undefined
  const merged = { ...(base || {}) } as T
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (!isEmptyValue(value)) {
        merged[key as keyof T] = value as T[keyof T]
      }
    }
  }
  return merged
}

function readCountText(element: Element | null | undefined) {
  const text = element?.textContent?.trim()
  if (!text || text === "赞" || text === "收藏" || text === "评论" || text === "分享") {
    return undefined
  }
  return text
}

function parseCountFromLabel(element: Element | null | undefined) {
  if (!element) return undefined
  const label = element.getAttribute("aria-label") || element.getAttribute("title") || ""
  const matched = label.match(/([\d.+万千wkWK,]+)/)
  return matched?.[1]
}

function findCountInWrapper(root: Element, keywords: string[]) {
  const wrappers = root.querySelectorAll<HTMLElement>("[class]")
  for (const wrapper of wrappers) {
    const className = wrapper.className?.toString() || ""
    if (!keywords.some((keyword) => className.includes(keyword))) continue

    const countEl =
      wrapper.querySelector(".count") ||
      wrapper.querySelector("span[class*='count']") ||
      Array.from(wrapper.querySelectorAll("span")).find((span) =>
        /^[\d.+万千wkWK,]+$/.test(span.textContent?.trim() || "")
      )

    const text =
      readCountText(countEl) ||
      parseCountFromLabel(wrapper) ||
      parseCountFromLabel(countEl)
    if (text) return text
  }
  return undefined
}

/** 从笔记弹层 DOM 读取点赞/收藏/评论等互动数据 */
export function extractInteractFromDom() {
  const root =
    document.querySelector("#noteContainer .interaction-container") ||
    document.querySelector("#noteContainer .engage-bar") ||
    document.querySelector("#noteContainer")

  if (!root) return undefined

  const interact: Record<string, string> = {}

  const liked =
    readCountText(root.querySelector(".like-wrapper .count")) ||
    findCountInWrapper(root, ["like-wrapper", "like"])
  const collected =
    readCountText(root.querySelector(".collect-wrapper .count")) ||
    findCountInWrapper(root, ["collect-wrapper", "collect"])
  const commented =
    readCountText(root.querySelector(".chat-wrapper .count")) ||
    findCountInWrapper(root, ["chat-wrapper", "chat", "comment"])
  const shared =
    readCountText(root.querySelector(".share-wrapper .count")) ||
    findCountInWrapper(root, ["share-wrapper", "share"])

  if (liked) interact.liked_count = liked
  if (collected) interact.collected_count = collected
  if (commented) interact.comment_count = commented
  if (shared) {
    interact.shared_count = shared
    interact.share_count = shared
  }

  return Object.keys(interact).length ? interact : undefined
}

export function extractTopicsFromDesc(desc?: string) {
  if (!desc) return undefined
  const topics = [
    ...desc.matchAll(/#([^#\n\[]+)\[话题\]#/g),
    ...desc.matchAll(/#([^#\n\[]+)\[话题\]/g)
  ]
    .map((match) => match[1]?.trim())
    .filter(Boolean) as string[]

  return topics.length ? [...new Set(topics)] : undefined
}

function extractTopicsFromDom() {
  const topics = new Set<string>()
  const selectors = [
    '#noteContainer a[href*="/search_result"]',
    '#noteContainer a[href*="keyword="]',
    '#noteContainer .tag',
    '#noteContainer [class*="tag"]'
  ]

  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((element) => {
      const text = element.textContent?.trim().replace(/^#/, "")
      if (text && text.length < 50 && !["话题", "搜索"].includes(text)) {
        topics.add(text)
      }
    })
  }

  return topics.size ? [...topics] : undefined
}

export function normalizeTopicList(
  tagList: unknown,
  desc?: string
): string[] | undefined {
  if (Array.isArray(tagList) && tagList.length) {
    const topics = tagList
      .map((tag) => {
        if (typeof tag === "string") return tag
        const item = tag as { type?: string; name?: string }
        if (item.type && item.type !== "topic") return undefined
        return item.name
      })
      .filter(Boolean) as string[]
    if (topics.length) return [...new Set(topics)]
  }

  return extractTopicsFromDesc(desc)
}

export function enrichInteractFromStatistics(note: Record<string, unknown>) {
  const interact = ((note.interact_info || {}) as Record<string, unknown>) || {}
  const statistics = note.statistics as Record<string, unknown> | undefined
  if (!statistics) return note

  const pairs: Array<[string, string]> = [
    ["liked_count", "liked_count"],
    ["collected_count", "collected_count"],
    ["comment_count", "comment_count"],
    ["share_count", "share_count"],
    ["share_count", "shared_count"]
  ]

  for (const [interactKey, statsKey] of pairs) {
    if (isEmptyValue(interact[interactKey]) && !isEmptyValue(statistics[statsKey])) {
      interact[interactKey] = statistics[statsKey]
    }
  }

  note.interact_info = interact
  return note
}

function extractUserFromDom() {
  const link = document.querySelector<HTMLAnchorElement>(
    '#noteContainer a[href*="/user/profile/"]'
  )
  if (!link?.href) return undefined

  try {
    const parsed = parseUserUrl(link.href)
    const nickname =
      link.textContent?.trim() ||
      document
        .querySelector(
          "#noteContainer .username, #noteContainer .name, #noteContainer .author-wrapper .name"
        )
        ?.textContent?.trim()

    return {
      user_id: parsed.id,
      xsec_token: parsed.token,
      xsec_source: parsed.source,
      nickname: nickname || undefined
    }
  } catch {
    return undefined
  }
}

function extractIpFromDom() {
  const candidates = document.querySelectorAll(
    "#noteContainer .date, #noteContainer .location, #noteContainer .bottom-container, #noteContainer .note-content"
  )

  for (const element of candidates) {
    const text = element.textContent?.trim() || ""
    const ipMatch = text.match(/IP属地[：:]\s*([^\s]+)/)
    if (ipMatch?.[1]) return ipMatch[1]

    const locationMatch = text.match(
      /(?:^|[\s\d天小时分钟前-]+)\s*([\u4e00-\u9fa5]{2,}(?:省|市|区|县)?)\s*$/
    )
    if (locationMatch?.[1] && !["视频", "图文", "笔记"].includes(locationMatch[1])) {
      return locationMatch[1]
    }
  }

  return undefined
}

function isAvatarImage(img: HTMLImageElement) {
  const src = img.currentSrc || img.src
  if (src.includes("/avatar/")) return true
  if (img.closest(".author-container, .avatar, [class*='avatar']")) return true
  return false
}

function extractImagesFromDom() {
  const urls = new Set<string>()
  const selectors = [
    "#noteContainer .swiper-slide img",
    "#noteContainer .note-slider img",
    "#noteContainer .img-container img",
    "#noteContainer .player-container img",
    "#noteContainer .video-container img"
  ]

  for (const selector of selectors) {
    document.querySelectorAll<HTMLImageElement>(selector).forEach((img) => {
      if (isAvatarImage(img)) return
      const src = img.currentSrc || img.src
      if (src && src.includes("xhscdn") && !src.includes("/avatar/")) {
        urls.add(src.split("?")[0])
      }
    })
  }

  if (!urls.size) return undefined

  return Array.from(urls).map((url) => ({ url, url_default: url }))
}

function isUsableDomVideoUrl(url?: string) {
  if (!url || url.startsWith("blob:")) return false
  return /^https?:\/\//.test(url) && url.includes("xhscdn")
}

function isLikelyVideoResourceUrl(url: string) {
  if (!isUsableDomVideoUrl(url)) return false
  if (url.includes("sns-video")) return true
  return url.includes("/stream/") && /\.mp4(\?|$)/i.test(url)
}

function collectResourceVideoUrls() {
  const urls: string[] = []
  try {
    const entries = performance.getEntriesByType(
      "resource"
    ) as PerformanceResourceTiming[]
    for (const entry of entries) {
      if (isLikelyVideoResourceUrl(entry.name)) {
        urls.push(entry.name)
      }
    }
  } catch {
    // performance API unavailable
  }
  return urls
}

function collectDomVideoUrls() {
  const urls: string[] = [...collectResourceVideoUrls()]
  const video = document.querySelector<HTMLVideoElement>(
    '#noteContainer video[mediatype="video"], #noteContainer video'
  )
  if (!video) return urls

  const direct = video.currentSrc || video.src
  if (isUsableDomVideoUrl(direct)) urls.push(direct)

  video.querySelectorAll<HTMLSourceElement>("source").forEach((source) => {
    const src = source.src
    if (isUsableDomVideoUrl(src)) urls.push(src)
  })

  return [...new Set(urls)]
}

function buildVideoObjectFromUrl(url: string) {
  return {
    media: {
      stream: {
        h264: [{ master_url: url }]
      }
    }
  }
}

async function extractVideoFromState(noteId?: string) {
  if (!noteId) return undefined

  const result = await getWindowValue({
    video: ["__INITIAL_STATE__", "note", "noteDetailMap", noteId, "note", "video"]
  })
  const stateVideo = result?.video as Record<string, unknown> | undefined
  if (stateVideo && buildVideoUrl(stateVideo)) return stateVideo

  return undefined
}

async function extractVideoFromDom(noteId?: string) {
  let domUrls = collectDomVideoUrls()
  if (!domUrls.length) {
    await new Promise((resolve) => window.setTimeout(resolve, 800))
    domUrls = collectDomVideoUrls()
  }

  if (domUrls.length) {
    return buildVideoObjectFromUrl(domUrls[0])
  }

  return extractVideoFromState(noteId)
}

function extractCoverFromDom() {
  const images = extractImagesFromDom()
  if (!images?.[0]) return undefined
  const url = buildImageUrl(images[0], "jpg") || images[0].url
  return url ? { url, url_default: url } : undefined
}

function mergeInteractInfo(
  primary?: Record<string, unknown>,
  secondary?: Record<string, unknown>
) {
  const merged = mergeObjects(primary, secondary)
  if (merged && hasInteractCounts({ interact_info: merged })) {
    return merged
  }
  return mergeObjects(secondary, primary)
}

/** 将列表 item / 嵌套 note_card 提升为扁平 note_card，供列定义与 merge 使用 */
export function flattenNoteCard(
  noteCard?: Record<string, unknown>,
  noteId?: string
): Record<string, unknown> | undefined {
  if (!noteCard || Object.keys(noteCard).length === 0) return undefined

  const nested = (noteCard.note_card || noteCard.noteCard) as
    | Record<string, unknown>
    | undefined

  const flat: Record<string, unknown> = nested
    ? {
        ...noteCard,
        ...nested,
        note_id:
          resolveXhsNoteId(undefined, nested) ||
          resolveXhsNoteId(undefined, noteCard) ||
          noteCard.note_id ||
          noteCard.id ||
          noteId
      }
    : { ...noteCard }

  delete flat.note_card
  delete flat.noteCard

  if (nested) {
    const outerInteract = noteCard.interact_info as Record<string, unknown> | undefined
    const innerInteract = nested.interact_info as Record<string, unknown> | undefined
    const mergedInteract = mergeInteractInfo(outerInteract, innerInteract)
    if (mergedInteract) {
      flat.interact_info = mergedInteract
    }
  }

  if (noteId && !flat.note_id && !flat.id) {
    flat.note_id = noteId
  }
  if (!flat.title && flat.display_title) {
    flat.title = flat.display_title
  }

  return flat
}

/** 合并页面 state 与 feed API 返回的笔记数据，优先保留非空 API 字段 */
export function mergeNoteSources(
  pageNote?: Record<string, unknown>,
  apiNote?: Record<string, unknown>,
  detailEntry?: Record<string, unknown>
) {
  const flatPage = flattenNoteCard(pageNote)
  const flatApi = flattenNoteCard(apiNote)
  const entryNote = detailEntry?.note as Record<string, unknown> | undefined
  const flatEntry = flattenNoteCard(entryNote)
  const merged: Record<string, unknown> = {
    ...(flatPage || {}),
    ...(flatEntry || {}),
    ...(flatApi || {})
  }

  merged.note_id = preferValue(
    flatPage?.note_id || flatEntry?.note_id,
    flatApi?.note_id || flatApi?.id
  )
  merged.title = preferValue(
    flatPage?.title || flatEntry?.title,
    flatApi?.title || flatApi?.display_title
  )
  merged.desc = preferValue(flatPage?.desc || flatEntry?.desc, flatApi?.desc)
  merged.type = preferValue(flatPage?.type || flatEntry?.type, flatApi?.type)
  merged.time = preferValue(flatPage?.time || flatEntry?.time, flatApi?.time)
  merged.last_update_time = preferValue(
    flatPage?.last_update_time || flatEntry?.last_update_time,
    flatApi?.last_update_time
  )
  merged.ip_location = preferValue(
    flatPage?.ip_location || flatEntry?.ip_location,
    flatApi?.ip_location
  )
  merged.image_list = preferValue(
    flatApi?.image_list,
    flatPage?.image_list || flatEntry?.image_list
  )
  merged.video = pickResolvableVideo(
    flatApi?.video as Record<string, unknown> | undefined,
    flatEntry?.video as Record<string, unknown> | undefined,
    flatPage?.video as Record<string, unknown> | undefined,
    detailEntry?.video as Record<string, unknown> | undefined
  )
  merged.cover = preferValue(flatPage?.cover || flatEntry?.cover, flatApi?.cover)
  merged.tag_list = preferValue(
    flatPage?.tag_list || flatEntry?.tag_list,
    flatApi?.tag_list
  )
  merged.hash_tag = preferValue(
    flatPage?.hash_tag || flatEntry?.hash_tag,
    flatApi?.hash_tag
  )
  merged.xsec_token = preferValue(
    flatPage?.xsec_token || flatEntry?.xsec_token,
    flatApi?.xsec_token
  )
  merged.xsec_source = preferValue(
    flatPage?.xsec_source || flatEntry?.xsec_source,
    flatApi?.xsec_source
  )

  const interact = mergeObjects(
    mergeObjects(
      mergeObjects(
        flatPage?.interact_info as Record<string, unknown> | undefined,
        flatEntry?.interact_info as Record<string, unknown> | undefined
      ),
      detailEntry?.interact_info as Record<string, unknown> | undefined
    ),
    flatApi?.interact_info as Record<string, unknown> | undefined
  )
  if (interact) merged.interact_info = interact

  const statistics = mergeObjects(
    mergeObjects(
      flatPage?.statistics as Record<string, unknown> | undefined,
      flatEntry?.statistics as Record<string, unknown> | undefined
    ),
    flatApi?.statistics as Record<string, unknown> | undefined
  )
  if (statistics) merged.statistics = statistics

  const user = mergeObjects(
    mergeObjects(
      flatPage?.user as Record<string, unknown> | undefined,
      flatEntry?.user as Record<string, unknown> | undefined
    ),
    flatApi?.user as Record<string, unknown> | undefined
  )
  if (user) merged.user = user

  return merged
}

export async function applyDomEnrichment(
  note: Record<string, unknown>,
  noteId?: string
) {
  enrichInteractFromStatistics(note)

  const domInteract = extractInteractFromDom()
  if (domInteract) {
    const current = (note.interact_info || {}) as Record<string, unknown>
    const merged = { ...current }
    for (const [key, value] of Object.entries(domInteract)) {
      if (isEmptyValue(merged[key]) && !isEmptyValue(value)) {
        merged[key] = value
      }
    }
    note.interact_info = merged
  }

  const domUser = extractUserFromDom()
  if (domUser) {
    const current = (note.user || {}) as Record<string, unknown>
    note.user = mergeObjects(current, domUser) || domUser
  }

  if (!note.ip_location) {
    const ip = extractIpFromDom()
    if (ip) note.ip_location = ip
  }

  const hasVideoElement = document.querySelector(
    '#noteContainer video[mediatype="video"], #noteContainer video'
  )
  if (hasVideoElement) {
    note.type = "video"
  } else if (!note.type) {
    note.type = "normal"
  }

  if (isEmptyValue(note.image_list)) {
    const images = extractImagesFromDom()
    if (images) note.image_list = images
  }

  if (!resolveCoverUrl(note)) {
    const cover = extractCoverFromDom()
    if (cover) note.cover = cover
  }

  if (isEmptyValue(note.image_list) && note.type === "video") {
    const cover = extractCoverFromDom()
    if (cover) {
      note.image_list = [{ url: cover.url, url_default: cover.url }]
    }
  }

  const needsVideo =
    note.type === "video" && !resolveVideoUrl(note)

  if (needsVideo) {
    const domVideo = await extractVideoFromDom(noteId)
    if (domVideo) {
      note.video =
        mergeObjects(
          note.video as Record<string, unknown> | undefined,
          domVideo
        ) || domVideo
    }
  }

  if (isEmptyValue(note.tag_list)) {
    const descTopics = extractTopicsFromDesc(note.desc as string | undefined)
    const domTopics = extractTopicsFromDom()
    const topics = [...new Set([...(descTopics || []), ...(domTopics || [])])]
    if (topics.length) {
      note.tag_list = topics.map((name) => ({ type: "topic", name }))
    }
  }

  return note
}

export async function applyDomInteractFallback(
  note: Record<string, unknown>,
  noteId?: string
) {
  return applyDomEnrichment(note, noteId)
}
