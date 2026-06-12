#!/usr/bin/env node
/**
 * 清理 Plasmo 构建产物 manifest.json 中指向不存在文件的引用。
 * 用于 Edge 商店等严格校验场景（Plasmo #1153 / #1215 ghost CSS 引用）。
 */

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs"
import { join, relative } from "node:path"

/** @typedef {{ manifest: Record<string, unknown>, removed: string[] }} SanitizeResult */

/**
 * @param {string} buildDir
 * @returns {Set<string>}
 */
export function collectBuildFiles(buildDir) {
  /** @type {Set<string>} */
  const files = new Set()

  /** @param {string} dir */
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry)
      const relPath = relative(buildDir, fullPath).replace(/\\/g, "/")
      if (statSync(fullPath).isDirectory()) {
        walk(fullPath)
      } else {
        files.add(relPath)
      }
    }
  }

  walk(buildDir)
  return files
}

/**
 * @param {string} value
 */
export function isGlobPattern(value) {
  return value.includes("*") || value.includes("?")
}

/**
 * @param {string} glob
 */
export function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&")
  const pattern = escaped
    .replace(/\*\*/g, "§§GLOBSTAR§§")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/§§GLOBSTAR§§/g, ".*")
  return new RegExp(`^${pattern}$`)
}

/**
 * @param {string} glob
 * @param {Set<string>} files
 */
export function globMatchesAny(glob, files) {
  const re = globToRegExp(glob)
  for (const file of files) {
    if (re.test(file)) return true
  }
  return false
}

/**
 * @param {string} ref
 * @param {Set<string>} files
 */
export function resourceRefExists(ref, files) {
  if (isGlobPattern(ref)) {
    return globMatchesAny(ref, files)
  }
  return files.has(ref)
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0
}

/**
 * @param {string[]} refs
 * @param {Set<string>} files
 * @param {string[]} removed
 * @param {string} label
 */
function filterExistingRefs(refs, files, removed, label) {
  return refs.filter((ref) => {
    if (resourceRefExists(ref, files)) return true
    removed.push(`${label}: ${ref}`)
    return false
  })
}

/**
 * @param {Record<string, string> | undefined} icons
 * @param {Set<string>} files
 * @param {string[]} removed
 * @param {string} label
 */
function filterIconMap(icons, files, removed, label) {
  if (!icons || typeof icons !== "object") return icons

  /** @type {Record<string, string>} */
  const next = {}
  for (const [size, path] of Object.entries(icons)) {
    if (isNonEmptyString(path) && files.has(path)) {
      next[size] = path
    } else if (isNonEmptyString(path)) {
      removed.push(`${label}[${size}]: ${path}`)
    }
  }
  return Object.keys(next).length ? next : undefined
}

/**
 * @param {Record<string, unknown>} manifest
 * @param {Set<string>} files
 * @returns {SanitizeResult}
 */
export function sanitizeManifestObject(manifest, files) {
  /** @type {string[]} */
  const removed = []
  const next = structuredClone(manifest)

  if (Array.isArray(next.content_scripts)) {
    next.content_scripts = next.content_scripts.map((entry, index) => {
      if (!entry || typeof entry !== "object") return entry
      const script = { ...entry }

      if (Array.isArray(script.js)) {
        script.js = filterExistingRefs(
          script.js,
          files,
          removed,
          `content_scripts[${index}].js`
        )
      }

      if (Array.isArray(script.css)) {
        script.css = filterExistingRefs(
          script.css,
          files,
          removed,
          `content_scripts[${index}].css`
        )
        if (script.css.length === 0) delete script.css
      }

      return script
    })
  }

  if (Array.isArray(next.web_accessible_resources)) {
    next.web_accessible_resources = next.web_accessible_resources
      .map((entry, index) => {
        if (!entry || typeof entry !== "object") return entry
        const war = { ...entry }

        if (Array.isArray(war.resources)) {
          war.resources = war.resources.filter((ref) => {
            if (!isNonEmptyString(ref)) return false
            if (isGlobPattern(ref)) return true
            if (files.has(ref)) return true
            removed.push(`web_accessible_resources[${index}]: ${ref}`)
            return false
          })
        }

        return war
      })
      .filter((entry) => {
        if (!entry || typeof entry !== "object") return false
        return Array.isArray(entry.resources) && entry.resources.length > 0
      })

    if (next.web_accessible_resources.length === 0) {
      delete next.web_accessible_resources
    }
  }

  if (next.background && typeof next.background === "object") {
    const bg = { ...next.background }
    if (
      isNonEmptyString(bg.service_worker) &&
      !files.has(bg.service_worker)
    ) {
      removed.push(`background.service_worker: ${bg.service_worker}`)
      delete bg.service_worker
    }
    next.background = bg
  }

  if (next.action && typeof next.action === "object") {
    const action = { ...next.action }
    if (
      isNonEmptyString(action.default_popup) &&
      !files.has(action.default_popup)
    ) {
      removed.push(`action.default_popup: ${action.default_popup}`)
      delete action.default_popup
    }
    if (action.default_icon) {
      action.default_icon = filterIconMap(
        action.default_icon,
        files,
        removed,
        "action.default_icon"
      )
      if (!action.default_icon) delete action.default_icon
    }
    next.action = action
  }

  if (next.options_ui && typeof next.options_ui === "object") {
    const optionsUi = { ...next.options_ui }
    if (isNonEmptyString(optionsUi.page) && !files.has(optionsUi.page)) {
      removed.push(`options_ui.page: ${optionsUi.page}`)
      delete optionsUi.page
    }
    next.options_ui = optionsUi
  }

  if (next.icons) {
    next.icons = filterIconMap(next.icons, files, removed, "icons")
    if (!next.icons) delete next.icons
  }

  return { manifest: next, removed }
}

