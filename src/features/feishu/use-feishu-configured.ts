import { useEffect, useState } from "react"

import {
  type FeishuConfig,
  feishuConfigStorage
} from "~features/feishu/storage"

const FEISHU_CONFIG_STORAGE_KEY = "local:feishuConfig"

export function isFeishuConfigured(config: FeishuConfig): boolean {
  return Boolean(config.appId?.trim() && config.appSecret?.trim())
}

export function useFeishuConfigured() {
  const [configured, setConfigured] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true

    const refresh = async () => {
      const config = await feishuConfigStorage.get()
      if (!mounted) return
      setConfigured(isFeishuConfigured(config))
      setReady(true)
    }

    void refresh()

    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== "local" || !changes[FEISHU_CONFIG_STORAGE_KEY]) return
      void refresh()
    }

    chrome.storage.onChanged.addListener(onStorageChanged)
    return () => {
      mounted = false
      chrome.storage.onChanged.removeListener(onStorageChanged)
    }
  }, [])

  return { configured, ready }
}
