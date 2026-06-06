### **Q: 如何解决小红书搜索页「采集本页笔记」批量采集 feed 失败或缺字段的问题？**

**A:**
搜索页批量采集（`collectBy: "links"`）每条笔记需走一次 `POST /api/sns/web/v1/feed`。Network 里若已见 `code: 0` 但侧边栏仍报错、或只有标题/互动数而没有笔记内容/话题/笔记 ID，多半是 **xsec_token 用错**、**未走页面 webpack 签名客户端**，或 **feed 响应解包形状不一致**。按下面症状对照排查。

**问题症状：**

- feed 返回 `300011`（账号异常）或 `300031`（token 无效）
- feed 返回 `code: -1, success: false`（签名配套失败）
- Network 显示 feed 成功（`code: 0`），侧边栏仍出现 `Cannot read properties of undefined (reading 'items')`
- 表格有标题、点赞/收藏/评论、博主昵称，但 **笔记 ID、笔记内容、笔记话题、发布时间** 为空
- **发现页**批量：有笔记内容、话题、发布时间、博主昵称，但 **点赞/收藏/评论/分享、博主 ID/链接、封面/图片链接、IP、更新时间** 为空
- 成功 curl 的 `x-s-common` 以 `2UQA` 开头，扩展请求却是 `qIQl` 等异常前缀

**根本原因：**

1. **xsec_token 来源错误**  
   列表页 URL / 搜索 API 拦截到的 `xsec_token` 才能用于 `pc_search`；**禁止**用 `note_card.user.xsec_token`（博主 token）覆盖列表 token，否则会 `300031`。

2. **xsec_source 与场景不匹配**  
   搜索页批量应保持 `pc_search`；仅发现页 + `homefeed_notes` 种子才强制 `pc_feed`。搜索 token 配 `pc_feed` 或发现 token 配 `pc_search` 都会失败。

3. **未使用页面 webpack HTTP 客户端**  
   content/main world 自研 `fetch` + 手写 `x-s-common` 对 feed 易 `code:-1`。必须 hook 页面 axios/webpack，`enhancedRequest` 只走 `_smzsHttpRequest`（`x-s-common` 正常为 `2UQA…`）。

4. **feed 响应解包不一致**  
   页面 axios 可能返回多种形状：axios 包装 `{ status, data: { code, data: { items } } }`、业务 envelope `{ code: 0, data: { items } }`、或已解包 `{ items, current_time }`。旧逻辑只读 `response.data`，当顶层已是 `{ items }` 时会得到 `undefined`，进而读 `.items` 报错或丢 `note_card.desc` / `tag_list`。

5. **列定义与数据来源**  
   `content`、`tag_list` 等列仅 `apis: ["feed"]`；若 feed 未解析出 `note_card`，表格只剩搜索列表种子里的标题与互动数。

6. **发现页 INITIAL_STATE 种子 / flatten 丢互动（有内容无互动）**  
   打开「采集本页笔记」弹窗时会从 `__INITIAL_STATE__` bootstrap 首批笔记，其 `note_card` 常缺 `interact_info` 计数。若 `flattenNoteCard` 用 `{ ...outer, ...nested }` 时 nested 的 `interact_info: { liked:false }` 覆盖外层完整计数，或 `isFeedDetailComplete` 仅凭 `user_id`/`image_list` 判成功，会落库残缺 card 并提示 **「feed 缺少互动计数」**。批量在 **sidepanel** 跑，读不到 content 内 feed 拦截缓存。详见下文专条 Q。

**解决方案：**

按顺序排查（改动 background / main-world 后需在 `chrome://extensions` **重新加载**扩展，并**硬刷新**小红书页）：

1. **确认入口**：搜索页 → 工具栏「采集本页笔记」→ 侧边栏批量任务（`pageCollectType: "search"`，`collectBy: "links"`）。
2. **确认 token**：feed body 中 `xsec_token` 与列表 explore 链接 query 一致；不要用博主 `user.xsec_token`。
3. **确认签名路径**：DevTools Network 中扩展发起的 feed，`x-s-common` 应以 `2UQA` 开头；若为自研签名前缀，检查 webpack hook 是否就绪（`src/features/xiaohongshu/main-world/http.ts`）。
4. **确认响应解析**：使用统一解包（`src/features/xiaohongshu/api/response.ts` 的 `unwrapXhsResponsePayload` / `extractNoteCardFromFeedPayload`）；native 请求若 axios 拦截器抛错，从 `error.response.data` 恢复成功体。
5. **确认采集节奏**：`collectByLinks` 每条 feed 前 `waitInterval(1~3s)`，且 `skipFeed: true` 避免二次 feed。

