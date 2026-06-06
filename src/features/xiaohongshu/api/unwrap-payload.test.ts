import { describe, expect, it } from "vitest"

import {
  normalizeFeedListPayload,
  normalizeXhsApiKeys,
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

describe("normalizeXhsApiKeys", () => {
  it("将 comment/page 常见 camelCase 分页字段补为 snake_case", () => {
    expect(
      normalizeXhsApiKeys({
        comments: [{ id: "1" }],
        hasMore: true,
        cursor: "abc",
        xsecToken: "token-2"
      })
    ).toEqual({
      comments: [{ id: "1" }],
      hasMore: true,
      has_more: true,
      cursor: "abc",
      xsecToken: "token-2",
      xsec_token: "token-2"
    })
  })

  it("已有 snake_case 时不覆盖", () => {
    expect(
      normalizeXhsApiKeys({
        has_more: false,
        hasMore: true
      })
    ).toEqual({
      has_more: false,
      hasMore: true
    })
  })

  it("comment pictures 常见 camelCase 补为 snake_case", () => {
    expect(
      normalizeXhsApiKeys({
        pictures: [
          {
            urlPre: "https://sns-webpic-qc.xhscdn.com/pre.jpg",
            infoList: [{ imageScene: "WB_DFT", url: "https://example.com/d.jpg" }]
          }
        ]
      })
    ).toEqual({
      pictures: [
        {
          urlPre: "https://sns-webpic-qc.xhscdn.com/pre.jpg",
          url_pre: "https://sns-webpic-qc.xhscdn.com/pre.jpg",
          infoList: [
            {
              imageScene: "WB_DFT",
              image_scene: "WB_DFT",
              url: "https://example.com/d.jpg"
            }
          ],
          info_list: [
            {
              imageScene: "WB_DFT",
              image_scene: "WB_DFT",
              url: "https://example.com/d.jpg"
            }
          ]
        }
      ]
    })
  })

  it("comment/page 评论对象 camelCase 补为 snake_case", () => {
    const normalized = normalizeXhsApiKeys({
      comments: [
        {
          id: "c1",
          content: "test",
          likeCount: 3,
          createTime: 1744262400000,
          ipLocation: "北京",
          userInfo: { userId: "u1", nickname: "昵称" },
          subCommentCount: 2,
          targetComment: { id: "t1", content: "reply target" }
        }
      ],
      hasMore: false
    }) as {
      comments: Array<Record<string, unknown>>
      has_more: boolean
    }

    const comment = normalized.comments[0]
    expect(comment.like_count).toBe(3)
    expect(comment.create_time).toBe(1744262400000)
    expect(comment.ip_location).toBe("北京")
    expect(comment.sub_comment_count).toBe(2)
    expect(normalized.has_more).toBe(false)

    const userInfo = comment.user_info as Record<string, unknown>
    expect(userInfo.user_id).toBe("u1")
    expect(userInfo.nickname).toBe("昵称")

    const target = comment.target_comment as Record<string, unknown>
    expect(target.id).toBe("t1")
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
