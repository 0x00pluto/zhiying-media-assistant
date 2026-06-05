import { parseFeishuNumber } from "~features/feishu/field-mapper"
import type { ColumnDef } from "~shared/columns/types"

const categories = {
  comment: "评论信息",
  note: "笔记信息",
  user: "用户信息",
  sub: "子评论专项"
}

function getHostname() {
  return typeof location !== "undefined"
    ? location.hostname
    : "www.xiaohongshu.com"
}

function getUserInfo(data: Record<string, unknown>) {
  return data.user_info as Record<string, unknown> | undefined
}

function parseCount(value: unknown) {
  return parseFeishuNumber(value) ?? value
}

function parseTimestamp(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined
  const num = Number(value)
  if (Number.isNaN(num)) return undefined
  return num < 1e12 ? num * 1000 : num
}

function getImageUrls(data: Record<string, unknown>) {
  const pictures = data.pictures as Array<Record<string, unknown>> | undefined
  if (!pictures?.length) return undefined
  return pictures
    .map((item) => item.url || item.url_default || item.url_pre)
    .filter(Boolean)
    .join("\n")
}

export const COMMENT_COLUMNS: ColumnDef[] = [
  {
    name: "评论ID",
    key: "id",
    category: categories.comment,
    default: true,
    apis: ["comment", "sub_comment"],
    handle: ({ data }) => data.id
  },
  {
    name: "评论内容",
    key: "content",
    category: categories.comment,
    default: true,
    apis: ["comment", "sub_comment"],
    handle: ({ data }) => data.content
  },
  {
    name: "评论图片链接",
    key: "image_urls",
    category: categories.comment,
    default: true,
    apis: ["comment", "sub_comment"],
    feishu: { type: 17, file_extension: "jpg" },
    handle: ({ data }) => getImageUrls(data)
  },
  {
    name: "点赞量",
    key: "like_count",
    category: categories.comment,
    default: true,
    apis: ["comment", "sub_comment"],
    feishu: { type: 2, property: { formatter: "1,000" } },
    handle: ({ data }) => parseCount(data.like_count)
  },
  {
    name: "评论时间",
    key: "create_time",
    category: categories.comment,
    default: true,
    apis: ["comment", "sub_comment"],
    feishu: { type: 5, property: { date_formatter: "yyyy-MM-dd HH:mm" } },
    handle: ({ data }) => parseTimestamp(data.create_time)
  },
  {
    name: "IP地址",
    key: "ip_location",
    category: categories.comment,
    default: true,
    apis: ["comment", "sub_comment"],
    handle: ({ data }) => data.ip_location
  },
  {
    name: "子评论数",
    key: "sub_comment_count",
    category: categories.comment,
    default: true,
    apis: ["comment"],
    feishu: { type: 2, property: { formatter: "1,000" } },
    handle: ({ data }) => parseCount(data.sub_comment_count)
  },
  {
    name: "笔记ID",
    key: "note_id",
    category: categories.note,
    default: true,
    apis: ["comment", "sub_comment"],
    handle: ({ data }) => data.note_id
  },
  {
    name: "笔记链接",
    key: "note_url",
    category: categories.note,
    default: true,
    apis: ["comment", "sub_comment"],
    feishu: { type: 15 },
    handle: ({ pageUrl }) => pageUrl
  },
  {
    name: "用户ID",
    key: "user.user_id",
    category: categories.user,
    default: true,
    apis: ["comment", "sub_comment"],
    handle: ({ data }) => getUserInfo(data)?.user_id
  },
  {
    name: "用户链接",
    key: "user.url",
    category: categories.user,
    default: true,
    apis: ["comment", "sub_comment"],
    feishu: { type: 15 },
    handle: ({ data }) => {
      const userId = getUserInfo(data)?.user_id
      if (!userId) return undefined
      return `https://${getHostname()}/user/profile/${userId}`
    }
  },
  {
    name: "用户名称",
    key: "user.nickname",
    category: categories.user,
    default: true,
    apis: ["comment", "sub_comment"],
    handle: ({ data }) => getUserInfo(data)?.nickname
  },
  {
    name: "一级评论ID",
    key: "root.id",
    category: categories.sub,
    default: true,
    apis: ["root_comment"],
    handle: ({ data }) => data.id
  },
  {
    name: "一级评论内容",
    key: "root.content",
    category: categories.sub,
    default: true,
    apis: ["root_comment"],
    handle: ({ data }) => data.content
  },
  {
    name: "一级评论用户ID",
    key: "root.user.user_id",
    category: categories.sub,
    apis: ["root_comment"],
    handle: ({ data }) => getUserInfo(data)?.user_id
  },
  {
    name: "一级评论用户名称",
    key: "root.user.nickname",
    category: categories.sub,
    apis: ["root_comment"],
    handle: ({ data }) => getUserInfo(data)?.nickname
  },
  {
    name: "引用的评论ID",
    key: "reply.id",
    category: categories.sub,
    default: true,
    apis: ["reply_comment"],
    handle: ({ data }) => data.id
  },
  {
    name: "引用的评论内容",
    key: "reply.content",
    category: categories.sub,
    default: true,
    apis: ["reply_comment"],
    handle: ({ data }) => data.content
  },
  {
    name: "引用的用户ID",
    key: "reply.user.user_id",
    category: categories.sub,
    apis: ["reply_comment"],
    handle: ({ data }) => data["user.user_id"]
  },
  {
    name: "引用的用户名称",
    key: "reply.user.nickname",
    category: categories.sub,
    apis: ["reply_comment"],
    handle: ({ data }) => data["user.nickname"]
  }
]
