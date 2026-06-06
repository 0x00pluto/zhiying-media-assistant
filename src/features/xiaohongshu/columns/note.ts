import type { ColumnDef } from "~shared/columns/types"
import { parseFeishuNumber } from "~features/feishu/field-mapper"
import { flattenNoteCard, normalizeTopicList } from "~features/xiaohongshu/collectors/note-enrich"
import {
  buildImageUrl,
  resolveCoverUrl,
  resolveVideoUrl
} from "~features/xiaohongshu/media/extract"

const categories = {
  baseinfo: "笔记信息",
  blogger: "博主信息",
  other: "其他"
}

function getHostname() {
  return typeof location !== "undefined"
    ? location.hostname
    : "www.xiaohongshu.com"
}

function parseCount(value: unknown) {
  return parseFeishuNumber(value) ?? value
}

/** feed 列读取前 flatten 嵌套 note_card，避免列表种子结构导致缺字段 */
function getFeedNoteData(data: Record<string, unknown>, api: string) {
  if (api !== "feed") return data
  return flattenNoteCard(data) || data
}

function getCoverUrl(data: Record<string, unknown>, api: string) {
  if (api === "search_notes" || api === "homefeed_notes") {
    const card = data.note_card as Record<string, unknown> | undefined
    const cover = card?.cover as Record<string, unknown> | undefined
    return cover?.url_default || cover?.url_pre
  }
  const cover = data.cover as Record<string, unknown> | undefined
  return cover?.url || cover?.url_default || cover?.url_pre
}