**错误配置示例：**

```typescript
// ❌ 用博主 user token 覆盖列表 token
const token = noteCard.user.xsec_token

// ❌ 搜索页批量强制 pc_feed
xsec_source: "pc_feed"  // 应随 seed.api 为 pc_search

// ❌ 只读 axios 的 response.data，未处理已解包 payload
const items = response.data.items  // response.data 可能为 undefined

// ❌ feed 失败仍走自研 standardRequest 签名
// enhanced: false 或未 hook 到 _smzsHttpRequest
```

**正确配置示例：**

```typescript
// ✅ token 优先级：URL > seed.xsec_token > noteCard.xsec_token（禁止 user.xsec_token）
const { id, token, source } = resolveFeedParams(url, noteId, seed)

await fetchNoteFeed({
  source_note_id: id,
  image_formats: ["jpg", "webp", "avif"],
  extra: { need_body_topic: "1" },
  xsec_source: source,  // search: pc_search
  xsec_token: token
})

// ✅ 统一从 feed 提取 note_card
const noteCard = extractNoteCardFromFeedPayload(feed)
// items[0].note_card 含 desc、tag_list、note_id、time 等
```

**关键配置要点：**

- **一条链接一次 feed**，间隔 **1~3 秒**（对齐社媒助手 `apiWrapper`）
- **`enhanced: true`** → main world `executeHttpRequest` → 页面 `_smzsHttpRequest.post`
- **列表种子** `PageNoteSeed` 需带 `xsec_token`、`api`，由 `page-notes-cache` 从搜索 API 拦截写入
- **合并数据**时用 `mergeNoteSources(seed.noteCard, feedNote)`，并补全 `note_id: seed.noteCard.note_id || seed.id`
- **飞书/跨域**仍只走 background，勿在 content 直接 `fetch open.feishu.cn`

**数据格式示例：**

feed 成功时业务体（解包后）应能取到：

```json
{
  "items": [{
    "id": "69fb08e500000000220248f6",
    "model_type": "note",
    "note_card": {
      "note_id": "69fb08e500000000220248f6",
      "title": "儿科医生告诉你，AD补充的真相",
      "desc": "#协和儿外科李时望[话题]# #维生素ad[话题]#",
      "tag_list": [{ "type": "topic", "name": "维生素ad" }],
      "time": 1778112064000,
      "interact_info": { "liked_count": "81" }
    }
  }],
  "current_time": 1780712761998
}
```

请求体示例（搜索页）：

```json
{
  "source_note_id": "69fb08e500000000220248f6",
  "image_formats": ["jpg", "webp", "avif"],
  "extra": { "need_body_topic": "1" },
  "xsec_source": "pc_search",
  "xsec_token": "<来自列表 URL 的 token，非 user.xsec_token>"
}
```

**参考文档：**

- 仓库 `AGENTS.md` — 三层脚本、飞书路径、Plasmo 约束
- `src/features/xiaohongshu/collectors/note.ts` — `collectByLinks`、`resolveFeedParams`
- `src/features/xiaohongshu/api/response.ts` — feed 响应解包
- `src/features/xiaohongshu/main-world/http.ts` — webpack hook、`enhancedRequest`

---

### **Q: 为什么搜索页批量采集显示 20/21 并提示「笔记不存在」？**

**A:**
通常 **不是条数算错或数组超限**，而是搜索页检测到的卡片里混入了 **平台侧无效的链接**（浏览器直接打开也显示「笔记不存在」）。扩展会将其排除在可采集列表外，使进度 total 与可采集条数一致。

**问题症状：**

