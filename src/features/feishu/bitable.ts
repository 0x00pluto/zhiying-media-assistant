import type { ColumnDef } from "~shared/columns/types"

import { mapRecordToFeishuFields } from "./field-mapper"
import { feishuRequest } from "./client"
import { feishuSyncConfigStorage } from "./storage"

export type BitableRef = {
  appToken: string
  tableId: string
}

export async function batchCreateRecords(
  ref: BitableRef,
  records: Record<string, unknown>[],
  columns: ColumnDef[]
) {
  return batchCreateRecordsWithFields(
    ref,
    records.map((record) => ({
      fields: mapRecordToFeishuFields(record, columns)
    }))
  )
}

export async function batchCreateRecordsWithFields(
  ref: BitableRef,
  records: Array<{ fields: Record<string, unknown> }>
) {
  const syncConfig = await feishuSyncConfigStorage.get()
  const chunkSize = syncConfig.maxBatchSize
  const created: string[] = []

  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize)
    const data = await feishuRequest<{ records?: Array<{ record_id: string }> }>(
      `/open-apis/bitable/v1/apps/${ref.appToken}/tables/${ref.tableId}/records/batch_create`,
      {
        method: "POST",
        body: { records: chunk }
      }
    )
    created.push(...(data.records || []).map((r) => r.record_id))
  }

  return created
}

export async function batchUpdateRecords(
  ref: BitableRef,
  records: Array<{ record_id: string; fields: Record<string, unknown> }>
) {
  const syncConfig = await feishuSyncConfigStorage.get()
  const chunkSize = syncConfig.maxBatchSize

  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize)
    await feishuRequest(
      `/open-apis/bitable/v1/apps/${ref.appToken}/tables/${ref.tableId}/records/batch_update`,
      {
        method: "POST",
        body: { records: chunk }
      }
    )
  }
}

export type BitableRecordItem = {
  record_id: string
  fields: Record<string, unknown>
}

export type BitableFieldItem = {
  field_id: string
  field_name: string
  type: number
  is_primary?: boolean
  property?: Record<string, unknown>
  ui_type?: string
}

export async function listTableFields(ref: BitableRef) {
  const items: BitableFieldItem[] = []
  let pageToken = ""

  while (true) {
    const query = new URLSearchParams({ page_size: "100" })
    if (pageToken) query.set("page_token", pageToken)

    const data = await feishuRequest<{
      items?: BitableFieldItem[]
      has_more?: boolean
      page_token?: string
    }>(
      `/open-apis/bitable/v1/apps/${ref.appToken}/tables/${ref.tableId}/fields?${query.toString()}`
    )

    items.push(...(data.items || []))
    if (!data.has_more || !data.page_token) break
    pageToken = data.page_token
  }

  return items
}

export async function createTableField(
  ref: BitableRef,
  field: {
    field_name: string
    type: number
    property?: Record<string, unknown>
    ui_type?: string
    description?: { text: string }
  }
) {
  const data = await feishuRequest<{ field?: BitableFieldItem }>(
    `/open-apis/bitable/v1/apps/${ref.appToken}/tables/${ref.tableId}/fields`,
    {
      method: "POST",
      body: field
    }
  )
  return data.field
}

export async function updateTableField(
  ref: BitableRef,
  fieldId: string,
  field: {
    field_name: string
    type: number
    property?: Record<string, unknown>
    ui_type?: string
    description?: { text: string }
  }
) {
  const data = await feishuRequest<{ field?: BitableFieldItem }>(
    `/open-apis/bitable/v1/apps/${ref.appToken}/tables/${ref.tableId}/fields/${fieldId}`,
    {
      method: "PUT",
      body: field
    }
  )
  return data.field
}

