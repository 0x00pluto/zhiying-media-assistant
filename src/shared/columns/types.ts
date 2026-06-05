export type XhsApiType =
  | "feed"
  | "user_posted"
  | "search_notes"
  | "board_notes"
  | "homefeed_notes"
  | "blogger"
  | "comment"
  | "comment_sub"

export type ColumnContext = {
  data: Record<string, unknown>
  api: XhsApiType
  pageUrl?: string
  keyword?: string
  config?: Record<string, unknown>
}

export type FeishuFieldMeta = {
  type: number
  property?: Record<string, unknown>
  file_extension?: string
}

export type ColumnDef = {
  name: string
  key: string
  category: string
  default?: boolean
  apis: XhsApiType[]
  feishu?: FeishuFieldMeta
  handle: (ctx: ColumnContext) => unknown
}
