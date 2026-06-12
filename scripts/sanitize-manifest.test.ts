import { describe, expect, it } from "vitest"

import {
  assertManifestFilesExist,
  globMatchesAny,
  isGlobPattern,
  sanitizeManifestObject
} from "../scripts/sanitize-manifest.mjs"

const buildFiles = new Set([
  "static/background/index.js",
  "xiaohongshu-explore-feed.abc123.js",
  "xiaohongshu-explore-feed.def456.css",
  "tabs/download-repeater.html",
  "assets/platforms/xiaohongshu.svg",
  "options.html",
  "icon128.plasmo.png"
])

describe("sanitize-manifest", () => {
  it("识别 glob 模式", () => {
    expect(isGlobPattern("assets/platforms/*.svg")).toBe(true)
    expect(isGlobPattern("xiaohongshu-explore-feed.b2211677.css")).toBe(false)
  })

  it("glob 能匹配构建目录中的文件", () => {
    expect(globMatchesAny("assets/platforms/*.svg", buildFiles)).toBe(true)
    expect(globMatchesAny("missing/*.png", buildFiles)).toBe(false)
  })

  it("移除 ghost CSS 并保留真实引用", () => {
    const manifest = {
      content_scripts: [
        {
          matches: ["*://www.xiaohongshu.com/*"],
          js: ["xiaohongshu-explore-feed.abc123.js"],
          css: [
            "xiaohongshu-explore-feed.b2211677.css",
            "xiaohongshu-explore-feed.def456.css"
          ]
        }
      ],
      background: { service_worker: "static/background/index.js" },
      web_accessible_resources: [
        {
          matches: ["*://www.xiaohongshu.com/*"],
          resources: [
            "xiaohongshu-explore-feed.ghost.css",
            "tabs/download-repeater.html",
            "assets/platforms/*.svg"
          ]
        }
      ]
    }

    const { manifest: next, removed } = sanitizeManifestObject(manifest, buildFiles)

    expect(removed).toEqual([
      "content_scripts[0].css: xiaohongshu-explore-feed.b2211677.css",
      "web_accessible_resources[0]: xiaohongshu-explore-feed.ghost.css"
    ])
    expect(next.content_scripts?.[0]?.css).toEqual([
      "xiaohongshu-explore-feed.def456.css"
    ])
    expect(next.web_accessible_resources?.[0]?.resources).toEqual([
      "tabs/download-repeater.html",
      "assets/platforms/*.svg"
    ])
  })

  it("清理后 manifest 中所有精确路径均存在", () => {
    const manifest = {
      content_scripts: [
        {
          js: ["xiaohongshu-explore-feed.abc123.js"],
          css: ["xiaohongshu-explore-feed.b2211677.css"]
        }
      ],
      background: { service_worker: "static/background/index.js" }
    }

    const { manifest: next } = sanitizeManifestObject(manifest, buildFiles)
    expect(() => assertManifestFilesExist(next, buildFiles)).not.toThrow()
  })

  it("关键文件缺失时抛出错误", () => {
    const manifest = {
      background: { service_worker: "missing.js" },
      action: { default_popup: "popup.html" }
    }

    const { manifest: next } = sanitizeManifestObject(manifest, buildFiles)
    expect(() => assertManifestFilesExist(next, buildFiles)).toThrow(
      /缺少关键文件引用/
    )
  })
})
