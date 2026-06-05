import { Storage } from "@plasmohq/storage"

const storage = new Storage({ area: "local" })

const COLLECT_CONFIG_KEY = "local:xiaohongshu:collectConfig"

export type XiaohongshuCollectConfig = {
  /** 笔记批量采集（链接/关键词/本页/博主笔记列表） */
  noteBatchEnabled: boolean
}

const DEFAULT_COLLECT_CONFIG: XiaohongshuCollectConfig = {
  noteBatchEnabled: false
}

export const xiaohongshuCollectConfigStorage = {
  async get(): Promise<XiaohongshuCollectConfig> {
    const value = await storage.get<XiaohongshuCollectConfig>(COLLECT_CONFIG_KEY)
    return { ...DEFAULT_COLLECT_CONFIG, ...value }
  },
  async set(config: Partial<XiaohongshuCollectConfig>) {
    const current = await this.get()
    await storage.set(COLLECT_CONFIG_KEY, { ...current, ...config })
  }
}

export const XIAOHONGSHU_COLLECT_CONFIG_KEY = COLLECT_CONFIG_KEY
