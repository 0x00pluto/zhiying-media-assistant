import { pickColumns } from "~shared/columns/pick"
import type { ColumnDef } from "~shared/columns/types"
import { feishuUploadMedia } from "~shared/messaging"

import {
  batchCreateRecordsWithFields,
  batchUpdateRecords,
  listAllRecordsByFields,
  type BitableFieldItem,
  type BitableRecordItem,
  type BitableRef
} from "./bitable"
import { getTenantAccessToken } from "./client"
import { ensureSyncFields } from "./ensure-fields"
import { mapRecordToFeishuFields } from "./field-mapper"
import {
  hasUploadableMediaColumns,
  isUploadableMediaColumn
} from "./media-upload"
import { feishuSyncConfigStorage } from "./storage"

export type FieldOptions = {
  keys: string[]
  skipEmpty?: boolean
}

export type FeishuSyncParams = {
  appToken: string
  tableId: string
  mode: "merge" | "append"
  shouldUploadMedia: boolean
  fieldOptions: FieldOptions
  remark?: string
}

function pickRecord(
  record: Record<string, unknown>,
  columns: ColumnDef[],
  skipEmpty?: boolean
) {
  const picked: Record<string, unknown> = {}
  for (const column of columns) {
    const value = record[column.key]
    if (skipEmpty && (value === undefined || value === null || value === "")) {
      continue
    }
    if (value !== undefined) {
      picked[column.key] = value
    }
  }
  return picked
}

function getAttachmentFieldName(columnName: string) {
  return columnName.endsWith("链接")
    ? columnName.replace("链接", "")
    : `${columnName}-附件`
}

function getMediaUrls(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean)
  }
  if (typeof value === "string" && value.includes("\n")) {
    return value.split("\n").map((item) => item.trim()).filter(Boolean)
  }
  if (value !== undefined && value !== null && value !== "") {
    return [String(value)]
  }
  return []
}

async function uploadMediaForFields(
  fields: Record<string, unknown>,
  columns: ColumnDef[],
  appToken: string,
  token: string
) {
  const syncConfig = await feishuSyncConfigStorage.get()
  const maxConcurrent = syncConfig.maxConcurrentUploads || 5

  for (const column of columns) {
    if (!isUploadableMediaColumn(column)) continue

    const urls = getMediaUrls(fields[column.name])
    if (!urls.length) continue

    const attachmentName = getAttachmentFieldName(column.name)
    const extension =
      (column.feishu as { file_extension?: string }).file_extension || "jpg"
    const tokens: Array<{ file_token: string }> = []

    for (let i = 0; i < urls.length; i += maxConcurrent) {
      const chunk = urls.slice(i, i + maxConcurrent)
      const uploaded = await Promise.all(
        chunk.map(async (url, index) => {
          const result = (await feishuUploadMedia({
            url,
            file_name: `${column.key}_${i + index}.${extension}`,
            parent_type: ["jpg", "png", "webp"].includes(extension)
              ? "bitable_image"
              : "bitable_file",
            parent_node: appToken,
            token
          })) as { file_token?: string }

          if (!result?.file_token) {
            throw new Error(`素材上传失败：${column.name}`)
          }
          return { file_token: result.file_token }
        })
      )
      tokens.push(...uploaded)
    }

    fields[attachmentName] = tokens
    fields[column.name] = urls.join("\n")
  }
}

async function buildFeishuFields(
  record: Record<string, unknown>,
  columns: ColumnDef[],
  options: FeishuSyncParams,
  token: string,
  tableFields: BitableFieldItem[]
) {
  const syncRecord = { ...record }
  if (columns.some((column) => column.key === "update_time")) {
    syncRecord.update_time = Date.now()
  }

  const fields = mapRecordToFeishuFields(syncRecord, columns, tableFields)

  if (options.remark) {
    fields["备注"] = options.remark
  }

  if (options.shouldUploadMedia) {
    const mediaColumns = columns.filter(isUploadableMediaColumn)
    await uploadMediaForFields(
      fields,
      mediaColumns,
      options.appToken,
      token
    )
  } else {
    for (const column of columns) {
      if (column.feishu?.type !== 17) continue
      const value = fields[column.name]
      if (Array.isArray(value)) {
        fields[column.name] = value.join("\n")
      }
    }
  }

  return fields
}

