import { beforeEach, describe, expect, it, vi } from "vitest"

const feishuRequest = vi.fn()

vi.mock("./client", () => ({
  feishuRequest: (...args: unknown[]) => feishuRequest(...args)
}))

import {
  appendTableToBitableUrl,
  parseBitableUrlInput,
  resolveBitableTargetDisplay,
  resolveTableIdFromParams
} from "./bitable"

const SHARE_URL =
  "https://fcnegd976pzo.feishu.cn/wiki/WusEwhPRzik2m8kg1ofc0sBCnbh?from=from_copylink"
const ABSOLUTE_URL =
  "https://fcnegd976pzo.feishu.cn/wiki/WusEwhPRzik2m8kg1ofc0sBCnbh?table=tbld18JU20YknsfE&view=vewf76rIdQ"

describe("parseBitableUrlInput", () => {
  it("parses wiki share link without table param", () => {
    const parsed = parseBitableUrlInput(SHARE_URL)
    expect(parsed).toEqual({
      type: "wiki",
      token: "WusEwhPRzik2m8kg1ofc0sBCnbh",
      url: new URL(SHARE_URL)
    })
  })

  it("parses wiki absolute url with table and view params", () => {
    const parsed = parseBitableUrlInput(ABSOLUTE_URL)
    expect(parsed?.type).toBe("wiki")
    expect(parsed?.token).toBe("WusEwhPRzik2m8kg1ofc0sBCnbh")
    expect(parsed?.url.searchParams.get("table")).toBe("tbld18JU20YknsfE")
    expect(parsed?.url.searchParams.get("view")).toBe("vewf76rIdQ")
  })
})

describe("resolveTableIdFromParams", () => {
  it("resolves table from table param", () => {
    const url = new URL(ABSOLUTE_URL)
    const result = resolveTableIdFromParams(
      [
        { table_id: "tbld18JU20YknsfE", name: "笔记" },
        { table_id: "tblOther", name: "其他" }
      ],
      url
    )
    expect(result).toEqual({ status: "resolved", tableId: "tbld18JU20YknsfE" })
  })

  it("auto-fills table when only one sheet exists", () => {
    const url = new URL(SHARE_URL)
    const result = resolveTableIdFromParams(
      [{ table_id: "tbld18JU20YknsfE", name: "笔记" }],
      url
    )
    expect(result).toEqual({ status: "resolved", tableId: "tbld18JU20YknsfE" })
    expect(url.searchParams.get("table")).toBe("tbld18JU20YknsfE")
  })

  it("returns ambiguous when multiple sheets and no table param", () => {
    const url = new URL(SHARE_URL)
    const tables = [
      { table_id: "tbld18JU20YknsfE", name: "笔记" },
      { table_id: "tblOther", name: "其他" }
    ]
    const result = resolveTableIdFromParams(tables, url)
    expect(result).toEqual({ status: "ambiguous", tables })
  })

  it("throws when table param does not exist", () => {
    const url = new URL(`${SHARE_URL}&table=tblMissing`)
    expect(() =>
      resolveTableIdFromParams([{ table_id: "tbld18JU20YknsfE" }], url)
    ).toThrow("链接中的数据表不存在")
  })
})

describe("appendTableToBitableUrl", () => {
  it("appends table param to share link", () => {
    expect(appendTableToBitableUrl(SHARE_URL, "tbld18JU20YknsfE")).toBe(
      "https://fcnegd976pzo.feishu.cn/wiki/WusEwhPRzik2m8kg1ofc0sBCnbh?from=from_copylink&table=tbld18JU20YknsfE"
    )
  })
})

describe("resolveBitableTargetDisplay", () => {
  beforeEach(() => {
    feishuRequest.mockReset()
  })

  it("resolves wiki absolute url directly", async () => {
    feishuRequest.mockImplementation(async (path: string) => {
      if (path.includes("/wiki/v2/spaces/get_node")) {
        return {
          node: {
            obj_type: "bitable",
            obj_token: "appToken",
            title: "采集库"
          }
        }
      }
      if (path.endsWith("/tables")) {
        return {
          items: [
            { table_id: "tbld18JU20YknsfE", name: "笔记" },
            { table_id: "tblOther", name: "其他" }
          ]
        }
      }
      if (path.includes("/apps/appToken")) {
        return { app: { name: "采集库" } }
      }
      throw new Error(`unexpected path: ${path}`)
    })

    const resolved = await resolveBitableTargetDisplay(ABSOLUTE_URL)
    expect(resolved.tableId).toBe("tbld18JU20YknsfE")
    expect(resolved.appName).toBe("采集库")
    expect(resolved.tableName).toBe("笔记")
  })

  it("throws ambiguous error for share link with multiple tables", async () => {
    feishuRequest.mockImplementation(async (path: string) => {
      if (path.includes("/wiki/v2/spaces/get_node")) {
        return {
          node: {
            obj_type: "bitable",
            obj_token: "appToken",
            title: "采集库"
          }
        }
      }
      if (path.endsWith("/tables")) {
        return {
          items: [
            { table_id: "tbld18JU20YknsfE", name: "笔记" },
            { table_id: "tblOther", name: "其他" }
          ]
        }
      }
      throw new Error(`unexpected path: ${path}`)
    })

    await expect(resolveBitableTargetDisplay(SHARE_URL)).rejects.toMatchObject({
      name: "BitableTableAmbiguousError",
      appToken: "appToken",
      tables: [
        { table_id: "tbld18JU20YknsfE", name: "笔记" },
        { table_id: "tblOther", name: "其他" }
      ]
    })
  })

  it("resolves table via view param when table is missing", async () => {
    const viewOnlyUrl =
      "https://fcnegd976pzo.feishu.cn/wiki/WusEwhPRzik2m8kg1ofc0sBCnbh?view=vewf76rIdQ"

    feishuRequest.mockImplementation(async (path: string) => {
      if (path.includes("/wiki/v2/spaces/get_node")) {
        return {
          node: {
            obj_type: "bitable",
            obj_token: "appToken",
            title: "采集库"
          }
        }
      }
      if (path.endsWith("/tables")) {
        return {
          items: [
            { table_id: "tbld18JU20YknsfE", name: "笔记" },
            { table_id: "tblOther", name: "其他" }
          ]
        }
      }
      if (path.includes("/tables/tbld18JU20YknsfE/views")) {
        return { items: [{ view_id: "vewf76rIdQ" }] }
      }
      if (path.includes("/tables/tblOther/views")) {
        return { items: [{ view_id: "vewOther" }] }
      }
      if (path.includes("/apps/appToken")) {
        return { app: { name: "采集库" } }
      }
      throw new Error(`unexpected path: ${path}`)
    })

    const resolved = await resolveBitableTargetDisplay(viewOnlyUrl)
    expect(resolved.tableId).toBe("tbld18JU20YknsfE")
    expect(resolved.normalizedUrl).toContain("table=tbld18JU20YknsfE")
  })
})
