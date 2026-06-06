import { Storage } from "@plasmohq/storage"

import type { ColumnDef } from "~shared/columns/types"

import type { FieldOptions } from "./sync-records"

const storage = new Storage({ area: "local" })

export type FeishuBitableTarget = {
  url: string
  appName?: string
  tableName?: string
  resolvedAt?: number
}

export type FeishuQuickSyncPrefs = {
  target?: FeishuBitableTarget
  /** @deprecated 读取时迁移到 target */
  url?: string
  mode?: "merge" | "append"
  shouldUploadMedia?: boolean
  fieldOptions?: FieldOptions
  remark?: string
}

export const FEISHU_TARGET_KEYS = {
  noteDetail: "qmc-feishu-target:note-detail",
  batchNote: "qmc-feishu-target:batch-note",
  batchBlogger: "qmc-feishu-target:batch-blogger",
  batchComment: "qmc-feishu-target:batch-comment"
} as const

/** 新 storageKey → 旧 storageKey（lazy 迁移，不删旧 key） */
const LEGACY_STORAGE_KEY_MAP: Record<string, string> = {
  [FEISHU_TARGET_KEYS.noteDetail]: "qmc-quickSyncFeishu-note",
  [FEISHU_TARGET_KEYS.batchNote]: "qmc-quickSyncFeishu-batch",
  [FEISHU_TARGET_KEYS.batchComment]: "qmc-quickSyncFeishu-comment"
}

function prefsKey(storageKey: string) {
  return `feishuQuickSync:${storageKey}`
}

function historyKey(storageKey: string) {
  return `feishuQuickSyncHistory:${storageKey}`
}

export function getTargetUrl(prefs?: FeishuQuickSyncPrefs | null) {
  return prefs?.target?.url ?? prefs?.url ?? ""
}

export function formatBitableTargetLabel(target: FeishuBitableTarget) {
  if (target.appName && target.tableName) {
    return `${target.appName} · ${target.tableName}`
  }
  return target.url
}

/** 将裸 url 迁移为 target 结构；返回是否发生变更 */
export function normalizePrefs(prefs: FeishuQuickSyncPrefs): {
  prefs: FeishuQuickSyncPrefs
  changed: boolean
} {
  if (prefs.target?.url) {
    const { url: _legacyUrl, ...rest } = prefs
    const changed = Boolean(_legacyUrl)
    return { prefs: rest, changed }
  }

  if (prefs.url) {
    const { url, ...rest } = prefs
    return {
      prefs: { ...rest, target: { url } },
      changed: true
    }
  }

  return { prefs, changed: false }
}

function normalizeHistoryItem(
  item: string | FeishuBitableTarget
): FeishuBitableTarget {
  return typeof item === "string" ? { url: item } : item
}

async function loadRawPrefs(storageKey: string) {
  return storage.get<FeishuQuickSyncPrefs>(prefsKey(storageKey))
}

async function loadLegacyPrefs(storageKey: string) {
  const legacyKey = LEGACY_STORAGE_KEY_MAP[storageKey]
  if (!legacyKey) return null

  const fromLegacy = await loadRawPrefs(legacyKey)
  if (fromLegacy) return fromLegacy

  try {
    const raw = localStorage.getItem(legacyKey)
    if (!raw) return null
    return JSON.parse(raw) as FeishuQuickSyncPrefs
  } catch {
    return null
  }
}

async function persistPrefs(storageKey: string, prefs: FeishuQuickSyncPrefs) {
  await storage.set(prefsKey(storageKey), prefs)
}

export async function loadFeishuQuickSync(storageKey: string) {
  let saved = await loadRawPrefs(storageKey)

  if (!saved) {
    saved = await loadLegacyPrefs(storageKey)
    if (!saved) {
      try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) return null
        saved = JSON.parse(raw) as FeishuQuickSyncPrefs
        localStorage.removeItem(storageKey)
      } catch {
        return null
      }
    }
  }

  const { prefs, changed } = normalizePrefs(saved)
  if (changed || !saved.target) {
    await persistPrefs(storageKey, prefs)
  }
  return prefs
}

export async function saveFeishuQuickSync(
  storageKey: string,
  prefs: FeishuQuickSyncPrefs
) {
  const { prefs: normalized } = normalizePrefs(prefs)
  await persistPrefs(storageKey, normalized)
}

export async function saveFeishuUrl(storageKey: string, url: string) {
  const current = (await loadFeishuQuickSync(storageKey)) || {}
  const target: FeishuBitableTarget = {
    ...(current.target?.url === url ? current.target : {}),
    url
  }
  await saveFeishuQuickSync(storageKey, { ...current, target })
}

export async function loadFeishuTargetHistories(storageKey: string) {
  const raw = await storage.get<Array<string | FeishuBitableTarget>>(
    historyKey(storageKey)
  )
  if (!raw?.length) {
    const legacyKey = LEGACY_STORAGE_KEY_MAP[storageKey]
    if (legacyKey) {
      const legacyRaw = await storage.get<Array<string | FeishuBitableTarget>>(
        historyKey(legacyKey)
      )
      if (legacyRaw?.length) {
        const migrated = legacyRaw.map(normalizeHistoryItem)
        await storage.set(historyKey(storageKey), migrated)
        return migrated
      }
    }
    return []
  }

  const needsMigration = raw.some((item) => typeof item === "string")
  const histories = raw.map(normalizeHistoryItem)
  if (needsMigration) {
    await storage.set(historyKey(storageKey), histories)
  }
  return histories
}

/** @deprecated 使用 loadFeishuTargetHistories */
export async function loadFeishuUrlHistories(storageKey: string) {
  const histories = await loadFeishuTargetHistories(storageKey)
  return histories.map((item) => item.url)
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

export async function saveFeishuTargetHistory(
  storageKey: string,
  target: FeishuBitableTarget
) {
  const histories = (await loadFeishuTargetHistories(storageKey)).filter(
    (item) => item.url !== target.url
  )
  histories.unshift(target)
  await storage.set(historyKey(storageKey), histories.slice(0, 8))
}

/** @deprecated 使用 saveFeishuTargetHistory */
export async function saveFeishuUrlHistory(storageKey: string, url: string) {
  await saveFeishuTargetHistory(storageKey, { url })
}
