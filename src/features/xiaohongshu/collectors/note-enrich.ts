import { parseUserUrl } from "~features/xiaohongshu/api/parsers"
import { buildImageUrl } from "~features/xiaohongshu/media/extract"

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

function enrichInteractFromStatistics(note: Record<string, unknown>) {
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

function extractImagesFromDom() {
  const urls = new Set<string>()
  const selectors = [
    "#noteContainer .swiper-slide img",
    "#noteContainer .note-slider img",
    "#noteContainer .img-container img",
    "#noteContainer img[src*='xhscdn']"
  ]

  for (const selector of selectors) {
    document.querySelectorAll<HTMLImageElement>(selector).forEach((img) => {
      const src = img.currentSrc || img.src
      if (src && src.includes("xhscdn")) {
        urls.add(src.split("?")[0])
      }
    })
  }

  if (!urls.size) return undefined

  return Array.from(urls).map((url) => ({ url, url_default: url }))
}

function extractVideoFromDom() {
  const video = document.querySelector<HTMLVideoElement>(
    '#noteContainer video[mediatype="video"], #noteContainer video'
  )
  if (!video?.src && !video?.currentSrc) return undefined

  return {
    media: {
      stream: {
        h264: [{ master_url: video.currentSrc || video.src }]
      }
    }
  }
}

function extractCoverFromDom() {
  const images = extractImagesFromDom()
  if (!images?.[0]) return undefined
  const url = buildImageUrl(images[0], "jpg") || images[0].url
  return url ? { url, url_default: url } : undefined
}

/** 合并页面 state 与 feed API 返回的笔记数据，优先保留非空 API 字段 */
export function mergeNoteSources(
  pageNote?: Record<string, unknown>,
  apiNote?: Record<string, unknown>,
  detailEntry?: Record<string, unknown>
) {
  const entryNote = detailEntry?.note as Record<string, unknown> | undefined
  const merged: Record<string, unknown> = {
    ...(pageNote || {}),
    ...(entryNote || {}),
    ...(apiNote || {})
  }

  merged.note_id = preferValue(
    pageNote?.note_id || entryNote?.note_id,
    apiNote?.note_id || apiNote?.id
  )
  merged.title = preferValue(
    pageNote?.title || entryNote?.title,
    apiNote?.title || apiNote?.display_title
  )
  merged.desc = preferValue(pageNote?.desc || entryNote?.desc, apiNote?.desc)
  merged.type = preferValue(pageNote?.type || entryNote?.type, apiNote?.type)
  merged.time = preferValue(pageNote?.time || entryNote?.time, apiNote?.time)
  merged.last_update_time = preferValue(
    pageNote?.last_update_time || entryNote?.last_update_time,
    apiNote?.last_update_time
  )
  merged.ip_location = preferValue(
    pageNote?.ip_location || entryNote?.ip_location,
    apiNote?.ip_location
  )
  merged.image_list = preferValue(
    pageNote?.image_list || entryNote?.image_list,
    apiNote?.image_list
  )
  merged.video = preferValue(pageNote?.video || entryNote?.video, apiNote?.video)
  merged.cover = preferValue(pageNote?.cover || entryNote?.cover, apiNote?.cover)
  merged.tag_list = preferValue(
    pageNote?.tag_list || entryNote?.tag_list,
    apiNote?.tag_list
  )
  merged.hash_tag = preferValue(
    pageNote?.hash_tag || entryNote?.hash_tag,
    apiNote?.hash_tag
  )
  merged.xsec_token = preferValue(
    pageNote?.xsec_token || entryNote?.xsec_token,
    apiNote?.xsec_token
  )
  merged.xsec_source = preferValue(
    pageNote?.xsec_source || entryNote?.xsec_source,
    apiNote?.xsec_source
  )

  const interact = mergeObjects(
    mergeObjects(
      mergeObjects(
        pageNote?.interact_info as Record<string, unknown> | undefined,
        entryNote?.interact_info as Record<string, unknown> | undefined
      ),
      detailEntry?.interact_info as Record<string, unknown> | undefined
    ),
    apiNote?.interact_info as Record<string, unknown> | undefined
  )
  if (interact) merged.interact_info = interact

  const statistics = mergeObjects(
    mergeObjects(
      pageNote?.statistics as Record<string, unknown> | undefined,
      entryNote?.statistics as Record<string, unknown> | undefined
    ),
    apiNote?.statistics as Record<string, unknown> | undefined
  )
  if (statistics) merged.statistics = statistics

  const user = mergeObjects(
    mergeObjects(
      pageNote?.user as Record<string, unknown> | undefined,
      entryNote?.user as Record<string, unknown> | undefined
    ),
    apiNote?.user as Record<string, unknown> | undefined
  )
  if (user) merged.user = user

  return merged
}

export function applyDomEnrichment(note: Record<string, unknown>) {
  enrichInteractFromStatistics(note)

  const domInteract = extractInteractFromDom()
  if (domInteract) {
    const current = (note.interact_info || {}) as Record<string, unknown>
    note.interact_info = { ...current, ...domInteract }
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

  if (!note.type) {
    const hasVideo = document.querySelector(
      '#noteContainer video[mediatype="video"], #noteContainer video'
    )
    note.type = hasVideo ? "video" : "normal"
  }

  if (isEmptyValue(note.image_list)) {
    const images = extractImagesFromDom()
    if (images) note.image_list = images
  }

  if (!note.cover && !isEmptyValue(note.image_list)) {
    const cover = extractCoverFromDom()
    if (cover) note.cover = cover
  }

  if (note.type === "video" && !note.video) {
    const video = extractVideoFromDom()
    if (video) note.video = video
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

export function applyDomInteractFallback(note: Record<string, unknown>) {
  return applyDomEnrichment(note)
}