- 弹窗或侧边栏曾显示 **21 条**，采集完成后 **20/21**，橙色提示 **「笔记不存在」**
- 某条链接路径 ID 为 **UUID**（如 `435c96ed-d277-4c11-...`），而非 24 位 hex
- 链接形态为 `/explore/{uuid}#时间戳?xsec_token=...`（query 落在 hash 内）
- **在浏览器新标签打开该链接，小红书页面同样提示笔记不存在**

**根本原因：**

1. **无效卡片**：搜索列表渲染了已下架/过期/占位卡片，非扩展单独写坏链接。
2. **历史 ID 优先级错误**：搜索 API 的 `item.id` 有时为 UUID，真正可 feed 的是 `note_card.note_id`（24 位）；旧代码用 UUID 作 `source_note_id` 会触发「笔记不存在」。
3. **畸形 href**：`#hash?xsec_token=` 导致 `URL.searchParams` 读不到 token。
4. **进度语义**：无效条仍计入 total 时会显示 20/21。

**解决方案（已实现方向）：**

- `resolveXhsNoteId` / `isXhsNoteId`：只认 24 位 note_id 为可采集
- `page-notes-cache`：无效 UUID 卡片 **不写入** 可采集 store；弹窗检测数为 **可采集条数**
- `collectByLinks`：无效链接跳过并 warning **「第 N 条…网页亦无法打开时可忽略」**
- `parseNoteUrl`：从 hash 内 query 兜底解析 token

**关键配置要点：**

- 可采集条数可能 **少于** 搜索页可见卡片数（差值为无效链接）
- 进度 **N/N** 应对齐可采集条数，而非原始 DOM 卡片总数
- 若浏览器也无法打开，**无需反复重试**，可忽略该条

---

### **Q: 为什么发现页批量采集有标题/内容但互动数为空，并提示「feed 缺少互动计数」？**

**A:**
发现页批量（`pageCollectType: "explore"`，`collectBy: "links"`）每条笔记走一次 `POST /api/sns/web/v1/feed`。DevTools 或 curl 里 `items[0].note_card.interact_info` 已有完整点赞/收藏/评论/分享，但侧边栏表格互动列为空、并出现 **「feed 缺少互动计数」**（或修复后为 **「feed 详情缺少互动计数」**），说明 **API 正常、扩展解析/合并链路把互动弄丢了**，或误把 INITIAL_STATE 列表种子当 feed 详情落库。

**问题症状：**

- 表格有 **笔记标题、笔记内容、话题、发布时间、博主昵称**，但 **点赞/收藏/评论/分享、博主 ID/链接、图片链接、IP** 为空
- 橙色 warning：**「第 N 条: feed 缺少互动计数」**（旧版）或 **「feed 详情缺少互动计数，请检查 Network 中 v1/feed 响应」**（收紧后）
- 用相同 `source_note_id` + `xsec_token` + `xsec_source: pc_feed` 手动 curl feed，响应里 `interact_info` 完整
- sidepanel 控制台 `[qmc] fetchNoteDetail` 中 `liked_count` 为空，`items_length` 为 0 或 parse 后无计数

**根本原因：**

1. **`flattenNoteCard` 覆盖 interact**  
   列表 item 形如 `{ note_card: { interact_info: { liked:false, relation:"none" } }, ... }` 与外层合并时，spread 顺序导致 **无计数的 nested interact 覆盖** 含 `liked_count` 的字段。

2. **`isFeedDetailComplete` 过宽（历史问题）**  
   仅有 `user.user_id` 或 `image_list` 即判「完整」，`fetchNoteDetail` 仍返回 partial card，批量合并后互动列全空。

3. **sidepanel 与 content 隔离**  
   页面 Network 里 hooks 拦截到的完整 feed 写入 content 内 `feed-cache`，**sidepanel 批量任务读不到**；自发起 feed 若 parse 丢互动，无法从同 tab 拦截缓存补全。

4. **feed POST 不发 explore URL（易误解）**  
   请求体只有 `source_note_id`、`xsec_source`（发现页强制 `pc_feed`）、`xsec_token`、`image_formats`、`extra`；explore 链接仅用于解析 token 与表格「笔记链接」列，**不是缺链导致无互动**。

**解决方案（已实现方向）：**