export async function searchRecords(
  ref: BitableRef,
  payload: Record<string, unknown> = {},
  params: { page_token?: string; page_size?: number } = {}
) {
  const query = new URLSearchParams()
  if (params.page_size) query.set("page_size", String(params.page_size))
  if (params.page_token) query.set("page_token", params.page_token)
  const suffix = query.toString() ? `?${query.toString()}` : ""

  return feishuRequest<{
    items?: BitableRecordItem[]
    has_more?: boolean
    page_token?: string
  }>(
    `/open-apis/bitable/v1/apps/${ref.appToken}/tables/${ref.tableId}/records/search${suffix}`,
    {
      method: "POST",
      body: payload
    }
  )
}

/** 分页拉取指定字段的全部记录（合并模式查重用，不走 filter） */
export async function listAllRecordsByFields(
  ref: BitableRef,
  fieldNames: string[]
) {
  const items: BitableRecordItem[] = []
  let pageToken = ""

  while (true) {
    const data = await searchRecords(
      ref,
      { field_names: fieldNames },
      { page_size: 500, page_token: pageToken || undefined }
    )
    items.push(...(data.items || []))
    if (!data.has_more || !data.page_token) break
    pageToken = data.page_token
  }

  return items
}

export type BitableUrlInput = {
  type: "base" | "wiki"
  token: string
  url: URL
}

export type ResolvedBitableRef = BitableRef & {
  normalizedUrl?: string
}

export type ResolvedBitableTarget = ResolvedBitableRef & {
  appName: string
  tableName: string
}

export type BitableTableItem = {
  table_id: string
  name?: string
}

export type ResolveTableResult =
  | { status: "resolved"; tableId: string }
  | { status: "ambiguous"; tables: BitableTableItem[] }

/** 分享链接未指定 table 且多维表格含多张数据表时抛出，供 UI 展示选择器 */
export class BitableTableAmbiguousError extends Error {
  readonly appToken: string
  readonly appName: string
  readonly tables: BitableTableItem[]
  readonly url: string

  constructor(
    appToken: string,
    appName: string,
    tables: BitableTableItem[],
    url: string
  ) {
    super("分享链接未指定数据表，请在下方选择要同步的数据表")
    this.name = "BitableTableAmbiguousError"
    this.appToken = appToken
    this.appName = appName
    this.tables = tables
    this.url = url
  }
}

export function parseBitableUrlInput(url: string): BitableUrlInput | null {
  try {
    const parsed = new URL(url.trim())
    const segments = parsed.pathname.split("/").filter(Boolean)
    const type = segments[0]
    const token = segments[segments.length - 1]
    if ((type === "base" || type === "wiki") && token) {
      return { type, token, url: parsed }
    }
    return null
  } catch {
    return null
  }
}

export function isFeishuBitableUrl(url: string) {
  return Boolean(parseBitableUrlInput(url))
}

/** 同步解析，仅适用于 /base/ 直链 */
export function parseBitableUrl(url: string): BitableRef | null {
  const input = parseBitableUrlInput(url)
  if (!input || input.type !== "base") return null

  const tableId =
    input.url.searchParams.get("table") ||
    input.url.searchParams.get("tableId")
  if (!tableId) return null

  return { appToken: input.token, tableId }
}

async function getWikiBitableNode(wikiToken: string) {
  const data = await feishuRequest<{
    node?: {
      obj_type?: string
      obj_token?: string
      title?: string
    }
  }>(
    `/open-apis/wiki/v2/spaces/get_node?token=${encodeURIComponent(wikiToken)}`
  )

  const node = data.node
  if (!node || node.obj_type !== "bitable" || !node.obj_token) {
    throw new Error("当前 Wiki 链接不是多维表格，或应用无权访问该知识库节点")
  }
  return {
    appToken: node.obj_token,
    wikiTitle: node.title?.trim() || ""
  }
}

export async function getBitableApp(appToken: string) {
  const data = await feishuRequest<{ app?: { name?: string } }>(
    `/open-apis/bitable/v1/apps/${appToken}`
  )
  return data.app?.name?.trim() || "未命名多维表格"
}

