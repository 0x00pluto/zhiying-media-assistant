const XHS_NOTE_ID_RE = /^[0-9a-f]{24}$/i

/** 小红书笔记 ID：24 位十六进制 */
export function isXhsNoteId(id: unknown): id is string {
  return typeof id === "string" && XHS_NOTE_ID_RE.test(id)
}

function readUrlQueryParams(parsed: URL): URLSearchParams {
  const token = parsed.searchParams.get("xsec_token")
  if (token) return parsed.searchParams

  const hash = parsed.hash
  if (hash.includes("?")) {
    const query = hash.slice(hash.indexOf("?") + 1)
    return new URLSearchParams(query)
  }

  return parsed.searchParams
}

/** 从列表 item / note_card 解析可用于 feed 的 note_id */
export function resolveXhsNoteId(
  item?: Record<string, unknown>,
  noteCard?: Record<string, unknown>
): string {
  const candidates = [
    noteCard?.note_id,
    noteCard?.id,
    item?.note_id,
    item?.noteId,
    item?.id
  ]

  for (const candidate of candidates) {
    if (isXhsNoteId(candidate)) return String(candidate)
  }

  return ""
}

export function buildNoteExploreUrl(
  id: string,
  token: string,
  source: string,
  host = "www.xiaohongshu.com"
) {
  return `https://${host}/explore/${id}?xsec_token=${encodeURIComponent(token)}&xsec_source=${source}`
}

export function parseNoteUrl(url: string) {
  const parsed = new URL(url)
  const match =
    parsed.pathname.match(/\/explore\/([^/?]+)/) ||
    parsed.pathname.match(/\/discovery\/item\/([^/?]+)/)

  if (!match) {
    throw new Error(`无法解析笔记链接: ${url}`)
  }

  const params = readUrlQueryParams(parsed)
  const pathId = match[1]

  return {
    id: pathId,
    noteId: isXhsNoteId(pathId) ? pathId : "",
    token: params.get("xsec_token") || "",
    source: params.get("xsec_source") || "pc_feed"
  }
}

export function parseUserUrl(url: string) {
  const parsed = new URL(url)
  const match = parsed.pathname.match(/\/user\/profile\/([^/?]+)/)

  if (!match) {
    throw new Error(`无法解析博主链接: ${url}`)
  }

  return {
    id: match[1],
    token: parsed.searchParams.get("xsec_token") || "",
    source: parsed.searchParams.get("xsec_source") || "pc_user"
  }
}

export function parseBoardUrl(url: string) {
  const parsed = new URL(url)
  const match = parsed.pathname.match(/\/board\/([^/?]+)/)

  if (!match) {
    throw new Error(`无法解析专辑链接: ${url}`)
  }

  return {
    id: match[1],
    token: parsed.searchParams.get("xsec_token") || ""
  }
}

export function sleep(minSec = 1, maxSec = 3) {
  const ms = (minSec + Math.random() * (maxSec - minSec)) * 1000
  return new Promise((resolve) => setTimeout(resolve, ms))
}
