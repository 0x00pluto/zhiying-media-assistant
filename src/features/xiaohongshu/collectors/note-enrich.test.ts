import { describe, expect, it } from "vitest"

import { hasInteractCounts } from "~features/xiaohongshu/feed/parse-feed-note"

import { flattenNoteCard } from "./note-enrich"

describe("flattenNoteCard", () => {
  it("nested interact 无计数时不覆盖 outer liked_count", () => {
    const flat = flattenNoteCard(
      {
        note_id: "6a1058f5000000000803e331",
        interact_info: {
          liked_count: "2651",
          collected_count: "417"
        },
        note_card: {
          title: "测试标题",
          interact_info: {
            liked: false,
            collected: false,
            relation: "none"
          }
        }
      },
      "6a1058f5000000000803e331"
    )

    expect(flat?.title).toBe("测试标题")
    expect(flat?.interact_info).toMatchObject({
      liked_count: "2651",
      collected_count: "417"
    })
    expect(hasInteractCounts(flat!)).toBe(true)
  })

  it("扁平 note_card 原样提升", () => {
    const flat = flattenNoteCard({
      note_id: "6a01dd9b000000000702c59f",
      interact_info: { liked_count: "4271" }
    })
    expect(flat?.note_id).toBe("6a01dd9b000000000702c59f")
    expect(hasInteractCounts(flat!)).toBe(true)
  })

  it("空对象返回 undefined", () => {
    expect(flattenNoteCard({})).toBeUndefined()
    expect(flattenNoteCard(undefined)).toBeUndefined()
  })
})
