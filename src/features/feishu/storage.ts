import { Storage } from "@plasmohq/storage"

const storage = new Storage({ area: "local" })

export type FeishuConfig = {
  provider: "custom"
  appId: string
  appSecret: string
}

export type FeishuSyncConfig = {
  maxBatchSize: number
  maxBatchSizeWithMedias: number
  maxConcurrentUploads: number
  maxFileSize: number
}

export const feishuConfigStorage = {
  async get(): Promise<FeishuConfig> {
    const value = await storage.get<FeishuConfig>("local:feishuConfig")
    return (
      value || {
        provider: "custom",
        appId: "",
        appSecret: ""
      }
    )
  },
  async set(config: FeishuConfig) {
    await storage.set("local:feishuConfig", config)
  }
}

export const feishuSyncConfigStorage = {
  async get(): Promise<FeishuSyncConfig> {
    const value = await storage.get<FeishuSyncConfig>("local:feishuSyncConfig")
    return (
      value || {
        maxBatchSize: 500,
        maxBatchSizeWithMedias: 100,
        maxConcurrentUploads: 5,
        maxFileSize: 20
      }
    )
  },
  async set(config: FeishuSyncConfig) {
    await storage.set("local:feishuSyncConfig", config)
  }
}

export type XiaohongshuFieldConfig = {
  note?: {
    removeContentTags?: boolean
  }
}

export const xiaohongshuFieldConfigStorage = {
  async get(): Promise<XiaohongshuFieldConfig> {
    return (await storage.get<XiaohongshuFieldConfig>("local:xiaohongshu:fieldConfig")) || {}
  },
  async set(config: XiaohongshuFieldConfig) {
    await storage.set("local:xiaohongshu:fieldConfig", config)
  }
}
