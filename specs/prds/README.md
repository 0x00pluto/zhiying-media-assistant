# PRD 目录

本目录存放产品需求文档（PRD），由 Cursor 命令 `/team:product-manager` 落盘。

## 命名规则

```text
prd-{五位序号}-{feature-slug}.md
```

示例：`prd-00001-xiaohongshu-batch-export.md`

- **序号**：按创建顺序自动递增（`00001`、`00002`…），反映 PRD 创建先后
- **feature-slug**：kebab-case 功能名，不含 `prd-` 前缀与序号

## PRD 索引

| 序号 | slug | 路径 | 摘要 |
|------|------|------|------|
| 00001 | sidepanel-home-slim | specs/prds/prd-00001-sidepanel-home-slim.md | 侧边栏首页面板收缩 |
| 00002 | feishu-sync-table-target-display | specs/prds/prd-00002-feishu-sync-table-target-display.md | 飞书同步表格目标可识别与分入口缓存 |
| 00003 | feishu-sync-history-type-guard | specs/prds/prd-00003-feishu-sync-history-type-guard.md | 飞书同步历史管理与表类型校验 |

## 协作命令

| 命令 | 职责 |
|------|------|
| `/team:po-explorer <topic-or-problem>` | 早期需求探索，落盘 Feature Spec（见 [`specs/features/`](../features/)） |
| `/team:product-manager <feature-slug>` | 头脑风暴并撰写 PRD |
| `/team:plugin-engineer <任务>` | 按 Feature Spec Backlog、PRD 或任务实现 Chrome 扩展 |
| `/team:prd-accept <prd-ref>` | 对照代码验收，回写 PRD 文末「工程验收状态」 |

**与 Feature Spec 的分工**：`/team:po-explorer` 面向模糊想法与 Issue 级拆解；`/team:product-manager` 面向正式 PRD 与 Release 切片。探索收敛后可先落盘 Feature Spec，再交由 product-manager 对齐 PRD。

## 验收状态

PRD frontmatter `status` 取值：`backlog` | `in_progress` | `implemented` | `partial` | `accepted`

由 `/team:prd-accept` 维护，详见各 PRD 文末「工程验收状态」章。
