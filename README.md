# 智赢媒体助手

Chrome 扩展（Manifest V3），面向社媒内容运营与媒介采集场景。当前以 **小红书** 为主，支持笔记 / 博主 / 评论采集、批量任务、导出，以及飞书多维表格一键同步。

> 由 [社媒助手 v3.3.0](demo/社媒助手-v3.3.0/) 迁移重构，技术栈升级为 Plasmo + React + Ant Design。

**当前版本**：v0.3.0 · 详见 [CHANGELOG](CHANGELOG.md) / [UPGRADE-v0.3.0](UPGRADE-v0.3.0.md)

## 功能概览

| 能力 | 说明 |
|------|------|
| 笔记采集 | 笔记详情页工具栏：采集、复制、下载素材、同步飞书 |
| 批量笔记 | 侧边栏批量采集笔记，支持合并 / 追加同步至飞书 |
| 批量评论 | 按笔记链接批量采集评论 |
| 批量博主 | 按主页链接采集博主信息 |
| 飞书同步 | 多维表格合并 / 追加、字段映射、图片附件上传 |
| 导出 | Excel 等格式导出（侧边栏批量任务） |

### 飞书同步亮点（v0.3.0）

- 四入口独立缓存（笔记详情 / 批量笔记 / 批量评论 / 批量博主），表格链接副标题显示「文档名 · 数据表名」
- 历史链接可逐条删除，避免无效目标占满下拉
- 同步前校验笔记表与评论表互斥，防止误写错表
- 支持 `/base/` 直链与 `/wiki/` 知识库链接（含分享链接自动识别数据表）

## 环境要求

- **Node.js** ≥ 18
- **pnpm**（推荐）
- **Chrome** ≥ 116

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式（产物：build/chrome-mv3-dev）
pnpm dev

# 生产构建（产物：build/chrome-mv3-prod）
pnpm build

# 运行测试
pnpm test
```

### 加载扩展

1. 打开 `chrome://extensions`，开启「开发者模式」
2. 点击「加载已解压的扩展程序」
3. 选择 `build/chrome-mv3-dev`（开发）或 `build/chrome-mv3-prod`（生产）
4. 修改 **background 消息** 或 **manifest 权限** 后，需点击「重新加载」

### 离线打包

```bash
pnpm package:zip
# 产物：dist/智赢媒体助手-v0.3.0.zip
```

## 首次配置

1. 右键扩展图标 → **选项**，或打开扩展选项页
2. 填写飞书应用的 **App ID** 与 **App Secret**（需开通多维表格读写权限）
3. 按需调整批处理上限、素材上传大小等参数
4. 在小红书页面使用侧边栏或页面内工具栏开始采集

飞书表格链接须为完整 URL，例如：

```text
https://xxx.feishu.cn/base/APP_TOKEN?table=TABLE_ID
```

更多说明见 [飞书同步 FAQ](docs/faqs/how-to-feishu-sync-table-target-display.md)。

## 技术栈

| 项 | 选型 |
|---|---|
| 框架 | [Plasmo](https://docs.plasmo.com/) 0.90.x |
| UI | React 18 + Ant Design 6 |
| 语言 | TypeScript 5.3 |
| 测试 | Vitest |
| 包管理 | pnpm |

## 目录结构

```text
src/
├── background/      # Service Worker：跨域 fetch、飞书 API、下载
├── contents/        # Content Scripts（ISOLATED + MAIN world）
├── features/        # 业务能力：xiaohongshu、feishu、media
├── sidepanel/       # 侧边栏 SPA
├── shared/          # 共享工具与类型
├── options.tsx      # 选项页
└── assets/

docs/                # 文档与 FAQ
prds/                # 产品需求文档
build/               # 构建产物（加载此目录调试）
```

路径别名：`~*` → `src/*`

## 文档

- [CHANGELOG.md](CHANGELOG.md) — 版本变更记录
- [UPGRADE-v0.3.0.md](UPGRADE-v0.3.0.md) — v0.3.0 升级指南
- [文档索引](docs/doc_index.md)
- [AGENTS.md](AGENTS.md) — 供 AI Agent / 贡献者阅读的工程约定
- [小红书 Feed 采集说明](docs/xiaohongshu-feed.md)

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发构建，热更新 |
| `pnpm build` | 生产构建 |
| `pnpm package` | 打包 `.crx` |
| `pnpm package:zip` | 构建 + 离线 zip |
| `pnpm test` | 运行单元测试 |
| `pnpm test:watch` | 监听模式测试 |

## 许可证

暂未声明开源许可证。使用前请遵循目标平台服务条款与数据合规要求。
