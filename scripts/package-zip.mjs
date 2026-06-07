#!/usr/bin/env node
/**
 * 生产构建 + 离线安装 zip 打包。
 * 版本号与扩展名称分别读取 package.json、locales/zh_CN/messages.json。
 *
 * 用法：
 *   pnpm package:zip              # build + 打包
 *   pnpm package:zip --skip-build # 仅打包（需已有 build/chrome-mv3-prod）
 */

import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const buildDir = join(root, "build/chrome-mv3-prod")
const distDir = join(root, "dist")

const skipBuild = process.argv.includes("--skip-build")

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8"))
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options
  })

  if (result.error) {
    console.error(result.error.message)
    process.exit(1)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const { version } = readJson("package.json")
const { extName } = readJson("locales/zh_CN/messages.json")
const productName = extName?.message?.trim() || "智赢媒体助手"
const zipName = `${productName}-v${version}.zip`
const zipPath = join(distDir, zipName)

if (!skipBuild) {
  console.log(">>> pnpm build")
  run("pnpm", ["build"])
} else {
  console.log(">>> skip build (--skip-build)")
}

const manifestPath = join(buildDir, "manifest.json")
if (!existsSync(manifestPath)) {
  console.error(`未找到构建产物：${manifestPath}`)
  console.error("请先执行 pnpm build，或去掉 --skip-build 重新运行。")
  process.exit(1)
}

mkdirSync(distDir, { recursive: true })
if (existsSync(zipPath)) {
  rmSync(zipPath)
}

console.log(`>>> zip ${zipName}`)
const zipResult = spawnSync("zip", ["-rq", zipPath, "."], {
  cwd: buildDir,
  stdio: "inherit"
})

if (zipResult.error) {
  console.error("zip 命令不可用，请确认系统已安装 zip（macOS 默认自带）。")
  process.exit(1)
}

if (zipResult.status !== 0) {
  process.exit(zipResult.status ?? 1)
}

console.log("")
console.log("打包完成")
console.log(`  版本：v${version}`)
console.log(`  产物：${zipPath}`)
console.log("")
console.log("离线安装：解压 zip 后，在 chrome://extensions 加载已解压的扩展程序。")
