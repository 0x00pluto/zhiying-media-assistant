# AGENTS.md — 全媒采集助手（quanmediacrawl）

供 AI Agent 快速理解本仓库并安全改动代码。阅读本文后再动手。

## 项目是什么

Chrome 扩展（Manifest V3），产品名 **全媒采集助手**。从 `dome/社媒助手-v3.3.0` 迁移重构，当前以 **小红书** 为主，支持笔记/博主/评论采集、批量任务、导出、飞书多维表格同步。

**明确不做**（勿自行加回）：

- RPA / 自动化点击流程
- `socialext` 相关 VIP 门控、数据上报
- 自定义 `content_security_policy`（会阻断 background 访问 `open.feishu.cn`，导致 CORS）

## 技术栈

| 项 | 选型 |
|---|---|
| 框架 | [Plasmo](https://docs.plasmo.com/) 0.90.x |
| UI | React 18 + Ant Design 6 |
| 语言 | TypeScript 5.3 |
| 路由 | Sidepanel 内手写 router（非 react-router 页面级） |
| 存储 | `@plasmohq/storage` |
| 消息 | `@plasmohq/messaging` + 少量原生 `chrome.runtime.sendMessage` |
| 包管理 | pnpm（**Agent 不要执行 install/add/remove**，只输出命令给用户） |

## 常用命令

```bash
pnpm dev      # 开发，产物在 build/chrome-mv3-dev
pnpm build    # 生产构建，产物在 build/chrome-mv3-prod
pnpm package  # 打包 crx
```

改动 **background 消息** 或 **manifest 权限** 后，用户需在 `chrome://extensions` **重新加载**扩展。

## 目录结构

```
src/
├── background/           # Service Worker
│   ├── index.ts            # SW 入口；飞书 fetch 监听 qmc:fetch-json
│   ├── feishu-fetch.ts     # 仅 background 内 fetch，勿在 content 直接调 open.feishu.cn
│   ├── messages/           # Plasmo 消息处理器（自动注册到 .plasmo/static/background/messaging.ts）
│   └── helpers/            # main-world 请求、读 window 变量等
├── contents/               # Content Scripts
│   ├── content.ts          # ISOLATED world，全平台基础脚本
│   ├── main.ts             # MAIN world，小红书 API 拦截/签名
│   ├── xiaohongshu-explore.tsx   # CSUI：笔记详情页工具栏
│   ├── xiaohongshu-search.tsx
│   └── xiaohongshu-profile.tsx
├── features/               # 按业务能力划分
│   ├── feishu/             # 飞书同步、字段映射、Bitable API
│   ├── xiaohongshu/        # 采集、列定义、任务、main-world
│   └── media/              # 素材上传到飞书
├── shared/                 # 跨模块工具
│   ├── messaging.ts        # 前台统一消息封装（含 fetchForJson）
│   └── columns/types.ts    # ColumnDef 类型
├── sidepanel/              # 侧边栏 SPA
├── tabs/                   # 扩展内页（如下载中继）
├── options.tsx             # 选项页（飞书密钥、批处理、字段配置）
├── sidepanel.tsx
└── assets/

dome/社媒助手-v3.3.0/       # 原版参考实现（只读对照，勿直接复制混淆代码）
.plasmo/                    # Plasmo 生成物，勿手改 messaging 注册逻辑
build/                      # 构建产物，调试时加载此目录
locales/zh_CN/messages.json # 扩展名称与描述 i18n
```

路径别名：`~*` → `src/*`（见 `tsconfig.json`）。

## 架构要点

### 1. 三层脚本

```
┌─────────────────────────────────────────────────────────┐
│  MAIN world (contents/main.ts)                          │
│  拦截小红书 XHR/fetch，提供带签名的 API 能力              │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  ISOLATED world (contents/content.ts + CSUI)             │
│  UI、采集逻辑；通过 messaging 调 background               │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Service Worker (background/)                            │
│  跨域 fetch、下载、飞书 API、素材上传                       │
└─────────────────────────────────────────────────────────┘
```

- **Content script 不能直接 `fetch` 飞书 API**（会 CORS）。
- 飞书请求路径：`client.ts` → `fetchForJson()` → `chrome.runtime.sendMessage({ type: "qmc:fetch-json" })` → `background/feishu-fetch.ts`。
- 其他后台能力走 `@plasmohq/messaging`：`sendToBackground({ name: "xxx", body })`，处理器在 `src/background/messages/*.ts`。

### 2. 列定义（ColumnDef）

采集与飞书字段共用一套定义：

- `src/features/xiaohongshu/columns/note.ts` — 笔记
- `src/features/xiaohongshu/columns/blogger.ts` — 博主
- `src/features/xiaohongshu/columns/comment.ts` — 评论

每列含 `key`、`name`、`category`、`apis`、`feishu.type`、`handle()`。新增飞书列时同步更新 `ensure-fields.ts` 与 `sync-prefs.ts` 的 `mergeFieldOptions`。

### 3. 飞书同步流程

```
FeishuSyncModal / 快捷同步
  → resolveBitableRef(url)     # 解析 /base/ 或 /wiki/ 链接
  → syncRecordsToFeishu()      # merge | append
      → ensureSyncFields()     # 检查/创建表字段
      → getTenantAccessToken() # 经 background fetch
      → 可选 feishuUploadMedia() # 图片附件；视频列只存链接
```

表格链接必须是完整 URL，例如：

`https://xxx.feishu.cn/base/APP_TOKEN?table=TABLE_ID`

仅域名无效。App ID / Secret 在选项页配置。

### 4. Plasmo 约束（易踩坑）

- **Content script 的 `matches` 必须写字面量数组**，不能从变量 spread，否则 manifest 不生成。
- 新增 `src/background/messages/<name>.ts` 后需 dev/build，Plasmo 才会写入 `.plasmo/static/background/messaging.ts`。
- CSUI（如 `xiaohongshu-explore.tsx`）用 Shadow DOM 注入页面；Modal 通过 `modal-utils.ts` 提高 `z-index`。
- **不要**在 `package.json` → `manifest` 里加 `content_security_policy`，除非完全确认 `connect-src` 不会限制 background。

## 代码规范

- **KISS**：最小改动、单一职责；不要过度抽象。
- **沿用现有风格**：命名、`~features/...` 导入、中文 UI 文案、Ant Design 组件用法。
- **注释**：只解释非显而易见的业务/技术原因。
- **Git**：除非用户明确要求，否则不要 `commit` / `push`。
- **依赖**：需要新包时只给出 `pnpm add ...` 命令，不要改 lockfile。
- **对话语言**：与用户沟通用中文。

## 关键文件索引

| 场景 | 文件 |
|------|------|
| 笔记详情工具栏 / 快捷飞书同步 | `src/features/xiaohongshu/ui/note-detail-toolbar.tsx` |
| 飞书同步弹窗 | `src/features/feishu/sync-modal.tsx` |
| 同步核心逻辑 | `src/features/feishu/sync-records.ts` |
| 飞书 API 客户端 | `src/features/feishu/client.ts` |
| 字段检查与创建 | `src/features/feishu/ensure-fields.ts` |
| 笔记数据增强 | `src/features/xiaohongshu/collectors/note-enrich.ts` |
| 单条笔记采集 | `src/features/xiaohongshu/collectors/single-note.ts` |
| 前台消息封装 | `src/shared/messaging.ts` |
| 批量任务页 | `src/sidepanel/pages/xiaohongshu/batch-*.tsx` |
| 选项页 | `src/options.tsx` |
| Manifest 覆盖 | `package.json` → `manifest` |

## 调试清单

飞书同步失败时按序排查：

1. 扩展是否已重新加载（尤其改过 background / 权限）
2. 网站访问权限是否为「在所有网站上」
3. 选项页是否配置 App ID / Secret
4. 表格链接是否含 `/base/` 或 `/wiki/` 及 `table=` 参数
5. 打开 `chrome://extensions` → Service Worker → Inspect，看 background 控制台报错
6. 页面控制台若见 `chrome-extension://` + CORS，多半是请求没走 background 或 CSP 被错误配置

## 对照原版

行为或 UI 对齐时，查阅 `dome/社媒助手-v3.3.0/`：

- `content-scripts/content.js` — 内容脚本与飞书弹窗
- `background.js` — `fetchForJson` 等后台消息
- `chunks/feishu-sync-config-*.js` — 飞书同步配置 UI

原版为 WXT 构建；本仓库为 Plasmo，架构相似但消息注册方式不同。

## Agent 改动检查表

提交前自检：

- [ ] 飞书/跨域请求是否只经 `fetchForJson` / `feishuUploadMedia` / background？
- [ ] 新增 content script 是否使用字面量 `matches`？
- [ ] 新增 background 消息是否放在 `src/background/messages/` 并已说明需重载扩展？
- [ ] 是否误加 CSP、VIP、上报、RPA？
- [ ] UI 文案是否为中文？
- [ ] 改动范围是否仅限任务相关文件？