export const NOTE_COLUMNS: ColumnDef[] = [
  {
    name: "笔记ID",
    key: "note_id",
    category: categories.baseinfo,
    default: true,
    apis: ["feed", "user_posted", "search_notes", "board_notes", "homefeed_notes"],
    handle: ({ data, api }) => {
      if (api === "search_notes" || api === "homefeed_notes") {
        return data.id
      }
      return getFeedNoteData(data, api).note_id
    }
  },
  {
    name: "笔记链接",
    key: "url",
    category: categories.baseinfo,
    default: true,
    feishu: { type: 15 },
    apis: ["feed", "user_posted", "search_notes", "board_notes", "homefeed_notes"],
    handle: ({ data, api, pageUrl }) => {
      const host = getHostname()
      if (api === "feed") return pageUrl
      if (api === "search_notes" || api === "homefeed_notes") {
        const source = api === "homefeed_notes" ? "pc_feed" : "pc_search"
        return `https://${host}/explore/${data.id}?xsec_token=${data.xsec_token}&xsec_source=${source}`
      }
      if (data.note_id) {
        return `https://${host}/explore/${data.note_id}?xsec_token=${data.xsec_token}&xsec_source=pc_user`
      }
    }
  },
  {
    name: "笔记类型",
    key: "type",
    category: categories.baseinfo,
    default: true,
    feishu: {
      type: 3,
      property: { options: [{ name: "视频" }, { name: "图文" }] }
    },
    apis: ["feed", "user_posted", "search_notes", "board_notes", "homefeed_notes"],
    handle: ({ data, api }) => {
      if (api === "search_notes" || api === "homefeed_notes") {
        const card = data.note_card as Record<string, unknown> | undefined
        return card?.type === "video" ? "视频" : "图文"
      }
      const note = getFeedNoteData(data, api)
      return note.type === "video" ? "视频" : "图文"
    }
  },
  {
    name: "笔记标题",
    key: "title",
    category: categories.baseinfo,
    default: true,
    apis: ["feed", "user_posted", "search_notes", "board_notes", "homefeed_notes"],
    handle: ({ data, api }) => {
      if (api === "search_notes" || api === "homefeed_notes") {
        const card = data.note_card as Record<string, unknown> | undefined
        return card?.display_title
      }
      if (api === "user_posted" || api === "board_notes") {
        return data.display_title
      }
      const note = getFeedNoteData(data, api)
      return note.title || note.display_title
    }
  },
  {
    name: "笔记内容",
    key: "content",
    category: categories.baseinfo,
    default: true,
    apis: ["feed"],
    handle: ({ data, config, api }) => {
      const note = getFeedNoteData(data, api)
      let content = note.desc as string | undefined
      if (!content) return content
      const removeTags = (config as { note?: { removeContentTags?: boolean } })?.note
        ?.removeContentTags
      if (removeTags) {
        const tags = (note.tag_list as Array<{ type: string; name: string }> | undefined)
          ?.filter((t) => t.type === "topic")
          .map((t) => t.name)
        for (const tag of tags || []) {
          content = content.replace(`#${tag}[话题]#`, "")
        }
        return content.trim()
      }
      return content
    }
  },
  {
    name: "笔记话题",
    key: "tag_list",
    category: categories.baseinfo,
    default: true,
    feishu: { type: 4 },
    apis: ["feed"],
    handle: ({ data, api }) => {
      const note = getFeedNoteData(data, api)
      const hashTag = note.hash_tag as Array<{ name?: string }> | undefined
      if (hashTag?.length) {
        const names = hashTag.map((tag) => tag.name).filter(Boolean) as string[]
        if (names.length) return names
      }

      return normalizeTopicList(note.tag_list, note.desc as string | undefined)
    }
  },
  {
    name: "点赞量",
    key: "liked_count",
    category: categories.baseinfo,
    default: true,
    feishu: { type: 2, property: { formatter: "0" } },
    apis: ["feed", "user_posted", "search_notes", "board_notes", "homefeed_notes"],
    handle: ({ data, api }) => {
      if (api === "search_notes" || api === "homefeed_notes") {
        const card = data.note_card as Record<string, unknown> | undefined
        const interact = card?.interact_info as Record<string, unknown> | undefined
        return interact?.liked_count
      }
      const note = getFeedNoteData(data, api)
      const interact = note.interact_info as Record<string, unknown> | undefined
      return parseCount(
        interact?.liked_count ??
          interact?.like_count ??
          note.liked_count ??
          note.like_count
      )
    }
  },
  {
    name: "收藏量",
    key: "collected_count",
    category: categories.baseinfo,
    default: true,
    feishu: { type: 2, property: { formatter: "0" } },
    apis: ["feed", "user_posted", "search_notes", "board_notes", "homefeed_notes"],
    handle: ({ data, api }) => {
      if (api === "search_notes" || api === "homefeed_notes") {
        const card = data.note_card as Record<string, unknown> | undefined
        const interact = card?.interact_info as Record<string, unknown> | undefined
        return interact?.collected_count
      }
      const note = getFeedNoteData(data, api)
      const interact = note.interact_info as Record<string, unknown> | undefined
      return parseCount(interact?.collected_count ?? note.collected_count)
    }
  },
  {
    name: "评论量",
    key: "comment_count",
    category: categories.baseinfo,
    default: true,
    feishu: { type: 2, property: { formatter: "0" } },
    apis: ["feed", "user_posted", "search_notes", "board_notes", "homefeed_notes"],
    handle: ({ data, api }) => {
      if (api === "search_notes" || api === "homefeed_notes") {
        const card = data.note_card as Record<string, unknown> | undefined
        const interact = card?.interact_info as Record<string, unknown> | undefined
        return interact?.comment_count
      }
      const note = getFeedNoteData(data, api)
      const interact = note.interact_info as Record<string, unknown> | undefined
      return parseCount(interact?.comment_count ?? note.comment_count)
    }
  },
  {
    name: "分享量",
    key: "share_count",
    category: categories.baseinfo,
    default: true,
    feishu: { type: 2, property: { formatter: "0" } },
    apis: ["feed", "user_posted", "search_notes", "board_notes", "homefeed_notes"],
    handle: ({ data, api }) => {
      if (api === "search_notes" || api === "homefeed_notes") {
        const card = data.note_card as Record<string, unknown> | undefined
        const interact = card?.interact_info as Record<string, unknown> | undefined
        return parseCount(interact?.shared_count)
      }
      const note = getFeedNoteData(data, api)
      const interact = note.interact_info as Record<string, unknown> | undefined
      const statistics = note.statistics as Record<string, unknown> | undefined
      return parseCount(
        interact?.share_count ??
          interact?.shared_count ??
          statistics?.share_count ??
          statistics?.shared_count ??
          note.share_count ??
          note.shared_count
      )
    }
  },
  {
    name: "发布时间",
    key: "create_time",
    category: categories.baseinfo,
    default: true,
    feishu: { type: 5, property: { date_formatter: "yyyy-MM-dd HH:mm" } },
    apis: ["feed"],
    handle: ({ data, api }) => getFeedNoteData(data, api).time
  },
  {
    name: "更新时间",
    key: "update_time",
    category: categories.baseinfo,
    default: true,
    feishu: { type: 5, property: { date_formatter: "yyyy-MM-dd HH:mm" } },
    apis: ["feed"],
    handle: ({ data, api }) => getFeedNoteData(data, api).last_update_time
  },
  {
    name: "IP地址",
    key: "ip_location",
    category: categories.baseinfo,
    default: true,
    apis: ["feed"],
    handle: ({ data, api }) => getFeedNoteData(data, api).ip_location
  },
  {
    name: "博主昵称",
    key: "nickname",
    category: categories.blogger,
    default: true,
    apis: ["feed", "user_posted", "search_notes", "board_notes", "homefeed_notes", "blogger"],
    handle: ({ data, api }) => {
      if (api === "blogger") return data.nickname
      if (api === "search_notes" || api === "homefeed_notes") {
        const card = data.note_card as Record<string, unknown> | undefined
        const user = card?.user as Record<string, unknown> | undefined
        return user?.nickname
      }
      const note = getFeedNoteData(data, api)
      const user = note.user as Record<string, unknown> | undefined
      return user?.nickname || user?.nick_name
    }
  },
  {
    name: "博主ID",
    key: "user_id",
    category: categories.blogger,
    default: true,
    apis: ["feed", "user_posted", "search_notes", "board_notes", "homefeed_notes", "blogger"],
    handle: ({ data, api }) => {
      if (api === "blogger") return data.user_id
      if (api === "search_notes" || api === "homefeed_notes") {
        const card = data.note_card as Record<string, unknown> | undefined
        const user = card?.user as Record<string, unknown> | undefined
        return user?.user_id
      }
      const note = getFeedNoteData(data, api)
      const user = note.user as Record<string, unknown> | undefined
      return user?.user_id
    }
  },
  {
    name: "博主链接",
    key: "blogger_url",
    category: categories.blogger,
    default: true,
    feishu: { type: 15 },
    apis: ["feed", "user_posted", "search_notes", "board_notes", "homefeed_notes"],
    handle: ({ data, api }) => {
      const host = getHostname()
      if (api === "search_notes" || api === "homefeed_notes") {
        const card = data.note_card as Record<string, unknown> | undefined
        const user = card?.user as Record<string, unknown> | undefined
        if (!user?.user_id) return undefined
        const source = api === "homefeed_notes" ? "pc_feed" : "pc_search"
        return `https://${host}/user/profile/${user.user_id}?xsec_token=${user.xsec_token}&xsec_source=${source}`
      }
      const note = getFeedNoteData(data, api)
      const user = note.user as Record<string, unknown> | undefined
      if (!user?.user_id) return undefined
      const token = user.xsec_token ? `?xsec_token=${user.xsec_token}&xsec_source=pc_note` : ""
      return `https://${host}/user/profile/${user.user_id}${token}`
    }
  },
  {
    name: "图片数量",
    key: "image_count",
    category: categories.other,
    default: true,
    feishu: { type: 2, property: { formatter: "0" } },
    apis: ["feed", "search_notes"],
    handle: ({ data, api }) => {
      if (api === "search_notes") {
        const card = data.note_card as Record<string, unknown> | undefined
        if (card?.type !== "normal") return undefined
        const list = card.image_list as unknown[] | undefined
        return list?.length
      }
      const note = getFeedNoteData(data, api)
      const type = note.type === "video" ? "video" : note.type === "normal" ? "normal" : note.type
      if (type === "video") return undefined
      const list = note.image_list as unknown[] | undefined
      return list?.length || undefined
    }
  },
  {
    name: "笔记封面链接",
    key: "note_cover",
    category: categories.other,
    default: true,
    feishu: { type: 17, file_extension: "jpg" },
    apis: ["feed", "search_notes", "user_posted", "board_notes", "homefeed_notes"],
    handle: ({ data, api }) => {
      if (api === "feed") {
        return resolveCoverUrl(getFeedNoteData(data, api))
      }
      const url = getCoverUrl(data, api)
      if (url) {
        const built = buildImageUrl({ url }, "jpg")
        return built || url
      }
    }
  },
  {
    name: "笔记图片链接",
    key: "image_urls",
    category: categories.other,
    default: true,
    feishu: { type: 17, file_extension: "jpg" },
    apis: ["feed", "search_notes"],
    handle: ({ data, api }) => {
      if (api === "search_notes") {
        const card = data.note_card as Record<string, unknown> | undefined
        if (card?.type === "video") return undefined
        const list = card?.image_list as Array<Record<string, unknown>> | undefined
        return list
          ?.map((item) => {
            const info = item.info_list as Array<Record<string, unknown>> | undefined
            return info?.[0]?.url as string | undefined
          })
          .filter(Boolean)
          .join("\n")
      }
      const note = getFeedNoteData(data, api)
      if (note.type === "video") return undefined
      const list = note.image_list as Array<Record<string, unknown>> | undefined
      const urls = list
        ?.map((item) => buildImageUrl(item, "jpg"))
        .filter(Boolean) as string[] | undefined
      return urls?.length ? urls.join("\n") : undefined
    }
  },
  {
    name: "笔记视频时长",
    key: "video_duration",
    category: categories.other,
    default: false,
    apis: ["feed"],
    handle: ({ data, api }) => {
      const note = getFeedNoteData(data, api)
      const video = note.video as Record<string, unknown> | undefined
      const capa = video?.capa as Record<string, unknown> | undefined
      return capa?.duration
    }
  },
  {
    name: "笔记视频链接",
    key: "video_url",
    category: categories.other,
    default: true,
    feishu: { type: 15 },
    apis: ["feed"],
    handle: ({ data, api }) => resolveVideoUrl(getFeedNoteData(data, api))
  },
  {
    name: "搜索关键词",
    key: "search_keywords",
    category: categories.other,
    default: false,
    apis: ["search_notes"],
    handle: ({ keyword }) => (keyword ? [keyword] : undefined)
  }
]
