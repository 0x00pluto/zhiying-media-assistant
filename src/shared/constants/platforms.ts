export type PlatformCode =
  | "pgy.xiaohongshu"
  | "www.rednote"
  | "www.xiaohongshu"
  | "xhslink"

export interface Platform {
  code: PlatformCode
  name: string
  origin: string
  icon: string
}

export const PLATFORM_MATCHES = [
  "*://pgy.xiaohongshu.com/*",
  "*://www.rednote.com/*",
  "*://www.xiaohongshu.com/*",
  "*://xhslink.com/*"
] as const

/** MAIN world 注入范围（须与 contents/main.ts matches 保持一致） */
export const MAIN_WORLD_MATCHES = [
  "*://pgy.xiaohongshu.com/*",
  "*://www.rednote.com/*",
  "*://www.xiaohongshu.com/*",
  "*://xhslink.com/*"
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
