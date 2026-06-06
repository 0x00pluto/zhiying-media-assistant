import { describe, expect, it } from "vitest"

import {
  getNoteRecordCount,
  getProgressCompletedCount,
  getRootCommentCount,
  isRootCommentRecord,
  isUnderCollectLimit,
  META_ROOT_COMMENT_ID,
  shouldLimitSubCommentRecords
} from "./comment-collect-limit"

const NOTE_ID = "note1"

function rootRecord(id: string) {
  return { note_id: NOTE_ID, id }
}

function subRecord(id: string, rootId: string) {
  return {
    note_id: NOTE_ID,
    id,
    [META_ROOT_COMMENT_ID]: rootId
  }
}

describe("getRootCommentCount", () => {
  it("仅统计无 META_ROOT_COMMENT_ID 的记录", () => {
    const records = [
      rootRecord("r1"),
      subRecord("s1", "r1"),
      rootRecord("r2")
    ]
    expect(getRootCommentCount(records, NOTE_ID)).toBe(2)
  })
})

describe("isUnderCollectLimit", () => {
  it("includeSub 为 true 时仅按一级评论计数", () => {
    const records = Array.from({ length: 10 }, (_, i) => rootRecord(`r${i}`))
    records.push(subRecord("s1", "r0"))

    expect(
      isUnderCollectLimit({
        records,
        noteId: NOTE_ID,
        limit: 10,
        includeSub: true
      })
    ).toBe(false)

    expect(
      isUnderCollectLimit({
        records: records.slice(0, 9),
        noteId: NOTE_ID,
        limit: 10,
        includeSub: true
      })
    ).toBe(true)
  })

  it("includeSub 为 false 时子评论计入 limit", () => {
    const records = [
      rootRecord("r1"),
      subRecord("s1", "r1"),
      rootRecord("r2")
    ]

    expect(
      isUnderCollectLimit({
        records,
        noteId: NOTE_ID,
        limit: 3,
        includeSub: false
      })
    ).toBe(false)

    expect(getNoteRecordCount(records, NOTE_ID)).toBe(3)
  })
})

describe("shouldLimitSubCommentRecords", () => {
  it("开启 includeSub 时不限制子评论条数", () => {
    expect(shouldLimitSubCommentRecords(true)).toBe(false)
  })

  it("关闭 includeSub 时 embedded 子评论受 limit 约束", () => {
    expect(shouldLimitSubCommentRecords(false)).toBe(true)
  })
})

describe("getProgressCompletedCount", () => {
  it("includeSub 为 true 时进度仅计一级评论", () => {
    const records = [
      rootRecord("r1"),
      subRecord("s1", "r1"),
      subRecord("s2", "r1"),
      rootRecord("r2")
    ]
    expect(getProgressCompletedCount(records, true)).toBe(2)
    expect(getProgressCompletedCount(records, false)).toBe(4)
  })

  it("backfill 后仍可通过 root.id 识别一级评论", () => {
    const records = [
      { note_id: NOTE_ID, id: "r1", "root.id": "r1" },
      { note_id: NOTE_ID, id: "s1", "root.id": "r1" },
      { note_id: NOTE_ID, id: "r2", "root.id": "r2" }
    ]
    expect(getProgressCompletedCount(records, true)).toBe(2)
    expect(isRootCommentRecord(records[1])).toBe(false)
  })
})
