import type { ColumnDef } from "~shared/columns/types"

import { isUploadableMediaColumn } from "./media-upload"
import {
  createTableField,
  listTableFields,
  updateTableField,
  type BitableFieldItem,
  type BitableRef
} from "./bitable"

const FIELD_TYPE_LABELS: Record<number, string> = {
  1: "文本",
  2: "数字",
  3: "单选",
  4: "多选",
  5: "日期",
  7: "复选框",
  13: "电话号码",
  15: "超链接",
  17: "附件"
}

const GENERIC_PRIMARY_NAMES = new Set(["文本", "文字", "Text"])

function getAttachmentFieldName(columnName: string) {
  return columnName.endsWith("链接")
    ? columnName.replace("链接", "")
    : `${columnName}-附件`
}

function isCompatibleFieldType(existing: number, expected: number) {
  if (existing === expected) return true
  if ([1, 3, 15].includes(expected) && [1, 3, 15].includes(existing)) {
    return true
  }
  return false
}

function upsertLocalField(
  fields: BitableFieldItem[],
  field: BitableFieldItem
) {
  const index = fields.findIndex((item) => item.field_name === field.field_name)
  if (index >= 0) {
    fields[index] = { ...fields[index], ...field }
    return
  }
  fields.push(field)
}

async function ensureAttachmentField(
  ref: BitableRef,
  fields: BitableFieldItem[],
  linkFieldName: string
) {
  const attachmentName = getAttachmentFieldName(linkFieldName)
  const existing = fields.find((field) => field.field_name === attachmentName)

  if (existing && existing.type !== 17) {
    throw new Error(
      `字段【${attachmentName}】必须是附件类型字段，请修改类型后再试`
    )
  }

  if (!existing) {
    const created = await createTableField(ref, {
      field_name: attachmentName,
      type: 17,
      description: { text: `字段【${linkFieldName}】对应的附件` }
    })
    if (created) upsertLocalField(fields, created)
  }
}

type EnsureOptions = {
  shouldUploadMedia: boolean
  remark?: string
}

/**
 * 同步前检查并补全飞书表格字段。
 * 每次同步都会执行：先拉一次字段列表，缺失则创建，已存在则校验类型。
 */
export async function ensureSyncFields(
  ref: BitableRef,
  columns: ColumnDef[],
  options: EnsureOptions
): Promise<BitableFieldItem[]> {
  if (!columns.length) return []

  const fields = await listTableFields(ref)
  const primaryField = fields.find((field) => field.is_primary)
  const uniqueKey = columns[0].key
  const uploadMediaKeys = new Set(
    options.shouldUploadMedia
      ? columns.filter(isUploadableMediaColumn).map((column) => column.key)
      : []
  )

  for (const column of columns) {
    const fieldName = column.name
    let fieldType = column.feishu?.type || 1

    if (fieldType === 17) {
      fieldType = 1
      if (uploadMediaKeys.has(column.key)) {
        uploadMediaKeys.delete(column.key)
        await ensureAttachmentField(ref, fields, fieldName)
      }
    }

    const existing = fields.find((field) => field.field_name === fieldName)
    if (existing) {
      if (!isCompatibleFieldType(existing.type, fieldType)) {
        throw new Error(
          `字段【${fieldName}】类型不兼容，飞书当前为【${FIELD_TYPE_LABELS[existing.type] || existing.type}】，本次为【${FIELD_TYPE_LABELS[fieldType] || fieldType}】`
        )
      }
      continue
    }

    if (
      column.key === uniqueKey &&
      primaryField &&
      GENERIC_PRIMARY_NAMES.has(primaryField.field_name)
    ) {
      const updated = await updateTableField(ref, primaryField.field_id, {
        field_name: fieldName,
        type: fieldType,
        property: column.feishu?.property
      })
      if (updated) {
        upsertLocalField(fields, {
          ...primaryField,
          ...updated,
          field_name: fieldName,
          type: fieldType
        })
      }
    } else {
      const created = await createTableField(ref, {
        field_name: fieldName,
        type: fieldType === 15 ? 1 : fieldType,
        property: column.feishu?.property
      })
      if (created) upsertLocalField(fields, created)
    }
  }

  for (const key of uploadMediaKeys) {
    const column = columns.find((item) => item.key === key)
    if (!column) continue
    await ensureAttachmentField(ref, fields, column.name)
  }

  if (options.remark && !fields.some((field) => field.field_name === "备注")) {
    const created = await createTableField(ref, {
      field_name: "备注",
      type: 1,
      description: { text: "同步飞书时填写的备注信息" }
    })
    if (created) upsertLocalField(fields, created)
  }

  return fields
}
