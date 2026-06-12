# Edge 商店上传 manifest 校验失败

## 现象

向 Microsoft Edge Add-ons（Partner Center）上传扩展 zip 时，出现类似错误：

```text
Package Validation Errors:
Manifest file reference 'xiaohongshu-explore-feed.b2211677.css' does not exist in the zip archive.
(Note: File locations are case-sensitive)
```

Chrome Web Store 通常不会因此拒绝，Edge 校验更严格。

## 根因

Plasmo 0.90.x 已知 bug（[#1153](https://github.com/PlasmoHQ/plasmo/issues/1153)、[#1215](https://github.com/PlasmoHQ/plasmo/issues/1215)）：

- 构建 `manifest.json` 时，会在 `content_scripts[].css` 或 `web_accessible_resources[].resources` 中写入**哈希不匹配或不存在的 CSS 引用**
- 常见于 CSUI content script（如 `xiaohongshu-explore-feed.tsx`）
- 本项目 CSUI 样式由 `getStyle` 运行时注入（`data-text:antd/dist/reset.css`），**不依赖**这些 ghost CSS 文件

## 正确打包方式

**不要**直接上传 `build/chrome-mv3-prod.zip`（`pnpm package` / `plasmo package` 默认产物）。

请使用带 manifest 清理的一键打包：

```bash
pnpm package:zip
# 产物：dist/智赢媒体助手-v{version}.zip
```

流程：`pnpm build` → 清理 manifest ghost 引用 → 校验 → 打 zip。

仅重新打包（已有 build 产物）：

```bash
pnpm package:zip --skip-build
```

单独调试 manifest 清理：

```bash
node scripts/sanitize-manifest.mjs build/chrome-mv3-prod
```

## Edge 上传 checklist

1. 执行 `pnpm package:zip`，上传 `dist/` 下的 zip
2. 解压 zip，打开 `manifest.json`，确认无指向不存在文件的精确路径（glob 如 `assets/platforms/*.svg` 可保留）
3. 本地加载解压目录，抽查：
   - 小红书发现页 / 搜索页 / 博主页 CSUI 工具栏
   - 笔记详情页工具栏
   - 飞书同步弹窗样式
4. 重新上传 Edge Partner Center

## 相关文件

| 文件 | 说明 |
|------|------|
| `scripts/sanitize-manifest.mjs` | 扫描 build 目录，移除 ghost 引用 |
| `scripts/package-zip.mjs` | build + sanitize + zip |
| `src/features/xiaohongshu/ui/csui-theme.ts` | CSUI 运行时样式注入 |
