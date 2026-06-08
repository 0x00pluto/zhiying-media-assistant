import { beforeEach, describe, expect, it, vi } from "vitest"

const listTableFields = vi.fn()
const hasRecordsWithFieldValue = vi.fn()

vi.mock("./bitable", () => ({
  listTableFields: (...args: unknown[]) => listTableFields(...args),
  hasRecordsWithFieldValue: (...args: unknown[]) =>
    hasRecordsWithFieldValue(...args)
}))

import { FEISHU_TARGET_KEYS } from "./sync-prefs"
import {
  assertSyncTargetKind,
  detectBitableDataKind,
  syncKindFromStorageKey
} from "./table-type-guard"

const REF = { appToken: "app", tableId: "tbl" }

describe("syncKindFromStorageKey", () => {
  it("maps note-detail and batch-note to note", () => {
    expect(syncKindFromStorageKey(FEISHU_TARGET_KEYS.noteDetail)).toBe("note")
    expect(syncKindFromStorageKey(FEISHU_TARGET_KEYS.batchNote)).toBe("note")
  })

  it("maps batch-comment to comment", () => {
    expect(syncKindFromStorageKey(FEISHU_TARGET_KEYS.batchComment)).toBe(
      "comment"
    )
  })

  it("returns null for batch-blogger and unknown keys", () => {
    expect(syncKindFromStorageKey(FEISHU_TARGET_KEYS.batchBlogger)).toBeNull()
    expect(syncKindFromStorageKey("unknown-key")).toBeNull()
  })
})

describe("assertSyncTargetKind", () => {
  it("allows empty table for both note and comment entries", () => {
    expect(() => assertSyncTargetKind("empty", "note")).not.toThrow()
    expect(() => assertSyncTargetKind("empty", "comment")).not.toThrow()
  })

  it("allows note table for note entry", () => {
    expect(() => assertSyncTargetKind("note", "note")).not.toThrow()
  })

  it("allows comment table for comment entry", () => {
    expect(() => assertSyncTargetKind("comment", "comment")).not.toThrow()
  })

  it("blocks comment entry on note table", () => {
    expect(() => assertSyncTargetKind("note", "comment")).toThrow(
      "该数据表已用于同步笔记，请选择其他表格或新建表格后再同步评论。"
    )
  })

  it("blocks note entry on comment table", () => {
    expect(() => assertSyncTargetKind("comment", "note")).toThrow(
      "该数据表已用于同步评论，请选择其他表格或新建表格后再同步笔记。"
    )
  })

  it("blocks both entries on conflict table", () => {
    const message =
      "该数据表内同时存在笔记与评论数据，请整理表格后重试，或选择其他表格。"
    expect(() => assertSyncTargetKind("conflict", "note")).toThrow(message)
    expect(() => assertSyncTargetKind("conflict", "comment")).toThrow(message)
  })
})

describe("detectBitableDataKind", () => {
  beforeEach(() => {
    listTableFields.mockReset()
    hasRecordsWithFieldValue.mockReset()
  })

  it("returns empty when neither field has data", async () => {
    listTableFields.mockResolvedValue([
      { field_id: "1", field_name: "评论ID", type: 1 },
      { field_id: "2", field_name: "笔记ID", type: 1 }
    ])
    hasRecordsWithFieldValue.mockResolvedValue(false)

    await expect(detectBitableDataKind(REF)).resolves.toBe("empty")
    expect(hasRecordsWithFieldValue).toHaveBeenCalledWith(REF, "评论ID")
    expect(hasRecordsWithFieldValue).toHaveBeenCalledWith(REF, "笔记ID")
  })

  it("returns comment when only comment field has data", async () => {
    listTableFields.mockResolvedValue([
      { field_id: "1", field_name: "评论ID", type: 1 },
      { field_id: "2", field_name: "笔记ID", type: 1 }
    ])
    hasRecordsWithFieldValue.mockImplementation(async (_ref, fieldName) => {
      return fieldName === "评论ID"
    })

    await expect(detectBitableDataKind(REF)).resolves.toBe("comment")
  })

  it("returns note when only note field has data", async () => {
    listTableFields.mockResolvedValue([
      { field_id: "1", field_name: "评论ID", type: 1 },
      { field_id: "2", field_name: "笔记ID", type: 1 }
    ])
    hasRecordsWithFieldValue.mockImplementation(async (_ref, fieldName) => {
      return fieldName === "笔记ID"
    })

    await expect(detectBitableDataKind(REF)).resolves.toBe("note")
  })

  it("returns conflict when both fields have data", async () => {
    listTableFields.mockResolvedValue([
      { field_id: "1", field_name: "评论ID", type: 1 },
      { field_id: "2", field_name: "笔记ID", type: 1 }
    ])
    hasRecordsWithFieldValue.mockResolvedValue(true)

    await expect(detectBitableDataKind(REF)).resolves.toBe("conflict")
  })

  it("skips sampling when field does not exist", async () => {
    listTableFields.mockResolvedValue([
      { field_id: "2", field_name: "标题", type: 1 }
    ])

    await expect(detectBitableDataKind(REF)).resolves.toBe("empty")
    expect(hasRecordsWithFieldValue).not.toHaveBeenCalled()
  })

  it("throws blocking error when API fails", async () => {
    listTableFields.mockRejectedValue(new Error("network"))

    await expect(detectBitableDataKind(REF)).rejects.toThrow(
      "无法校验目标表格类型，请检查网络与飞书应用权限后重试。"
    )
  })
})