1. **`isFeedDetailComplete`** 仅 `hasInteractCounts(note)` 为 true 才算成功（`src/features/xiaohongshu/feed/parse-feed-note.ts`）。
2. **`flattenNoteCard`** 在 spread 后用 `mergeInteractInfo` 显式合并 outer/inner 的 `interact_info`，优先保留含计数的对象（`src/features/xiaohongshu/collectors/note-enrich.ts`）。
3. **`fetchNoteDetail`**：API 解析后若仍无互动，通过 `waitForCachedFeedNoteFromPage` 读 content feed 拦截缓存，`mergeNoteSources(cached, api)` 补全；仍无互动则 **返回 error**，不落库残缺 card（`src/features/xiaohongshu/feed/fetch-note-detail.ts`）。
4. **feed-cache 桥接**：content 响应 `qmc:get-cached-feed-note`；`src/shared/messaging.ts` 提供 `waitForCachedFeedNoteFromPage`；缓存写入前对 `items[0].note_card` 做 `flattenNoteCard`（`src/features/xiaohongshu/collectors/feed-cache.ts`、`src/contents/content.ts`）。
5. **诊断**：sidepanel 始终输出 `console.warn("[qmc] fetchNoteDetail", { items_length, liked_count, cache_hit, ... })`，便于与 Network Response 对照。

**排查步骤：**

1. `chrome://extensions` **重新加载**扩展，硬刷新小红书页。
2. 发现页 →「采集本页笔记」→ 侧边栏批量 1 条复现。
3. 打开 **sidepanel** 控制台（不是页面控制台），找 `[qmc] fetchNoteDetail`：
   - `items_length: 0` → 检查 `normalizeFeedListPayload` / `unwrapXhsResponsePayload` 是否丢 `items`
   - `items_length > 0` 且 `liked_count` 空、`cache_hit: false` → 检查 flatten 与 feed-cache 桥接
   - `cache_hit: true` 且有点赞 → 正常走缓存补全
4. 对比 Network 中扩展发起的 `v1/feed` Response 与 curl 是否同为 `code: 0` 且 `note_card.interact_info` 一致。

**错误模式示例：**

```typescript
// ❌ spread 后未合并 interact，nested 无计数对象覆盖外层
const flat = { ...outer, ...nested.note_card }

// ❌ 仅凭 user_id / image_list 判 feed 成功
if (user?.user_id || image_list?.length) return true

// ❌ 无互动仍 return { noteCard } 落库
if (!hasInteractCounts(normalized)) console.warn(...)
return { noteCard: normalized }
```

**正确模式示例：**

```typescript
// ✅ flatten 后 mergeInteractInfo 保留含 liked_count 的一侧
flat.interact_info = mergeInteractInfo(outerInteract, innerInteract)

// ✅ 仅互动计数齐全才算完整
export function isFeedDetailComplete(note) {
  return hasInteractCounts(note)
}

// ✅ 缺互动时先等 page feed-cache，仍失败则 error
const cached = await waitForCachedFeedNoteFromPage(noteId, 2000)
const merged = mergeNoteSources(cached, apiParsed)
if (!hasInteractCounts(merged)) {
  return { noteCard: null, error: "feed 详情缺少互动计数，请检查 Network 中 v1/feed 响应" }
}
```

**关键配置要点：**

- 发现页批量 **`xsec_source` 固定 `pc_feed`**（`note.ts` → `resolveFeedParams`）
- **`enhanced: true`** 走页面 webpack 客户端，与 curl 签名一致
- 批量在 sidepanel 执行，**必须**经 messaging 读 content 的 feed-cache，不能 import `feed-cache.ts` 到 sidepanel
- 改动 background / main-world / content 后需重载扩展

**参考文档：**

- `src/features/xiaohongshu/feed/fetch-note-detail.ts` — 拉取、缓存补全、完整性校验
- `src/features/xiaohongshu/feed/parse-feed-note.ts` — `hasInteractCounts`、`parseFeedNoteCard`
- `src/features/xiaohongshu/collectors/note-enrich.ts` — `flattenNoteCard`、`mergeNoteSources`
- `src/shared/messaging.ts` — `waitForCachedFeedNoteFromPage`

