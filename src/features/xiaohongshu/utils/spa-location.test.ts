import { describe, expect, it } from "vitest"

import {
  getNoteIdFromPathname,
  isExploreFeedPage,
  isNoteDetailPage,
  isSearchResultPage
} from "./spa-location"

describe("isSearchResultPage", () => {
  it("matches classic search result pages", () => {
    expect(
      isSearchResultPage(
        "https://www.xiaohongshu.com/search_result?keyword=test"
      )
    ).toBe(true)
  })

  it("matches AI search result pages", () => {
    expect(
      isSearchResultPage(
        "https://www.xiaohongshu.com/search_result_ai?keyword=test&source=web_explore_feed"
      )
    ).toBe(true)
  })

  it("does not match explore homepage", () => {
    expect(isSearchResultPage("https://www.xiaohongshu.com/explore")).toBe(false)
  })
})

describe("isExploreFeedPage", () => {
  it("matches plain explore homepage", () => {
    expect(isExploreFeedPage("https://www.xiaohongshu.com/explore")).toBe(true)
  })

  it("matches explore homepage with channel query", () => {
    expect(
      isExploreFeedPage(
        "https://www.xiaohongshu.com/explore?channel_id=homefeed_recommend"
      )
    ).toBe(true)
  })

  it("does not match note detail under explore", () => {
    expect(
      isExploreFeedPage("https://www.xiaohongshu.com/explore/abc123")
    ).toBe(false)
  })

  it("does not match search pages", () => {
    expect(
      isExploreFeedPage("https://www.xiaohongshu.com/search_result?keyword=test")
    ).toBe(false)
  })
})

describe("getNoteIdFromPathname", () => {
  it("extracts note id from explore detail path", () => {
    expect(getNoteIdFromPathname("/explore/abc123")).toBe("abc123")
  })

  it("extracts note id from discovery item path", () => {
    expect(getNoteIdFromPathname("/discovery/item/abc123")).toBe("abc123")
  })

  it("returns empty for explore homepage", () => {
    expect(getNoteIdFromPathname("/explore")).toBe("")
    expect(getNoteIdFromPathname("/explore/")).toBe("")
  })
})

describe("isNoteDetailPage", () => {
  it("matches explore note detail urls", () => {
    expect(
      isNoteDetailPage("https://www.xiaohongshu.com/explore/abc123")
    ).toBe(true)
  })

  it("matches discovery item urls", () => {
    expect(
      isNoteDetailPage("https://www.xiaohongshu.com/discovery/item/abc123")
    ).toBe(true)
  })

  it("does not match explore homepage", () => {
    expect(
      isNoteDetailPage("https://www.xiaohongshu.com/explore?channel_id=homefeed")
    ).toBe(false)
  })

  it("does not match search pages", () => {
    expect(
      isNoteDetailPage("https://www.xiaohongshu.com/search_result?keyword=test")
    ).toBe(false)
  })
})
