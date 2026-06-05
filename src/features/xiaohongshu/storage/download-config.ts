import { Storage } from "@plasmohq/storage"

const storage = new Storage({ area: "local" })

export type DownloadConfig = {
  version: number
  conflictAction: "uniquify" | "overwrite" | "prompt"
  namingTemplate: string
}

const DEFAULT_CONFIG: DownloadConfig = {
  version: 4,
  conflictAction: "uniquify",
  namingTemplate: "全媒采集助手/小红书/{博主昵称}/{笔记ID}/{发布时间}-{笔记标题}"
}

export const downloadConfigStorage = {
  async get(): Promise<DownloadConfig> {
    return (
      (await storage.get<DownloadConfig>("local:xiaohongshu:downloadConfig")) ||
      DEFAULT_CONFIG
    )
  },
  async set(config: DownloadConfig) {
    await storage.set("local:xiaohongshu:downloadConfig", config)
  }
}
