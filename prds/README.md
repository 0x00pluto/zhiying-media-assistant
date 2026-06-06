# PRD 目录

本目录存放产品需求文档（PRD），由 Cursor 命令 `/team:product-manager` 落盘。

## 命名规则

```text
prd-{五位序号}-{feature-slug}.md
```

示例：`prd-00001-xiaohongshu-batch-export.md`

- **序号**：按创建顺序自动递增（`00001`、`00002`…），反映 PRD 创建先后
- **feature-slug**：kebab-case 功能名，不含 `prd-` 前缀与序号

## 协作命令

| 命令 | 职责 |
|------|------|
| `/team:product-manager <feature-slug>` | 头脑风暴并撰写 PRD |
| `/team:plugin-engineer <任务>` | 按 PRD 或任务实现 Chrome 扩展 |
| `/team:prd-accept <prd-ref>` | 对照代码验收，回写 PRD 文末「工程验收状态」 |

## 验收状态

PRD frontmatter `status` 取值：`backlog` | `in_progress` | `implemented` | `partial` | `accepted`

由 `/team:prd-accept` 维护，详见各 PRD 文末「工程验收状态」章。