/**
 * @param {Record<string, unknown>} manifest
 * @param {Set<string>} files
 * @returns {string[]}
 */
export function collectManifestFileRefs(manifest) {
  /** @type {string[]} */
  const refs = []

  const pushRef = (ref) => {
    if (isNonEmptyString(ref) && !isGlobPattern(ref)) refs.push(ref)
  }

  if (Array.isArray(manifest.content_scripts)) {
    for (const entry of manifest.content_scripts) {
      if (!entry || typeof entry !== "object") continue
      if (Array.isArray(entry.js)) entry.js.forEach(pushRef)
      if (Array.isArray(entry.css)) entry.css.forEach(pushRef)
    }
  }

  if (Array.isArray(manifest.web_accessible_resources)) {
    for (const entry of manifest.web_accessible_resources) {
      if (!entry || typeof entry !== "object") continue
      if (Array.isArray(entry.resources)) {
        entry.resources.forEach((ref) => {
          if (isNonEmptyString(ref) && !isGlobPattern(ref)) pushRef(ref)
        })
      }
    }
  }

  if (manifest.background && typeof manifest.background === "object") {
    pushRef(manifest.background.service_worker)
  }

  if (manifest.action && typeof manifest.action === "object") {
    pushRef(manifest.action.default_popup)
    if (manifest.action.default_icon) {
      for (const path of Object.values(manifest.action.default_icon)) {
        pushRef(path)
      }
    }
  }

  if (manifest.options_ui && typeof manifest.options_ui === "object") {
    pushRef(manifest.options_ui.page)
  }

  if (manifest.icons && typeof manifest.icons === "object") {
    for (const path of Object.values(manifest.icons)) {
      pushRef(path)
    }
  }

  return refs
}

/**
 * @param {Record<string, unknown>} manifest
 * @param {Set<string>} files
 */
export function assertManifestFilesExist(manifest, files) {
  const missing = collectManifestFileRefs(manifest).filter((ref) => !files.has(ref))

  if (missing.length > 0) {
    throw new Error(
      `manifest.json 仍引用不存在的文件：\n${missing.map((item) => `  - ${item}`).join("\n")}`
    )
  }

  const critical = []

  if (manifest.background && typeof manifest.background === "object") {
    const sw = manifest.background.service_worker
    if (!isNonEmptyString(sw) || !files.has(sw)) {
      critical.push("background.service_worker")
    }
  } else {
    critical.push("background.service_worker")
  }

  if (manifest.action && typeof manifest.action === "object") {
    const popup = manifest.action.default_popup
    if (isNonEmptyString(popup) && !files.has(popup)) {
      critical.push("action.default_popup")
    }
  }

  if (manifest.options_ui && typeof manifest.options_ui === "object") {
    const page = manifest.options_ui.page
    if (isNonEmptyString(page) && !files.has(page)) {
      critical.push("options_ui.page")
    }
  }

  if (critical.length > 0) {
    throw new Error(
      `manifest.json 缺少关键文件引用：\n${critical.map((item) => `  - ${item}`).join("\n")}`
    )
  }
}

/**
 * @param {string} buildDir
 * @returns {SanitizeResult}
 */
export function sanitizeManifest(buildDir) {
  const manifestPath = join(buildDir, "manifest.json")
  if (!existsSync(manifestPath)) {
    throw new Error(`未找到 manifest.json：${manifestPath}`)
  }

  const files = collectBuildFiles(buildDir)
  files.delete("manifest.json")

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  const result = sanitizeManifestObject(manifest, files)

  if (result.removed.length > 0) {
    writeFileSync(manifestPath, `${JSON.stringify(result.manifest, null, 2)}\n`)
  }

  assertManifestFilesExist(result.manifest, files)
  return result
}

import { fileURLToPath } from "node:url"

const isCli =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === fileURLToPath(`file://${process.argv[1]}`)

if (isCli) {
  const buildDir = process.argv[2] || "build/chrome-mv3-prod"
  try {
    const { removed } = sanitizeManifest(buildDir)
    if (removed.length === 0) {
      console.log("manifest.json 无需清理。")
    } else {
      console.log(`已清理 ${removed.length} 条 ghost 引用：`)
      for (const item of removed) console.log(`  - ${item}`)
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
