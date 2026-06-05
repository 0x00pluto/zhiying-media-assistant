import { Storage } from "@plasmohq/storage"

import type { ColumnDef } from "~shared/columns/types"

import type { FieldOptions } from "./sync-records"

const storage = new Storage({ area: "local" })

export type FeishuQuickSyncPrefs = {
  url?: string
  mode?: "merge" | "append"
  shouldUploadMedia?: boolean
  fieldOptions?: FieldOptions
  remark?: string
}

function prefsKey(storageKey: string) {
  return `feishuQuickSync:${storageKey}`
}

function historyKey(storageKey: string) {
  return `feishuQuickSyncHistory:${storageKey}`
}

export async function loadFeishuQuickSync(storageKey: string) {
  const saved = await storage.get<FeishuQuickSyncPrefs>(prefsKey(storageKey))
  if (saved) return saved

  // 兼容旧版写在页面 localStorage 的配置
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FeishuQuickSyncPrefs
    await storage.set(prefsKey(storageKey), parsed)
    localStorage.removeItem(storageKey)
    return parsed
  } catch {
    return null
  }
}

export async function saveFeishuQuickSync(
  storageKey: string,
  prefs: FeishuQuickSyncPrefs
) {
  await storage.set(prefsKey(storageKey), prefs)
}

export async function saveFeishuUrl(storageKey: string, url: string) {
  const current = (await loadFeishuQuickSync(storageKey)) || {}
  await saveFeishuQuickSync(storageKey, { ...current, url })
}

export async function loadFeishuUrlHistories(storageKey: string) {
  return (await storage.get<string[]>(historyKey(storageKey))) || []
}

/** 合并已保存字段与当前默认字段，自动补上新增列（如笔记话题） */
export function mergeFieldOptions(
  columns: ColumnDef[],
  saved?: FieldOptions
): FieldOptions {
  const defaultKeys = columns
    .filter((column) => column.default !== false)
    .map((column) => column.key)
  const allKeys = new Set(columns.map((column) => column.key))

  if (!saved?.keys?.length) {
    return {
      skipEmpty: saved?.skipEmpty ?? true,
      keys: defaultKeys
    }
  }

  const validSavedKeys = saved.keys.filter((key) => allKeys.has(key))
  const newDefaultKeys = defaultKeys.filter(
    (key) => !validSavedKeys.includes(key)
  )

  return {
    skipEmpty: saved.skipEmpty ?? true,
    keys: [...validSavedKeys, ...newDefaultKeys]
  }
}

export async function saveFeishuUrlHistory(storageKey: string, url: string) {
  const histories = (await loadFeishuUrlHistories(storageKey)).filter(
    (item) => item !== url
  )
  histories.unshift(url)
  await storage.set(historyKey(storageKey), histories.slice(0, 8))
}
