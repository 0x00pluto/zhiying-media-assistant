/** feed 形状解析唯一入口（unwrap 见 api/unwrap-payload.ts） */
import { unwrapXhsResponsePayload } from "~features/xiaohongshu/api/unwrap-payload"

function getInteractInfo(note?: Record<string, unknown>) {
  if (!note) return undefined
  const direct = note.interact_info as Record<string, unknown> | undefined
  if (direct && typeof direct === "object") return direct
  const camel = note.interactInfo as Record<string, unknown> | undefined
  if (camel && typeof camel === "object") return camel
  return undefined
}

function isNoteCardLike(value: Record<string, unknown>) {
  return Boolean(
    value.note_id ||
      value.noteId ||
      value.interact_info ||
      value.interactInfo ||
      value.desc ||
      value.image_list ||
      value.user
  )
}

function pickNestedNoteCard(source: Record<string, unknown>) {
  const nested = (source.note_card || source.noteCard) as
    | Record<string, unknown>
    | undefined
  if (nested && typeof nested === "object" && Object.keys(nested).length > 0) {
    return nested
  }
  return undefined
}

/** feed 详情是否可用：须含互动计数（仅有 desc/user/图片的 INITIAL_STATE 种子不算） */
export function isFeedDetailComplete(note?: Record<string, unknown>) {
  if (!note || Object.keys(note).length === 0) return false
  return hasInteractCounts(note)
}

/** 从已解包或原始 feed 响应中提取 items 数组 */
export function extractFeedItemsFromPayload(
  feed: unknown
): Array<Record<string, unknown>> {
  const payload = unwrapXhsResponsePayload(feed) as {
    items?: Array<Record<string, unknown>>
    data?: { items?: Array<Record<string, unknown>> }
  }

  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
}

/**
 * 从 v1/feed 响应解析 note_card，兼容多种解包形状：
 * items[0].note_card / 顶层 note_card / 扁平 note_card（须 isFeedDetailComplete）
 */
export function parseFeedNoteCard(raw: unknown): Record<string, unknown> | null {
  if (raw == null || typeof raw !== "object") return null

  const payload = unwrapXhsResponsePayload(raw) as Record<string, unknown>

  const items = extractFeedItemsFromPayload(payload)
  const firstItem = items[0]
  if (firstItem) {
    const fromItem = pickNestedNoteCard(firstItem)
    if (fromItem) return fromItem
    if (isNoteCardLike(firstItem) && isFeedDetailComplete(firstItem)) {
      return firstItem
    }
  }

  const topNested = pickNestedNoteCard(payload)
  if (topNested) return topNested

  if (isNoteCardLike(payload) && isFeedDetailComplete(payload)) {
    return payload
  }

  return null
}

export function hasInteractCounts(note?: Record<string, unknown>) {
  const interact = getInteractInfo(note)
  if (!interact) return false
  return Boolean(
    interact.liked_count ||
      interact.like_count ||
      interact.collected_count ||
      interact.comment_count ||
      interact.share_count ||
      interact.shared_count
  )
}

/** 开发态自检：标准 feed envelope 与用户提供 curl 样本 */
function assertParseFeedFixtures() {
  const fixtures = [
    {
      code: 0,
      success: true,
      data: {
        items: [
          {
            id: "6a01dd9b000000000702c59f",
            model_type: "note",
            note_card: {
              note_id: "6a01dd9b000000000702c59f",
              interact_info: { liked_count: "4271" },
              desc: "#seventeen[话题]#"
            }
          }
        ]
      }
    },
    {
      code: 0,
      success: true,
      data: {
        items: [
          {
            id: "6a1d10eb000000003701ebf2",
            model_type: "note",
            note_card: {
              note_id: "6a1d10eb000000003701ebf2",
              interact_info: {
                liked_count: "4193",
                collected_count: "1119",
                comment_count: "155",
                share_count: "290"
              },
              user: { user_id: "5f5f835a000000000101ed8d" },
              image_list: [{ url_default: "http://example.com/1.jpg" }]
            }
          }
        ]
      }
    }
  ]

  for (const fixture of fixtures) {
    const parsed = parseFeedNoteCard(fixture)
    if (!parsed || !isFeedDetailComplete(parsed)) {
      console.warn("[qmc] parseFeedNoteCard fixture check failed", fixture)
    }
  }

  const seedLike = {
    note_id: "6a1d10eb000000003701ebf2",
    desc: "仅有 desc 的 INITIAL_STATE 种子",
    user: { nickname: "软西西" }
  }
  if (parseFeedNoteCard(seedLike)) {
    console.warn("[qmc] parseFeedNoteCard should reject seed-like flat card")
  }
}

if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
  assertParseFeedFixtures()
}
