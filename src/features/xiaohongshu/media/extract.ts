const IMAGE_CDN = "https://sns-img-bd.xhscdn.com"
const VIDEO_CDNS = [
  "https://sns-video-bd.xhscdn.com",
  "https://sns-video-hw.xhscdn.com"
]

function getImageRawUrl(image: Record<string, unknown>) {
  const infoList = image.info_list as Array<Record<string, unknown>> | undefined
  return (
    (image.url as string | undefined) ||
    (image.url_default as string | undefined) ||
    (image.url_pre as string | undefined) ||
    (infoList?.[0]?.url as string | undefined)
  )
}

export function buildImageUrl(
  image: Record<string, unknown>,
  format?: string
): string | undefined {
  const raw = getImageRawUrl(image)
  if (!raw) return undefined

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
}

export function buildVideoUrl(video: Record<string, unknown>): string | undefined {
  const consumer = video.consumer as Record<string, unknown> | undefined
  const originKey = consumer?.origin_video_key as string | undefined
  if (originKey) {
    const cdn = VIDEO_CDNS[Math.floor(Math.random() * VIDEO_CDNS.length)]
    return `${cdn}/${originKey}`
  }

  const media = video.media as Record<string, unknown> | undefined
  const stream = media?.stream as
    | Record<string, Array<Record<string, unknown>>>
    | undefined
  if (!stream) return undefined

  const candidates = [...(stream.h265 || []), ...(stream.h264 || [])]
  if (!candidates.length) return undefined

  const sorted = candidates.sort(
    (a, b) => Number(b.size || 0) - Number(a.size || 0)
  )
  return sorted[0]?.master_url as string | undefined
}

export type NoteMediaFile = {
  url: string
  filename: string
  type: "image" | "video" | "cover"
}

export function extractNoteMediaFiles(
  note: Record<string, unknown>,
  noteId: string
): NoteMediaFile[] {
  const files: NoteMediaFile[] = []
  const title = String(note.title || note.display_title || noteId).slice(0, 40)

  if (note.type === "video" && note.video) {
    const videoUrl = buildVideoUrl(note.video as Record<string, unknown>)
    if (videoUrl) {
      files.push({
        url: videoUrl,
        filename: `${title}.mp4`,
        type: "video"
      })
    }
  }

  const imageList = (note.image_list || []) as Array<Record<string, unknown>>
  imageList.forEach((image, index) => {
    const url = buildImageUrl(image, "jpg")
    if (!url) return
    const suffix = imageList.length > 1 ? `-图${index + 1}` : ""
    files.push({
      url,
      filename: `${title}${suffix}.jpg`,
      type: note.type === "video" && index === 0 ? "cover" : "image"
    })
  })

  return files
}
