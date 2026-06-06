import { describe, expect, it } from "vitest"

import {
  normalizeFeedListPayload,
  unwrapXhsResponsePayload
} from "./unwrap-payload"

const feedItemsPayload = {
  items: [
    {
      id: "6a1058f5000000000803e331",
      model_type: "note",
      note_card: {
        note_id: "6a1058f5000000000803e331",
        interact_info: { liked_count: "2651" }
      }
    }
  ],
  current_time: 1780716077045
}

describe("unwrapXhsResponsePayload", () => {
  it("解包 axios 包装 { status, data: envelope }", () => {
    const raw = {
      status: 200,
      data: {
        code: 0,
        success: true,
        data: feedItemsPayload
      }
    }
    expect(unwrapXhsResponsePayload(raw)).toEqual(feedItemsPayload)
  })

  it("解包业务 envelope { code, data }", () => {
    const raw = {
      code: 0,
      success: true,
      data: feedItemsPayload
    }
    expect(unwrapXhsResponsePayload(raw)).toEqual(feedItemsPayload)
  })

  it("已解包 payload 原样返回", () => {
    expect(unwrapXhsResponsePayload(feedItemsPayload)).toEqual(feedItemsPayload)
  })
})

describe("normalizeFeedListPayload", () => {
  it("归一化为含 items 的顶层对象", () => {
    expect(
      normalizeFeedListPayload({
        code: 0,
        data: feedItemsPayload
      })
    ).toEqual(feedItemsPayload)
  })

  it("处理 data.data.items 嵌套", () => {
    expect(
      normalizeFeedListPayload({
        code: 0,
        data: { data: feedItemsPayload }
      })
    ).toEqual(feedItemsPayload)
  })

  it("非对象返回空对象", () => {
    expect(normalizeFeedListPayload(null)).toEqual({})
    expect(normalizeFeedListPayload(undefined)).toEqual({})
  })
})
