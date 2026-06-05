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

async function getWikiBitableAppToken(wikiToken: string) {
  const data = await feishuRequest<{
    node?: { obj_type?: string; obj_token?: string }
  }>(
    `/open-apis/wiki/v2/spaces/get_node?token=${encodeURIComponent(wikiToken)}`
  )

  const node = data.node
  if (!node || node.obj_type !== "bitable" || !node.obj_token) {
    throw new Error("当前 Wiki 链接不是多维表格，或应用无权访问该知识库节点")
  }
  return node.obj_token
}

async function listBitableTables(appToken: string) {
  const data = await feishuRequest<{
    items?: Array<{ table_id: string; name?: string }>
  }>(`/open-apis/bitable/v1/apps/${appToken}/tables`)
  return data.items || []
}

function resolveTableId(
  tables: Array<{ table_id: string; name?: string }>,
  url: URL
) {
  const tableId =
    url.searchParams.get("table") || url.searchParams.get("tableId")

  if (tableId) {
    const matched = tables.find((table) => table.table_id === tableId)
    if (!matched) {
      throw new Error("链接中的数据表不存在，请检查 table 参数是否正确")
    }
    return tableId
  }

  if (tables.length === 1) {
    url.searchParams.set("table", tables[0].table_id)
    return tables[0].table_id
  }

  throw new Error(
    "链接未指定 table 参数，且多维表格包含多个数据表，请在 URL 中带上 table= 参数"
  )
}

/** 解析 /base/ 或 /wiki/ 链接，Wiki 需调用飞书 API 换取 appToken */
export async function resolveBitableRef(url: string): Promise<ResolvedBitableRef> {
  const input = parseBitableUrlInput(url)
  if (!input) {
    throw new Error("请输入有效的飞书多维表格链接（支持 /base/ 与 /wiki/ 格式）")
  }

  const appToken =
    input.type === "base"
      ? input.token
      : await getWikiBitableAppToken(input.token)

  const tables = await listBitableTables(appToken)
  if (!tables.length) {
    throw new Error("当前多维表格中未检测到数据表，请先创建数据表")
  }

  const tableId = resolveTableId(tables, input.url)

  return {
    appToken,
    tableId,
    normalizedUrl: input.url.href
  }
}
