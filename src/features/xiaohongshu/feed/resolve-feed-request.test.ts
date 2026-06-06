import { describe, expect, it } from "vitest"

import {
  buildFeedRequest,
  resolveFeedNoteId,
  resolveFeedParams
} from "./resolve-feed-request"

const exploreUrl =
  "https://www.xiaohongshu.com/explore/6a1058f5000000000803e331?xsec_token=URL_TOKEN&xsec_source=pc_search"

describe("resolveFeedNoteId", () => {
  it("URL 路径 24 位 id", () => {
    expect(resolveFeedNoteId(exploreUrl)).toBe("6a1058f5000000000803e331")
  })

  it("seed.noteCard.note_id 优先于 seed.id", () => {
    expect(
      resolveFeedNoteId(exploreUrl, {
        id: "6a1058f5000000000803e331",
        noteCard: { note_id: "6a1d10eb000000003701ebf2" }
      })
    ).toBe("6a1d10eb000000003701ebf2")
  })
})

describe("resolveFeedParams", () => {
  it("token 优先级：URL > seed.xsec_token", () => {
    const { token, source } = resolveFeedParams(exploreUrl, {
      xsec_token: "SEED_TOKEN",
      api: "search_notes"
    })
    expect(token).toBe("URL_TOKEN")
    expect(source).toBe("pc_search")
  })

  it("无 URL token 时用 seed.xsec_token", () => {
    const { token } = resolveFeedParams(
      "https://www.xiaohongshu.com/explore/6a1058f5000000000803e331",
      { xsec_token: "SEED_ONLY" }
    )
    expect(token).toBe("SEED_ONLY")
  })

  it("forcePcFeed 覆盖 search 来源", () => {
    const { source } = resolveFeedParams(
      exploreUrl,
      { api: "search_notes" },
      { forcePcFeed: true }
    )
    expect(source).toBe("pc_feed")
  })

  it("homefeed seed 默认 pc_feed", () => {
    const { source } = resolveFeedParams(
      "https://www.xiaohongshu.com/explore/6a1058f5000000000803e331",
      { api: "homefeed_notes" }
    )
    expect(source).toBe("pc_feed")
  })
})

describe("buildFeedRequest", () => {
  it("生成标准 feed POST body", () => {
    const body = buildFeedRequest(
      exploreUrl,
      "6a1058f5000000000803e331",
      { api: "search_notes" }
    )
    expect(body).toEqual({
      source_note_id: "6a1058f5000000000803e331",
      image_formats: ["jpg", "webp", "avif"],
      extra: { need_body_topic: "1" },
      xsec_source: "pc_search",
      xsec_token: "URL_TOKEN"
    })
  })

  it("发现页 forcePcFeed", () => {
    const body = buildFeedRequest(
      exploreUrl,
      "6a1058f5000000000803e331",
      { api: "search_notes" },
      { forcePcFeed: true }
    )
    expect(body.xsec_source).toBe("pc_feed")
  })
})
