import { describe, expect, it } from "vitest"

import {
  extractFeedItemsFromPayload,
  hasInteractCounts,
  isFeedDetailComplete,
  parseFeedNoteCard
} from "./parse-feed-note"

const standardFeedEnvelope = {
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
}

const fullInteractEnvelope = {
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

describe("parseFeedNoteCard", () => {
  it("从 items[0].note_card 解析", () => {
    const parsed = parseFeedNoteCard(standardFeedEnvelope)
    expect(parsed?.note_id).toBe("6a01dd9b000000000702c59f")
    expect(parsed?.interact_info).toMatchObject({ liked_count: "4271" })
  })

  it("完整 interact 样本可解析", () => {
    const parsed = parseFeedNoteCard(fullInteractEnvelope)
    expect(parsed).not.toBeNull()
    expect(isFeedDetailComplete(parsed!)).toBe(true)
    expect(hasInteractCounts(parsed!)).toBe(true)
  })

  it("拒绝仅有 desc 的 INITIAL_STATE 种子", () => {
    const seedLike = {
      note_id: "6a1d10eb000000003701ebf2",
      desc: "仅有 desc 的 INITIAL_STATE 种子",
      user: { nickname: "软西西" }
    }
    expect(parseFeedNoteCard(seedLike)).toBeNull()
  })

  it("已解包 { items } 形状", () => {
    const parsed = parseFeedNoteCard(standardFeedEnvelope.data)
    expect(parsed?.note_id).toBe("6a01dd9b000000000702c59f")
  })
})

describe("extractFeedItemsFromPayload", () => {
  it("从 envelope 提取 items", () => {
    const items = extractFeedItemsFromPayload(standardFeedEnvelope)
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe("6a01dd9b000000000702c59f")
  })
})

describe("hasInteractCounts", () => {
  it("liked_count 字符串为真", () => {
    expect(
      hasInteractCounts({
        interact_info: { liked_count: "2651" }
      })
    ).toBe(true)
  })

  it("仅有 liked:false 无计数为假", () => {
    expect(
      hasInteractCounts({
        interact_info: { liked: false, relation: "none" }
      })
    ).toBe(false)
  })
})

describe("isFeedDetailComplete", () => {
  it("仅有 user_id 无互动为不完整", () => {
    expect(
      isFeedDetailComplete({
        user: { user_id: "5ab32b92e8ac2b65c35cbb4c" },
        image_list: [{ url_default: "http://example.com/1.jpg" }]
      })
    ).toBe(false)
  })

  it("有互动计数为完整", () => {
    expect(
      isFeedDetailComplete({
        interact_info: { liked_count: "1" }
      })
    ).toBe(true)
  })
})
