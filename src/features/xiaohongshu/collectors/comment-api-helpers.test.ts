import { describe, expect, it } from "vitest"

import {
  getCommentIpLocation,
  getCommentLikeCount,
  getCommentPictureUrls,
  getCommentUserInfo,
  needsSubCommentFetch,
  parseCommentList,
  shouldDegradeCommentPage
} from "./comment-api-helpers"

const USER_CDN_URL_PRE =
  "https://sns-webpic-qc.xhscdn.com/202606061831/6db97d586e2fc1e10ad540a088875ee4/comment/1040g2h0320rd37tv5k7045jh9mnccglfl3envl0!nc_n_webp_mw_1"

describe("getCommentUserInfo", () => {
  it("从 userInfo camelCase 读取 user_id 与 nickname", () => {
    expect(
      getCommentUserInfo({
        userInfo: { userId: "u1", nickname: "昵称" }
      })
    ).toEqual({ user_id: "u1", nickname: "昵称" })
  })

  it("兼容 nickName 变体", () => {
    expect(
      getCommentUserInfo({
        user_info: { user_id: "u2", nickName: "别名" }
      })
    ).toEqual({ user_id: "u2", nickname: "别名" })
  })
})

describe("getCommentLikeCount", () => {
  it("优先 like_count，兜底 liked_count", () => {
    expect(getCommentLikeCount({ like_count: 5 })).toBe(5)
    expect(getCommentLikeCount({ liked_count: 2 })).toBe(2)
  })
})

describe("getCommentIpLocation", () => {
  it("优先 ip_location，兜底 reply_control.location", () => {
    expect(getCommentIpLocation({ ip_location: "上海" })).toBe("上海")
    expect(
      getCommentIpLocation({
        replyControl: { location: "IP属地：广东" }
      })
    ).toBe("广东")
  })
})

describe("getCommentPictureUrls", () => {
  it("url_pre 对应浏览器 CDN 预览图", () => {
    expect(
      getCommentPictureUrls({
        pictures: [{ url_pre: USER_CDN_URL_PRE }]
      })
    ).toBe(USER_CDN_URL_PRE)
  })

  it("url_default 优先于 url_pre", () => {
    expect(
      getCommentPictureUrls({
        pictures: [
          {
            url_default: "https://sns-webpic-qc.xhscdn.com/default.jpg",
            url_pre: USER_CDN_URL_PRE
          }
        ]
      })
    ).toBe("https://sns-webpic-qc.xhscdn.com/default.jpg")
  })

  it("仅 infoList camelCase 时从 WB_DFT 取 url", () => {
    expect(
      getCommentPictureUrls({
        pictures: [
          {
            infoList: [
              {
                imageScene: "WB_PRV",
                url: "https://sns-webpic-qc.xhscdn.com/preview.jpg"
              },
              {
                imageScene: "WB_DFT",
                url: "https://sns-webpic-qc.xhscdn.com/default.jpg"
              }
            ]
          }
        ]
      })
    ).toBe("https://sns-webpic-qc.xhscdn.com/default.jpg")
  })

  it("pictures 为空时返回 undefined", () => {
    expect(getCommentPictureUrls({ pictures: [] })).toBeUndefined()
    expect(getCommentPictureUrls({})).toBeUndefined()
  })

  it("多图换行拼接", () => {
    expect(
      getCommentPictureUrls({
        pictures: [{ url_pre: USER_CDN_URL_PRE }, { url_pre: "https://example.com/2.jpg" }]
      })
    ).toBe(`${USER_CDN_URL_PRE}\nhttps://example.com/2.jpg`)
  })
})

describe("shouldDegradeCommentPage", () => {
  it("无效响应应熔断", () => {
    expect(shouldDegradeCommentPage(parseCommentList(null))).toBe(true)
    expect(shouldDegradeCommentPage(parseCommentList({ foo: 1 }))).toBe(true)
  })

  it("空页但 has_more 应熔断", () => {
    expect(
      shouldDegradeCommentPage(
        parseCommentList({ comments: [], has_more: true, cursor: "x" })
      )
    ).toBe(true)
  })

  it("正常有数据页不熔断", () => {
    expect(
      shouldDegradeCommentPage(
        parseCommentList({
          comments: [{ id: "1" }],
          has_more: true,
          cursor: "next"
        })
      )
    ).toBe(false)
  })

  it("末页空列表不熔断", () => {
    expect(
      shouldDegradeCommentPage(
        parseCommentList({ comments: [], has_more: false, cursor: "" })
      )
    ).toBe(false)
  })
})

describe("needsSubCommentFetch", () => {
  it("sub_comment_has_more 为 true 时需要拉取", () => {
    expect(
      needsSubCommentFetch({
        id: "r1",
        sub_comments: [{ id: "s1" }],
        sub_comment_has_more: true
      })
    ).toBe(true)
  })

  it("子评论总数大于 embedded 时需要拉取", () => {
    expect(
      needsSubCommentFetch({
        id: "r1",
        sub_comments: [{ id: "s1" }],
        sub_comment_count: 5
      })
    ).toBe(true)
  })

  it("embedded 已齐全且 has_more 为 false 时不拉取", () => {
    expect(
      needsSubCommentFetch({
        id: "r1",
        sub_comments: [{ id: "s1" }, { id: "s2" }],
        sub_comment_count: 2,
        sub_comment_has_more: false
      })
    ).toBe(false)
  })
})

describe("parseCommentList", () => {
  it("hasMore 仅在为 true 时为真", () => {
    expect(parseCommentList({ comments: [], has_more: false }).hasMore).toBe(
      false
    )
    expect(parseCommentList({ comments: [], has_more: true }).hasMore).toBe(
      true
    )
    expect(parseCommentList({ comments: [], hasMore: true }).hasMore).toBe(true)
  })
})
