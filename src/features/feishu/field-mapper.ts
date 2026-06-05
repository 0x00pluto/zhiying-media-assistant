import type { ColumnDef } from "~shared/columns/types"

import type { BitableFieldItem } from "./bitable"

/** 解析小红书常见的「1.2万」「10万+」等数字文本 */
export function parseFeishuNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined
  if (typeof value === "number") {
    return Number.isNaN(value) ? undefined : value
  }

  let text = String(value).trim().replace(/[￥¥,]/g, "")
  const units: Record<string, number> = {
    W: 10000,
    w: 10000,
    K: 1000,
    k: 1000,
    千: 1000,
    万: 10000,
    亿: 100000000
  }

  const matched = text.match(/^([+-]?[\d.]+)([a-zA-Z\u4e00-\u9fa5]*)\+?$/)
  if (!matched) {
    const num = Number(text)
    return Number.isNaN(num) ? undefined : num
  }

  let num = Number(matched[1])
  const unit = matched[2]
  if (!Number.isNaN(num) && unit && units[unit]) {
    num *= units[unit]
  }
  return Number.isNaN(num) ? undefined : num
}

export function parseFeishuDate(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined

  if (typeof value === "number") {
    // 飞书日期字段使用毫秒时间戳；若像秒级则转换
    return value < 1e12 ? value * 1000 : value
  }

  const parsed = Date.parse(String(value))
  return Number.isNaN(parsed) ? undefined : parsed
}

export function formatFieldValue(
  value: unknown,
  column: ColumnDef,
  actualField?: BitableFieldItem
) {
  if (value === undefined || value === null || value === "") return undefined

  const fieldType = actualField?.type ?? column.feishu?.type ?? 1

  switch (fieldType) {
    case 15: {
      if (typeof value !== "string") return undefined
      return { link: value, text: value }
    }
    case 2: {
      return parseFeishuNumber(value)
    }
    case 5: {
      return parseFeishuDate(value)
    }
    case 4: {
      const list = Array.isArray(value) ? value : [value]
      return list.map((item) => String(item)).filter(Boolean)
    }
    case 3: {
      return String(value)
    }
    case 17: {
      return Array.isArray(value) ? value.join("\n") : String(value)
    }
    default: {
      if (Array.isArray(value)) return value.map((item) => String(item)).join("\n")
      return String(value)
    }
  }
}

export function mapRecordToFeishuFields(
  record: Record<string, unknown>,
  columns: ColumnDef[],
  tableFields: BitableFieldItem[] = []
) {
  const fieldMap = new Map(tableFields.map((field) => [field.field_name, field]))
  const fields: Record<string, unknown> = {}

  for (const column of columns) {
    const value = record[column.key]
    const formatted = formatFieldValue(
      value,
      column,
      fieldMap.get(column.name)
    )
    if (formatted !== undefined) {
      fields[column.name] = formatted
    }
  }

  return fields
}
