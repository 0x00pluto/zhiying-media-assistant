import { beforeEach, describe, expect, it, vi } from "vitest"

const store = new Map<string, unknown>()

vi.mock("@plasmohq/storage", () => ({
  Storage: class MockStorage {
    constructor(_opts?: { area?: string }) {}

    async get<T>(key: string) {
      return store.get(key) as T | undefined
    }

    async set(key: string, value: unknown) {
      store.set(key, value)
    }
  }
}))

import {
  FEISHU_TARGET_KEYS,
  formatBitableTargetLabel,
  getTargetUrl,
  loadFeishuQuickSync,
  loadFeishuTargetHistories,
  normalizePrefs,
  removeFeishuTargetHistory
} from "./sync-prefs"

describe("formatBitableTargetLabel", () => {
  it("returns doc and table name when metadata exists", () => {
    expect(
      formatBitableTargetLabel({
        url: "https://example.feishu.cn/base/abc?table=tbl1",
        appName: "采集表",
        tableName: "笔记"
      })
    ).toBe("采集表 · 笔记")
  })

  it("falls back to url when metadata is missing", () => {
    expect(
      formatBitableTargetLabel({
        url: "https://example.feishu.cn/base/abc?table=tbl1"
      })
    ).toBe("https://example.feishu.cn/base/abc?table=tbl1")
  })
})

describe("getTargetUrl", () => {
  it("prefers target.url over legacy url", () => {
    expect(
      getTargetUrl({
        target: { url: "https://new" },
        url: "https://old"
      })
    ).toBe("https://new")
  })

  it("falls back to legacy url", () => {
    expect(getTargetUrl({ url: "https://legacy" })).toBe("https://legacy")
  })
})

describe("normalizePrefs", () => {
  it("migrates legacy url to target", () => {
    const { prefs, changed } = normalizePrefs({
      url: "https://example.feishu.cn/base/abc?table=tbl1",
      mode: "merge"
    })

    expect(changed).toBe(true)
    expect(prefs.target?.url).toBe(
      "https://example.feishu.cn/base/abc?table=tbl1"
    )
    expect(prefs.url).toBeUndefined()
    expect(prefs.mode).toBe("merge")
  })

  it("strips legacy url when target already exists", () => {
    const { prefs, changed } = normalizePrefs({
      url: "https://legacy",
      target: { url: "https://current", appName: "A", tableName: "B" }
    })

    expect(changed).toBe(true)
    expect(prefs.url).toBeUndefined()
    expect(prefs.target?.url).toBe("https://current")
  })
})

describe("loadFeishuQuickSync migration", () => {
  beforeEach(() => {
    store.clear()
  })

  it("migrates legacy note storage key to new key", async () => {
    store.set("feishuQuickSync:qmc-quickSyncFeishu-note", {
      url: "https://example.feishu.cn/base/note?table=tbl1",
      mode: "append"
    })

    const prefs = await loadFeishuQuickSync(FEISHU_TARGET_KEYS.noteDetail)

    expect(prefs?.target?.url).toBe(
      "https://example.feishu.cn/base/note?table=tbl1"
    )
    expect(prefs?.mode).toBe("append")
    expect(store.get(`feishuQuickSync:${FEISHU_TARGET_KEYS.noteDetail}`)).toEqual(
      {
        target: { url: "https://example.feishu.cn/base/note?table=tbl1" },
        mode: "append"
      }
    )
  })

  it("migrates batch legacy key only to batch-note", async () => {
    store.set("feishuQuickSync:qmc-quickSyncFeishu-batch", {
      url: "https://example.feishu.cn/base/batch?table=tbl1"
    })

    const notePrefs = await loadFeishuQuickSync(FEISHU_TARGET_KEYS.batchNote)
    const bloggerPrefs = await loadFeishuQuickSync(
      FEISHU_TARGET_KEYS.batchBlogger
    )

    expect(notePrefs?.target?.url).toBe(
      "https://example.feishu.cn/base/batch?table=tbl1"
    )
    expect(bloggerPrefs).toBeNull()
  })
})

