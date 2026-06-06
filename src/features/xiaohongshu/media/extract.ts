const IMAGE_CDN = "https://sns-img-bd.xhscdn.com"
const VIDEO_CDNS = [
  "https://sns-video-hw.xhscdn.com",
  "https://sns-video-bd.xhscdn.com"
]

function isAvatarImageUrl(url?: string) {
  if (!url) return false
  return url.includes("/avatar/") || url.includes("sns-avatar-")
}

function getImageRawUrl(image: Record<string, unknown>) {
  const infoList = image.info_list as Array<Record<string, unknown>> | undefined
  const candidates = [
    image.url as string | undefined,
    image.url_default as string | undefined,
    image.url_pre as string | undefined,
    infoList?.[0]?.url as string | undefined
  ]
  return candidates.find((url) => url && !isAvatarImageUrl(url))
}

export function buildImageUrl(
  image: Record<string, unknown>,
  format?: string
): string | undefined {
  const raw = getImageRawUrl(image)
  if (!raw) return undefined

  try {
    const parts = new URL(raw).pathname.split("/").filter(Boolean).reverse()
    let path = parts[0]?.split("!")[0]
    if (!path) return undefined

    if (parts.length >= 4) {
      for (let i = 1; i < parts.length - 2; i++) {
        path = `${parts[i]}/${path}`
      }
    }

    const base = `${IMAGE_CDN}/${path}`
    return format ? `${base}?imageView2/format/${format}` : base
  } catch {
    if (/^https?:\/\//.test(raw)) return raw
    return undefined
  }
}

function isValidVideoUrl(url: unknown): url is string {
  if (typeof url !== "string" || !url.trim()) return false
  if (url.startsWith("blob:")) return false
  return /^https?:\/\//.test(url)
}

function pickStreamItemUrl(item: Record<string, unknown>) {
  const backup = item.backup_urls as string[] | undefined
  const url = (item.master_url || item.url || backup?.[0]) as string | undefined
  return isValidVideoUrl(url) ? url : undefined
}

function getStreamItems(video: Record<string, unknown>) {
  const media = video.media as Record<string, unknown> | undefined
  const stream = media?.stream as
    | Record<string, Array<Record<string, unknown>>>
    | undefined
  if (!stream) return []

  const items = [
    ...(stream.h266 || []),
    ...(stream.h265 || []),
    ...(stream.h264 || []),
    ...(stream.av1 || [])
  ]

  const nonWatermark = items.filter((item) => {
    const desc = item.stream_desc as string | undefined
    return !desc?.startsWith("WM_")
  })

  return nonWatermark.length ? nonWatermark : items
}

function pickBestStreamUrl(items: Array<Record<string, unknown>>) {
  if (!items.length) return undefined

  const sorted = [...items].sort(
    (a, b) => Number(b.size || 0) - Number(a.size || 0)
  )
  for (const item of sorted) {
    const url = pickStreamItemUrl(item)
    if (url) return url
  }
  return undefined
}

/** 页面 state 可能只有 media_v2 字符串，Feed 则有完整 media.stream */
export function normalizeVideoObject(video: Record<string, unknown>) {
  const media = (video.media || {}) as Record<string, unknown>
  const stream = media.stream as
    | Record<string, Array<Record<string, unknown>>>
    | undefined
  if (stream?.h264?.length || stream?.h265?.length) {
    return video
  }

  const mediaV2 = video.media_v2
  if (typeof mediaV2 !== "string" || !mediaV2.trim()) {
    return video
  }

  try {
    const parsed = JSON.parse(mediaV2) as {
      stream?: Record<string, Array<Record<string, unknown>>>
    }
    if (!parsed.stream) return video

    return {
      ...video,
      media: {
        ...media,
        stream: parsed.stream
      }
    }
  } catch {
    return video
  }
}

/** 对齐原版 tBe：origin_video_key → h265 → h264 */
export function buildVideoUrl(video: Record<string, unknown>): string | undefined {
  const normalized = normalizeVideoObject(video)
  const consumer = normalized.consumer as Record<string, unknown> | undefined
  const originKey = consumer?.origin_video_key as string | undefined
  if (originKey) {
    const cdn = VIDEO_CDNS[Math.floor(Math.random() * VIDEO_CDNS.length)]
    const url = `${cdn}/${originKey}`
    if (isValidVideoUrl(url)) return url
  }

  const media = normalized.media as Record<string, unknown> | undefined
  const stream = media?.stream as
    | Record<string, Array<Record<string, unknown>>>
    | undefined
  if (!stream) return undefined

  const h265Url = pickBestStreamUrl(stream.h265 || [])
  if (h265Url) return h265Url

  const h264Url = pickBestStreamUrl(stream.h264 || [])
  if (h264Url) return h264Url

  return pickBestStreamUrl(getStreamItems(normalized))
}

export function resolveVideoUrl(note: Record<string, unknown>): string | undefined {
  const video = note.video as Record<string, unknown> | undefined
  if (!video) return undefined
  return buildVideoUrl(normalizeVideoObject(video))
}

/** 对齐原版 note_cover：视频笔记封面取 image_list[0] */
export function resolveCoverUrl(note: Record<string, unknown>): string | undefined {
  const cover = note.cover as Record<string, unknown> | undefined
  const coverRaw =
    cover?.url || cover?.url_default || cover?.url_pre
  if (coverRaw) {
    const built = buildImageUrl(
      typeof cover === "object" && cover ? cover : { url: coverRaw },
      "jpg"
    )
    if (built) return built
    if (typeof coverRaw === "string" && /^https?:\/\//.test(coverRaw)) {
      return coverRaw
    }
  }

  const imageList = note.image_list as Array<Record<string, unknown>> | undefined
  const first = imageList?.[0]
  if (first) {
    const url = buildImageUrl(first, "jpg")
    if (url) return url
    const raw = getImageRawUrl(first)
    if (typeof raw === "string" && /^https?:\/\//.test(raw)) return raw
  }

  return undefined
}

export type NoteMediaFile = {
  url: string
  filename: string
  type: "image" | "video" | "cover"
}

export type ExtractNoteMediaOptions = {
  /** 视频笔记下载：仅返回 mp4，不包含封面/图片 */
  videoOnly?: boolean
}

export function extractVideoFile(
  note: Record<string, unknown>,
  noteId: string
): NoteMediaFile | undefined {
  const title = String(note.title || note.display_title || noteId).slice(0, 40)
  const videoUrl = resolveVideoUrl(note)
  if (!videoUrl) return undefined
  return {
    url: videoUrl,
    filename: `${title}.mp4`,
    type: "video"
  }
}

export function extractNoteMediaFiles(
  note: Record<string, unknown>,
  noteId: string,
  options?: ExtractNoteMediaOptions
): NoteMediaFile[] {
  if (options?.videoOnly) {
    const video = extractVideoFile(note, noteId)
    return video ? [video] : []
  }

  const files: NoteMediaFile[] = []
  const title = String(note.title || note.display_title || noteId).slice(0, 40)

  const videoUrl = resolveVideoUrl(note)
  if (videoUrl) {
    files.push({
      url: videoUrl,
      filename: `${title}.mp4`,
      type: "video"
    })
  }

  const coverUrl = resolveCoverUrl(note)
  if (coverUrl) {
    files.push({
      url: coverUrl,
      filename: `${title}-封面.jpg`,
      type: "cover"
    })
  }

  const imageList = (note.image_list || []) as Array<Record<string, unknown>>
  imageList.forEach((image, index) => {
    if (note.type === "video" && index === 0 && coverUrl) return
    const url = buildImageUrl(image, "jpg")
    if (!url) return
    const suffix = imageList.length > 1 ? `-图${index + 1}` : ""
    files.push({
      url,
      filename: `${title}${suffix}.jpg`,
      type: "image"
    })
  })

  return files
}
