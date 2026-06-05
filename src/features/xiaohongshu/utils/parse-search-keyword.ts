/** 搜索页 keyword 可能被双重 URL 编码 */
export function parseSearchKeyword(href = location.href): string {
  const raw = new URL(href).searchParams.get("keyword")?.trim() || ""
  if (!raw) return ""

  let keyword = raw
  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(keyword)
      if (decoded === keyword) break
      keyword = decoded
    } catch {
      break
    }
  }
  return keyword
}
