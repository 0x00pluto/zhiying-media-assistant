/** 评论 API 请求间隔（秒）；子评论模式略快但仍留展开节奏 */
export const COMMENT_COLLECT_INTERVAL = {
  default: { min: 1, max: 3 },
  withSub: { min: 1, max: 2 },
  subRootExtra: { min: 0, max: 1 }
} as const

/** 与浏览器 comment/page query 一致 */
export const COMMENT_FETCH_PARAMS = {
  image_formats: "jpg,webp,avif"
} as const

export function formatCommentRequestError(error: unknown) {
  const message = (error as Error).message || String(error)
  if (
    message.includes("300017") ||
    message.includes("访问链接异常") ||
    message.includes("安全限制")
  ) {
    return "评论接口触发小红书安全限制，请刷新笔记页后稍等片刻再重试"
  }
  if (message.includes("reading 'status'")) {
    return "评论接口请求失败（页面 HTTP 客户端异常），请刷新小红书页面后重试"
  }
  if (
    message.includes("未返回") ||
    message.includes("未响应") ||
    message.includes("连接中断") ||
    message.includes("限流")
  ) {
    return "评论接口无响应（可能被小红书限流），请稍后刷新页面再试"
  }
  return message
}

/** 限流/空响应/安全限制不可重试，避免同一 cursor 连打放大请求 */
export function isRetryableCommentError(error: unknown) {
  const message = formatCommentRequestError(error)
  if (
    message.includes("限流") ||
    message.includes("未响应") ||
    message.includes("未返回") ||
    message.includes("连接中断") ||
    message.includes("HTTP 客户端异常") ||
    message.includes("安全限制") ||
    message.includes("300017") ||
    message.includes("HTTP 5") ||
    message.includes("页面 HTTP") ||
    message.includes("页面未返回")
  ) {
    return false
  }
  return (
    message.includes("timeout") ||
    message.includes("Timeout") ||
    message.includes("ETIMEDOUT") ||
    message.includes("ECONNRESET")
  )
}

export type CommentListParseResult = {
  comments: Array<Record<string, unknown>>
  hasMore: boolean
  cursor: string
  /** 响应可能携带；采集侧固定用笔记 URL token，勿用此字段覆盖 */
  xsecToken?: string
  isEmpty: boolean
  isInvalid: boolean
}

export function parseCommentList(result: unknown): CommentListParseResult {
  const fallback: CommentListParseResult = {
    comments: [],
    hasMore: false,
    cursor: "",
    isEmpty: true,
    isInvalid: true
  }

  if (result == null || typeof result !== "object") {
    return fallback
  }

  const obj = result as Record<string, unknown>
  const rawComments = obj.comments

  if (!Array.isArray(rawComments)) {
    return fallback
  }

  const hasMoreRaw = obj.has_more ?? obj.hasMore

  return {
    comments: rawComments as Array<Record<string, unknown>>,
    hasMore: hasMoreRaw === true,
    cursor: String(obj.cursor ?? ""),
    xsecToken:
      typeof obj.xsec_token === "string"
        ? obj.xsec_token
        : typeof obj.xsecToken === "string"
          ? obj.xsecToken
          : undefined,
    isEmpty: rawComments.length === 0,
    isInvalid: false
  }
}

/** 无效页或空页但 has_more：风控/限流信号，应熔断不再翻页 */
export function shouldDegradeCommentPage(parsed: CommentListParseResult) {
  return parsed.isInvalid || (parsed.isEmpty && parsed.hasMore)
}

export function getEmbeddedSubComments(rootComment: Record<string, unknown>) {
  const raw = rootComment.sub_comments ?? rootComment.subComments
  return (Array.isArray(raw) ? raw : []) as Array<Record<string, unknown>>
}

export function needsSubCommentFetch(rootComment: Record<string, unknown>) {
  const embedded = getEmbeddedSubComments(rootComment)
  const embeddedCount = embedded.length
  const totalSubCount = Number(
    rootComment.sub_comment_count ?? rootComment.subCommentCount ?? 0
  )
  return (
    Boolean(
      rootComment.sub_comment_has_more ?? rootComment.subCommentHasMore
    ) || totalSubCount > embeddedCount
  )
}

function pickPictureUrlFromInfoList(infoList: unknown) {
  if (!Array.isArray(infoList) || infoList.length === 0) return undefined

  const items = infoList as Array<Record<string, unknown>>
  const preferred = items.find(
    (item) =>
      item.image_scene === "WB_DFT" || item.imageScene === "WB_DFT"
  )
  const target = preferred ?? items[0]
  const url = target.url
  return typeof url === "string" && url ? url : undefined
}

function pickPictureUrl(picture: Record<string, unknown>) {
  const direct =
    picture.url_default ??
    picture.urlDefault ??
    picture.url_pre ??
    picture.urlPre ??
    picture.url

  if (typeof direct === "string" && direct) return direct

  return (
    pickPictureUrlFromInfoList(picture.info_list) ??
    pickPictureUrlFromInfoList(picture.infoList)
  )
}

function normalizeCommentPictures(data: Record<string, unknown>) {
  const raw = data.pictures ?? data.picture
  if (Array.isArray(raw)) {
    return raw as Array<Record<string, unknown>>
  }
  if (raw != null && typeof raw === "object") {
    return [raw as Record<string, unknown>]
  }
  return []
}

/** 从 comment/sub_comment 原始 data 提取图片 CDN 链接（多图换行） */
export function getCommentPictureUrls(data: Record<string, unknown>) {
  const urls = normalizeCommentPictures(data)
    .map((item) => pickPictureUrl(item))
    .filter((url): url is string => Boolean(url))

  if (!urls.length) return undefined
  return urls.join("\n")
}

export type CommentUserInfo = {
  user_id?: unknown
  nickname?: unknown
}

/** 统一读取评论 user_info（兼容 camelCase 与 nick_name 变体） */
export function getCommentUserInfo(
  data: Record<string, unknown>
): CommentUserInfo | undefined {
  const raw = (data.user_info ?? data.userInfo) as
    | Record<string, unknown>
    | undefined
  if (!raw || typeof raw !== "object") return undefined

  const userId = raw.user_id ?? raw.userId
  const nickname = raw.nickname ?? raw.nick_name ?? raw.nickName

  if (userId === undefined && nickname === undefined) return undefined

  return { user_id: userId, nickname }
}

/** 读取评论点赞数（兼容 likeCount / likedCount 变体） */
export function getCommentLikeCount(data: Record<string, unknown>) {
  return data.like_count ?? data.liked_count
}

/** 读取评论 IP 属地（优先 ip_location，兜底 reply_control.location） */
export function getCommentIpLocation(data: Record<string, unknown>) {
  const direct = data.ip_location ?? data.ipLocation
  if (typeof direct === "string" && direct) return direct

  const replyControl = (data.reply_control ?? data.replyControl) as
    | Record<string, unknown>
    | undefined
  const location = replyControl?.location
  if (typeof location !== "string" || !location) return undefined

  return location.replace(/^IP属地：/, "")
}
