import { describe, expect, it } from "vitest"

import {
  isXhsNoteId,
  parseNoteUrl,
  resolveXhsNoteId
} from "./parsers"

describe("isXhsNoteId", () => {
  it("接受 24 位 hex", () => {
    expect(isXhsNoteId("6a1058f5000000000803e331")).toBe(true)
  })

  it("拒绝 UUID", () => {
    expect(isXhsNoteId("435c96ed-d277-4c11-8b5a-0123456789ab")).toBe(false)
  })
})

describe("parseNoteUrl", () => {
  it("从 query 解析 xsec_token", () => {
    const parsed = parseNoteUrl(
      "https://www.xiaohongshu.com/explore/6a1058f5000000000803e331?xsec_token=TOKEN_A&xsec_source=pc_search"
    )
    expect(parsed.id).toBe("6a1058f5000000000803e331")
    expect(parsed.noteId).toBe("6a1058f5000000000803e331")
    expect(parsed.token).toBe("TOKEN_A")
    expect(parsed.source).toBe("pc_search")
  })

  it("从 hash 内 query 解析 xsec_token", () => {
    const parsed = parseNoteUrl(
      "https://www.xiaohongshu.com/explore/435c96ed-d277-4c11-8b5a-0123456789ab#1700000000?xsec_token=HASH_TOKEN&xsec_source=pc_search"
    )
    expect(parsed.token).toBe("HASH_TOKEN")
    expect(parsed.source).toBe("pc_search")
  })

  it("无效路径抛出", () => {
    expect(() => parseNoteUrl("https://www.xiaohongshu.com/user/profile/abc")).toThrow()
  })
})

describe("resolveXhsNoteId", () => {
  it("优先 note_card.note_id", () => {
    expect(
      resolveXhsNoteId(
        { id: "435c96ed-d277-4c11-8b5a-0123456789ab" },
        { note_id: "6a1058f5000000000803e331" }
      )
    ).toBe("6a1058f5000000000803e331")
  })

  it("item UUID 无 note_card 时返回空", () => {
    expect(
      resolveXhsNoteId({ id: "435c96ed-d277-4c11-8b5a-0123456789ab" })
    ).toBe("")
  })
})
