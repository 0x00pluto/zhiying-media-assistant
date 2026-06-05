import { useEffect, useState } from "react"

import {
  XIAOHONGSHU_COLLECT_CONFIG_KEY,
  xiaohongshuCollectConfigStorage
} from "~features/xiaohongshu/storage"

export const NOTE_BATCH_COLLECT_DISABLED_HINT =
  "笔记批量采集未开启。请打开扩展设置 → 采集设置，开启「笔记批量采集」后再试。建议每次少采几条、间隔放慢，降低小红书风控风险。"

export function useNoteBatchCollectEnabled() {
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true

    const refresh = async () => {
      const config = await xiaohongshuCollectConfigStorage.get()
      if (!mounted) return
      setEnabled(Boolean(config.noteBatchEnabled))
      setReady(true)
    }

    void refresh()

    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== "local" || !changes[XIAOHONGSHU_COLLECT_CONFIG_KEY]) return
      void refresh()
    }

    chrome.storage.onChanged.addListener(onStorageChanged)
    return () => {
      mounted = false
      chrome.storage.onChanged.removeListener(onStorageChanged)
    }
  }, [])

  return { enabled, ready }
}

export async function getNoteBatchCollectEnabled() {
  const config = await xiaohongshuCollectConfigStorage.get()
  return Boolean(config.noteBatchEnabled)
}
