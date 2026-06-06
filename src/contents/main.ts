import type { PlasmoCSConfig } from "plasmo"

import { bootstrapMainWorld } from "~features/xiaohongshu/main-world/bootstrap"

// matches 必须为字面量数组，Plasmo 才能在构建时写入 manifest（不可从常量 spread）
export const config: PlasmoCSConfig = {
  matches: [
    "*://pgy.xiaohongshu.com/*",
    "*://www.rednote.com/*",
    "*://www.xiaohongshu.com/*",
    "*://xhslink.com/*"
  ],
  run_at: "document_start",
  world: "MAIN"
}

bootstrapMainWorld()
;(window as Window & { __quanmediacrawlMainLoaded?: boolean }).__quanmediacrawlMainLoaded =
  true

console.info("[quanmediacrawl] main world content script loaded")
