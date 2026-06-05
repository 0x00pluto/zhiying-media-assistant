import { Storage } from "@plasmohq/storage"

import { mergeFieldOptions } from "~features/feishu/sync-prefs"
import type { FieldOptions } from "~features/feishu/sync-records"
import type { ColumnDef } from "~shared/columns/types"

const storage = new Storage({ area: "local" })

export async function loadExportFieldOptions(
  storageKey: string,
  columns: ColumnDef[]
) {
  const saved = await storage.get<FieldOptions>(storageKey)
  return mergeFieldOptions(columns, saved || undefined)
}

export async function saveExportFieldOptions(
  storageKey: string,
  fieldOptions: FieldOptions
) {
  await storage.set(storageKey, fieldOptions)
}