function readFeishuFieldValue(
  fields: Record<string, unknown>,
  fieldName: string
) {
  const raw = fields[fieldName]
  if (raw === undefined || raw === null) return undefined

  if (Array.isArray(raw)) {
    const first = raw[0] as { text?: string } | string | number | undefined
    if (typeof first === "object" && first !== null && "text" in first) {
      return first.text
    }
    return first
  }

  if (typeof raw === "object" && "text" in (raw as { text?: string })) {
    return (raw as { text?: string }).text
  }

  return raw
}

function findExistingRecordId(
  existingRecords: BitableRecordItem[],
  uniqueFieldName: string,
  value: unknown
) {
  if (value === undefined || value === null || value === "") return null

  const target = String(value)
  const matched = existingRecords.find((item) => {
    const current = readFeishuFieldValue(item.fields, uniqueFieldName)
    return current !== undefined && String(current) === target
  })

  return matched?.record_id || null
}

export async function syncRecordsToFeishu(
  ref: BitableRef,
  records: Record<string, unknown>[],
  columns: ColumnDef[],
  options: FeishuSyncParams
) {
  if (!records.length) {
    throw new Error("没有可同步的数据")
  }

  const selectedColumns = pickColumns(columns, options.fieldOptions)
  if (!selectedColumns.length) {
    throw new Error("请至少选择一个同步字段")
  }

  const tableFields = await ensureSyncFields(ref, selectedColumns, {
    shouldUploadMedia: options.shouldUploadMedia,
    remark: options.remark
  })

  const token = await getTenantAccessToken()
  const uniqueColumn = selectedColumns[0]
  const syncConfig = await feishuSyncConfigStorage.get()
  const chunkSize = hasUploadableMediaColumns(
    selectedColumns,
    options.shouldUploadMedia
  )
    ? syncConfig.maxBatchSizeWithMedias
    : syncConfig.maxBatchSize

  let created = 0
  let updated = 0
  const uniqueFieldName = uniqueColumn.name
  const existingRecords =
    options.mode === "merge"
      ? await listAllRecordsByFields(ref, [uniqueFieldName])
      : []

  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize)

    if (options.mode === "append") {
      const payload = []
      for (const record of chunk) {
        const picked = pickRecord(
          record,
          selectedColumns,
          options.fieldOptions.skipEmpty
        )
        payload.push({
          fields: await buildFeishuFields(
            picked,
            selectedColumns,
            options,
            token,
            tableFields
          )
        })
      }
      const ids = await batchCreateRecordsWithFields(ref, payload)
      created += ids.length
      continue
    }

    const toCreate: Array<{ fields: Record<string, unknown> }> = []
    const toUpdate: Array<{
      record_id: string
      fields: Record<string, unknown>
    }> = []

    for (const record of chunk) {
      const picked = pickRecord(
        record,
        selectedColumns,
        options.fieldOptions.skipEmpty
      )
      const fields = await buildFeishuFields(
        picked,
        selectedColumns,
        options,
        token,
        tableFields
      )
      const recordId = findExistingRecordId(
        existingRecords,
        uniqueFieldName,
        picked[uniqueColumn.key]
      )

      if (recordId) {
        toUpdate.push({ record_id: recordId, fields })
      } else {
        toCreate.push({ fields })
      }
    }

    if (toUpdate.length) {
      await batchUpdateRecords(ref, toUpdate)
      updated += toUpdate.length
    }

    if (toCreate.length) {
      const ids = await batchCreateRecordsWithFields(ref, toCreate)
      created += ids.length
    }
  }

  return { created, updated }
}