export async function listBitableTables(appToken: string) {
  const data = await feishuRequest<{
    items?: BitableTableItem[]
  }>(`/open-apis/bitable/v1/apps/${appToken}/tables`)
  return data.items || []
}

/** 根据 URL 查询参数从已知数据表列表中解析 tableId（纯函数，可单测） */
export function resolveTableIdFromParams(
  tables: BitableTableItem[],
  url: URL
): ResolveTableResult {
  const tableId =
    url.searchParams.get("table") || url.searchParams.get("tableId")

  if (tableId) {
    const matched = tables.find((table) => table.table_id === tableId)
    if (!matched) {
      throw new Error("链接中的数据表不存在，请检查 table 参数是否正确")
    }
    return { status: "resolved", tableId }
  }

  if (tables.length === 1) {
    url.searchParams.set("table", tables[0].table_id)
    return { status: "resolved", tableId: tables[0].table_id }
  }

  return { status: "ambiguous", tables }
}

async function resolveTableIdByView(
  appToken: string,
  tables: BitableTableItem[],
  viewId: string
) {
  for (const table of tables) {
    const data = await feishuRequest<{
      items?: Array<{ view_id?: string }>
    }>(
      `/open-apis/bitable/v1/apps/${appToken}/tables/${table.table_id}/views`
    )
    if (data.items?.some((view) => view.view_id === viewId)) {
      return table.table_id
    }
  }
  return null
}

async function resolveTableId(
  appToken: string,
  tables: BitableTableItem[],
  url: URL
) {
  let result = resolveTableIdFromParams(tables, url)
  if (result.status === "resolved") {
    return result.tableId
  }

  const viewId = url.searchParams.get("view")
  if (viewId) {
    const tableId = await resolveTableIdByView(appToken, tables, viewId)
    if (tableId) {
      url.searchParams.set("table", tableId)
      return tableId
    }
  }

  return null
}

export function appendTableToBitableUrl(url: string, tableId: string) {
  const input = parseBitableUrlInput(url)
  if (!input) return url
  input.url.searchParams.set("table", tableId)
  return input.url.href
}

/** 解析链接并返回文档名、数据表名，供同步弹窗二次确认 */
export async function resolveBitableTargetDisplay(
  url: string
): Promise<ResolvedBitableTarget> {
  const input = parseBitableUrlInput(url)
  if (!input) {
    throw new Error("请输入有效的飞书多维表格链接（支持 /base/ 与 /wiki/ 格式）")
  }

  let appToken: string
  let wikiTitle = ""

  if (input.type === "base") {
    appToken = input.token
  } else {
    const wikiNode = await getWikiBitableNode(input.token)
    appToken = wikiNode.appToken
    wikiTitle = wikiNode.wikiTitle
  }

  const tables = await listBitableTables(appToken)
  if (!tables.length) {
    throw new Error("当前多维表格中未检测到数据表，请先创建数据表")
  }

  let appName = wikiTitle
  if (!appName) {
    appName = await getBitableApp(appToken)
  }

  const tableId = await resolveTableId(appToken, tables, input.url)
  if (!tableId) {
    throw new BitableTableAmbiguousError(
      appToken,
      appName,
      tables,
      input.url.href
    )
  }

  const matchedTable = tables.find((table) => table.table_id === tableId)
  const tableName = matchedTable?.name?.trim() || "未命名数据表"

  return {
    appToken,
    tableId,
    normalizedUrl: input.url.href,
    appName,
    tableName
  }
}

/** 解析 /base/ 或 /wiki/ 链接，Wiki 需调用飞书 API 换取 appToken */
export async function resolveBitableRef(url: string): Promise<ResolvedBitableRef> {
  const resolved = await resolveBitableTargetDisplay(url)
  return {
    appToken: resolved.appToken,
    tableId: resolved.tableId,
    normalizedUrl: resolved.normalizedUrl
  }
}
