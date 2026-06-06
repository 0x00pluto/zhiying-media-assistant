import { describe, expect, it } from "vitest"

import {
  needsSubCommentFetch,
  parseCommentList,
  shouldDegradeCommentPage
} from "./comment-api-helpers"

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
