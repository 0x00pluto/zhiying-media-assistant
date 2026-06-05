import type { ColumnDef } from "~shared/columns/types"

export const BLOGGER_COLUMNS: ColumnDef[] = [
  {
    name: "博主ID",
    key: "user_id",
    category: "博主信息",
    default: true,
    apis: ["blogger"],
    handle: ({ data }) => data.user_id
  },
  {
    name: "博主昵称",
    key: "nickname",
    category: "博主信息",
    default: true,
    apis: ["blogger"],
    handle: ({ data }) => data.nickname
  },
  {
    name: "小红书号",
    key: "red_id",
    category: "博主信息",
    default: true,
    apis: ["blogger"],
    handle: ({ data }) => data.red_id
  },
  {
    name: "粉丝数",
    key: "fans",
    category: "博主信息",
    default: true,
    apis: ["blogger"],
    handle: ({ data }) => {
      const interact = data.interact_info as Record<string, unknown> | undefined
      return interact?.fans
    }
  },
  {
    name: "获赞与收藏",
    key: "interaction",
    category: "博主信息",
    default: false,
    apis: ["blogger"],
    handle: ({ data }) => {
      const interact = data.interact_info as Record<string, unknown> | undefined
      return interact?.interaction
    }
  },
  {
    name: "简介",
    key: "desc",
    category: "博主信息",
    default: true,
    apis: ["blogger"],
    handle: ({ data }) => data.desc
  },
  {
    name: "主页链接",
    key: "url",
    category: "博主信息",
    default: true,
    feishu: { type: 15 },
    apis: ["blogger"],
    handle: ({ pageUrl }) => pageUrl
  },
  {
    name: "搜索关键词",
    key: "search_keywords",
    category: "其他",
    default: false,
    apis: ["blogger"],
    handle: ({ keyword }) => (keyword ? [keyword] : undefined)
  }
]