describe("loadFeishuTargetHistories migration", () => {
  beforeEach(() => {
    store.clear()
  })

  it("migrates string[] history to FeishuBitableTarget[]", async () => {
    store.set(
      `feishuQuickSyncHistory:${FEISHU_TARGET_KEYS.batchComment}`,
      [
        "https://example.feishu.cn/base/a?table=t1",
        "https://example.feishu.cn/base/b?table=t2"
      ]
    )

    const histories = await loadFeishuTargetHistories(
      FEISHU_TARGET_KEYS.batchComment
    )

    expect(histories).toEqual([
      { url: "https://example.feishu.cn/base/a?table=t1" },
      { url: "https://example.feishu.cn/base/b?table=t2" }
    ])
    expect(
      store.get(`feishuQuickSyncHistory:${FEISHU_TARGET_KEYS.batchComment}`)
    ).toEqual(histories)
  })

  it("inherits legacy comment history when new key is empty", async () => {
    store.set("feishuQuickSyncHistory:qmc-quickSyncFeishu-comment", [
      "https://example.feishu.cn/base/legacy?table=tbl1"
    ])

    const histories = await loadFeishuTargetHistories(
      FEISHU_TARGET_KEYS.batchComment
    )

    expect(histories).toEqual([
      { url: "https://example.feishu.cn/base/legacy?table=tbl1" }
    ])
  })
})

describe("removeFeishuTargetHistory", () => {
  beforeEach(() => {
    store.clear()
  })

  it("removes matching url from history", async () => {
    store.set(`feishuQuickSyncHistory:${FEISHU_TARGET_KEYS.batchNote}`, [
      { url: "https://example.feishu.cn/base/a?table=t1", appName: "A", tableName: "表1" },
      { url: "https://example.feishu.cn/base/b?table=t2", appName: "B", tableName: "表2" }
    ])

    const result = await removeFeishuTargetHistory(
      FEISHU_TARGET_KEYS.batchNote,
      "https://example.feishu.cn/base/a?table=t1"
    )

    expect(result).toEqual([
      { url: "https://example.feishu.cn/base/b?table=t2", appName: "B", tableName: "表2" }
    ])
    expect(
      store.get(`feishuQuickSyncHistory:${FEISHU_TARGET_KEYS.batchNote}`)
    ).toEqual(result)
  })

  it("clears prefs.target when removed url matches saved target", async () => {
    const url = "https://example.feishu.cn/base/a?table=t1"
    store.set(`feishuQuickSyncHistory:${FEISHU_TARGET_KEYS.noteDetail}`, [
      { url, appName: "A", tableName: "表1" }
    ])
    store.set(`feishuQuickSync:${FEISHU_TARGET_KEYS.noteDetail}`, {
      target: { url, appName: "A", tableName: "表1" },
      mode: "merge",
      shouldUploadMedia: false,
      fieldOptions: { keys: ["note_id"], skipEmpty: true }
    })

    await removeFeishuTargetHistory(FEISHU_TARGET_KEYS.noteDetail, url)

    const prefs = await loadFeishuQuickSync(FEISHU_TARGET_KEYS.noteDetail)
    expect(prefs?.target).toBeUndefined()
    expect(prefs?.mode).toBe("merge")
    expect(prefs?.shouldUploadMedia).toBe(false)
    expect(prefs?.fieldOptions).toEqual({ keys: ["note_id"], skipEmpty: true })
  })

  it("is idempotent when url is not in history", async () => {
    store.set(`feishuQuickSyncHistory:${FEISHU_TARGET_KEYS.batchComment}`, [
      { url: "https://example.feishu.cn/base/a?table=t1" }
    ])

    const result = await removeFeishuTargetHistory(
      FEISHU_TARGET_KEYS.batchComment,
      "https://example.feishu.cn/base/missing?table=t9"
    )

    expect(result).toEqual([{ url: "https://example.feishu.cn/base/a?table=t1" }])
  })
})
