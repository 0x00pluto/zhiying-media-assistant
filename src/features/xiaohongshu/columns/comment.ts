import type { ColumnDef } from "~shared/columns/types"

export const COMMENT_COLUMNS: ColumnDef[] = [
  {
    name: "笔记ID",
    key: "note_id",
    category: "评论信息",
    default: true,
    apis: ["comment"],
    handle: ({ data }) => data.note_id
  },
  {
    name: "评论ID",
    key: "id",
    category: "评论信息",
    default: true,
    apis: ["comment"],
    handle: ({ data }) => data.id
  },
  {
    name: "评论内容",
    key: "content",
    category: "评论信息",
    default: true,
    apis: ["comment"],
    handle: ({ data }) => data.content
  },
  {
    name: "点赞数",
    key: "like_count",
    category: "评论信息",
    default: true,
    apis: ["comment"],
    handle: ({ data }) => data.like_count
  },
  {
    name: "评论时间",
    key: "create_time",
    category: "评论信息",
    default: true,
    apis: ["comment"],
    handle: ({ data }) => {
      const ts = data.create_time as number | undefined
      return ts ? new Date(ts).toLocaleString() : undefined
    }
  },
  {
    name: "用户昵称",
    key: "nickname",
    category: "评论信息",
    default: true,
    apis: ["comment"],
    handle: ({ data }) => {
      const user = data.user_info as Record<string, unknown> | undefined
      return user?.nickname
    }
  },
  {
    name: "用户ID",
    key: "user_id",
    category: "评论信息",
    default: false,
    apis: ["comment"],
    handle: ({ data }) => {
      const user = data.user_info as Record<string, unknown> | undefined
      return user?.user_id
    }
  },
  {
    name: "是否子评论",
    key: "is_sub",
    category: "评论信息",
    default: false,
    apis: ["comment"],
    handle: ({ data }) => (data.is_sub ? "是" : "否")
  }
]
