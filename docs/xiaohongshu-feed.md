# 小红书 Feed 笔记抓取说明

笔记详情最完整的数据来自 Feed 接口，扩展内所有「单笔记采集 / 同步飞书」都依赖它。

## 接口

| 项 | 值 |
|---|---|
| 地址 | `POST https://edith.xiaohongshu.com/api/sns/web/v1/feed` |
| 代码常量 | `src/features/xiaohongshu/api/endpoints.ts` → `feed` |
| 核心返回 | `data.items[0].note_card` |

### 请求体示例

```json
{
  "source_note_id": "6a01c38100000000350206c2",
  "image_formats": ["jpg", "webp", "avif"],
  "extra": { "need_body_topic": "1" },
  "xsec_source": "pc_feed",
  "xsec_token": "从笔记链接或页面 state 获取"
}
```

`xsec_token` / `xsec_source` 缺一不可，否则接口常返回空或失败。优先从笔记 URL 的 query 解析，其次从 `note_card.user.xsec_token` 或页面 state 补全。

## 两种获取方式

扩展同时使用，**主动请求优先**（与原版社媒助手一致）。

### 1. 拦截页面请求（被动缓存）

用户打开笔记弹层时，小红书自己会调 Feed。我们在 MAIN world 钩住 `fetch` / `XHR`，把响应写入内存缓存。

```
页面发 Feed 请求
  → main-world/hooks.ts 拦截
  → CustomEvent 传到 content script
  → feed-cache.ts 缓存 note_card（按 note_id）
```

相关文件：

- `src/features/xiaohongshu/main-world/hooks.ts`
- `src/features/xiaohongshu/collectors/feed-cache.ts`
- `src/contents/content.ts`

采集时可 `waitForCachedFeedNote(noteId)` 最多等 2.5s。

### 2. 扩展主动请求（推荐、更稳）

```typescript
import { fetchNoteFeed } from "~features/xiaohongshu/api/client"

const feed = await fetchNoteFeed({
  source_note_id: noteId,
  image_formats: ["jpg", "webp", "avif"],
  extra: { need_body_topic: "1" },
  xsec_source: source,
  xsec_token: token
})

const noteCard = feed.items?.[0]?.note_card
```

请求走 `smzsRequest` → background → 页面 MAIN world 的 `_smzsHttpRequest`（带签名），**不能在 content script 里直接 `fetch` 飞书/小红书 API**。

封装入口：`src/features/xiaohongshu/collectors/single-note.ts` → `fetchNoteFromApi()`。

## 单笔记采集流程

```
collectSingleNote()
  ├─ fetchCurrNote()          # __INITIAL_STATE__.note.noteDetailMap[id].note
  ├─ waitForCachedFeedNote()  # 拦截缓存（可选）
  ├─ fetchNoteFromApi()       # 主动 Feed（成功则覆盖缓存）
  ├─ mergeNoteSources()       # 合并，video/image_list 优先 Feed
  ├─ applyDomEnrichment()     # DOM 兜底（仅补空缺）
  └─ buildNoteRecord()        # 输出各列字段
```

合并逻辑见 `src/features/xiaohongshu/collectors/note-enrich.ts`。

## note_card 里常用字段

| 字段 | 用途 |
|------|------|
| `type` | `"video"` / `"normal"` |
| `title` / `desc` | 标题、正文 |
| `interact_info` | 点赞、收藏、评论、分享 |
| `user` | 博主信息 |
| `image_list` | 图文图片；**视频封面取 `[0]`** |
| `video` | 视频元数据（见下） |
| `tag_list` | 话题 |

## 视频链接怎么取

Feed 里视频数据在 `note_card.video`，常见两种结构：

1. **完整 stream**（Feed 响应）：`video.media.stream.h265[]` / `h264[]`，读 `master_url` 或 `backup_urls[0]`
2. **仅 media_v2 字符串**（页面 state）：需 `JSON.parse(video.media_v2)` 再取 `stream`

解析入口：`src/features/xiaohongshu/media/extract.ts`

- `normalizeVideoObject()` — 统一 `media_v2` → `media.stream`
- `buildVideoUrl()` — `origin_video_key` → h265 → h264
- `resolveVideoUrl(note)` — 列字段 / 同步用这个

封面：`resolveCoverUrl(note)`，优先 `image_list[0]`，不要用头像（`/avatar/`）。

## 调试 checklist

1. DevTools → Network 搜 `feed`，确认 `code: 0` 且 `items[0].note_card.video` 有值
2. 确认笔记 URL 带 `xsec_token`
3. 复制笔记信息，看 TSV 里「笔记视频链接」是否有 `sns-video-*.xhscdn.com`
4. 若只有页面 state、没有 Feed：检查扩展是否重新加载、是否在小红书域名下

## 批量采集说明

侧边栏批量任务（`src/features/xiaohongshu/collectors/note.ts`）也会调 `fetchNoteFeed`，但**没有 DOM 兜底**。列表接口若不带完整 `video`，视频链接可能为空——详情弹层场景更可靠。
