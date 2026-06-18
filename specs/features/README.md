# Feature Spec 目录

本目录存放**特性规格书（Feature Spec）**，由 Cursor 命令 `/team:po-explorer` 落盘。

与 [`specs/prds/`](../prds/) 中正式 PRD 的区别：Feature Spec 侧重**早期需求探索**与可直接导入 Issue 的开发 Backlog；PRD 侧重用户故事地图、Release 切片与工程验收衔接。

## 命名规则

```text
feat-{五位序号}-{feature-slug}.md
```

示例：`feat-00001-douyin-platform-support.md`

- **序号**：按创建顺序自动递增（`00001`、`00002`…），反映 Feature Spec 创建先后
- **feature-slug**：kebab-case 功能名，不含 `feat-` 前缀与序号

## 协作命令

| 命令 | 职责 |
|------|------|
| `/team:po-explorer <topic-or-problem>` | 模糊想法 / 业务目标探索，落盘 Feature Spec |
| `/team:product-manager <feature-slug>` | 探索收敛后撰写正式 PRD（落盘 `specs/prds/`） |
| `/team:plugin-engineer <任务>` | 按 Feature Spec Backlog 或 PRD 实现 Chrome 扩展 |
| `/team:prd-accept <prd-ref>` | 对照代码验收 PRD，回写「工程验收状态」 |

## 状态

Feature Spec frontmatter `status` 取值：`backlog` | `in_progress` | `implemented` | `accepted`
