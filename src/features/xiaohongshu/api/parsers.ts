export function parseNoteUrl(url: string) {
  const parsed = new URL(url)
  const match =
    parsed.pathname.match(/\/explore\/([^/?]+)/) ||
    parsed.pathname.match(/\/discovery\/item\/([^/?]+)/)

  if (!match) {
    throw new Error(`无法解析笔记链接: ${url}`)
  }

  return {
    id: match[1],
    token: parsed.searchParams.get("xsec_token") || "",
    source: parsed.searchParams.get("xsec_source") || "pc_feed"
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
