export type PlatformCode =
  | "b23.tv"
  | "live.kuaishou"
  | "pgy.xiaohongshu"
  | "search.bilibili"
  | "space.bilibili"
  | "v.douyin"
  | "v.kuaishou"
  | "vt.tiktok"
  | "www.bilibili"
  | "www.douyin"
  | "www.iesdouyin"
  | "www.kuaishou"
  | "www.rednote"
  | "www.tiktok"
  | "www.xiaohongshu"
  | "www.xingtu"
  | "xhslink"

export interface Platform {
  code: PlatformCode
  name: string
  origin: string
  icon: string
}

export const PLATFORM_MATCHES = [
  "*://b23.tv/*",
  "*://live.kuaishou.com/*",
  "*://pgy.xiaohongshu.com/*",
  "*://search.bilibili.com/*",
  "*://space.bilibili.com/*",
  "*://v.douyin.com/*",
  "*://v.kuaishou.com/*",
  "*://vt.tiktok.com/*",
  "*://www.bilibili.com/*",
  "*://www.douyin.com/*",
  "*://www.iesdouyin.com/*",
  "*://www.kuaishou.com/*",
  "*://www.rednote.com/*",
  "*://www.tiktok.com/*",
  "*://www.xiaohongshu.com/*",
  "*://www.xingtu.cn/*",
  "*://xhslink.com/*"
] as const

/** MAIN world 注入范围（与原项目 manifest 一致） */
export const MAIN_WORLD_MATCHES = [
  "*://live.kuaishou.com/*",
  "*://pgy.xiaohongshu.com/*",
  "*://search.bilibili.com/*",
  "*://space.bilibili.com/*",
  "*://www.bilibili.com/*",
  "*://www.douyin.com/*",
  "*://www.kuaishou.com/*",
  "*://www.rednote.com/*",
  "*://www.tiktok.com/*",
  "*://www.xiaohongshu.com/*",
  "*://www.xingtu.cn/*"
] as const

export const PLATFORMS: Platform[] = [
  {
    code: "www.xiaohongshu",
    name: "小红书",
    origin: "https://www.xiaohongshu.com",
    icon: "xiaohongshu.svg"
  },
  {
    code: "pgy.xiaohongshu",
    name: "蒲公英",
    origin: "https://pgy.xiaohongshu.com",
    icon: "pgy.xiaohongshu.svg"
  },
  {
    code: "www.douyin",
    name: "抖音",
    origin: "https://www.douyin.com",
    icon: "douyin.svg"
  },
  {
    code: "www.bilibili",
    name: "哔哩哔哩",
    origin: "https://www.bilibili.com",
    icon: "bilibili.svg"
  },
  {
    code: "www.kuaishou",
    name: "快手",
    origin: "https://www.kuaishou.com",
    icon: "kuaishou.svg"
  },
  {
    code: "www.tiktok",
    name: "TikTok",
    origin: "https://www.tiktok.com",
    icon: "tiktok.svg"
  },
  {
    code: "www.xingtu",
    name: "星图",
    origin: "https://www.xingtu.cn",
    icon: "xingtu.svg"
  },
  {
    code: "www.rednote",
    name: "RedNote",
    origin: "https://www.rednote.com",
    icon: "xiaohongshu.svg"
  }
]

export function resolvePlatformByUrl(url: string): Platform | undefined {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "")
    return PLATFORMS.find((platform) => {
      const codeHost = platform.code.replace(/^www\./, "")
      return hostname === codeHost || hostname.endsWith(`.${codeHost}`)
    })
  } catch {
    return undefined
  }
}
