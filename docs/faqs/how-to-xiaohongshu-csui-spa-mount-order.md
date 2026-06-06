### **Q: 为什么小红书 CSUI 按钮第一次点击笔记不出现，刷新后才显示？**

**A:**
小红书页面是 SPA，笔记常以弹层形式打开（URL 仍停留在 `/explore` 或 `/search_result`）。若 content script 的 `matches` 过窄，或 React 未监听弹层 DOM 插入，扩展工具栏会在「第一次点击」时不渲染；整页刷新到 `/explore/{noteId}` 后脚本才注入，按钮才出现。修复需同时满足 **脚本预加载**、**Plasmo 锚点挂载**、**React 可见性 gate** 三层条件。

**问题症状：**

- 首页 feed / 搜索页点击笔记弹层，扩展按钮（如「下载图片」「采集本页笔记」）不出现
- 手动刷新当前页，或 URL 变为 `/explore/{noteId}` 后按钮才出现
- 按钮首帧样式为浏览器默认灰框，与「采集本页笔记」蓝色主题不一致
- 改动 content script 后本地 `pnpm dev` 已重编，但浏览器仍表现为旧逻辑

**根本原因：**

1. **`matches` 过窄，脚本未预加载**  
   若 CSUI 仅匹配 `/explore/*`，从 `/explore?channel_id=...` 或 `/search_result?keyword=...` 打开笔记弹层时，对应 content script **根本未注入**。

2. **弹层 DOM 异步插入，React 未订阅变化**  
   `#noteContainer` 在点击后才插入页面。若组件只在首屏调用 `resolveNoteId()` 且未监听 SPA 路由 / DOM 变化，`noteId` 长期为空，工具栏不渲染。

3. **两层加载 gate，任一层未就绪都不显示**  
   - **Gate 1（Plasmo）**：`getInlineAnchor` + `createMountPoller` 等待锚点 DOM（如 `.note-content`）稳定后插入 shadow host。  
   - **Gate 2（React）**：`useCsuiMountVisible` 或 `useNoteDetailPresence` 连续 2 帧 layout 就绪后才 `visible = true`。

4. **样式未走统一 CSUI 主题**  
   若按钮使用 Ant Design `Button` 但未完整注入 CSUI stylesheet，首帧可能呈现默认浏览器按钮样式。

**解决方案：**

需要 SPA / 弹层场景的 CSUI，按下面 checklist 对齐（与搜索页、首页 feed、笔记详情页已落地模式一致）：

1. **扩大 `matches`**（需 SPA/弹层的页面）  
   ```typescript
   matches: ["*://www.xiaohongshu.com/*", "*://www.rednote.com/*"]
   ```
   组件内再用 `isSearchResultPage(href)`、`isExploreFeedPage(href)` 等 **二次 gate**，避免误渲染。

2. **`getInlineAnchor` 用 DOM 条件 + poller**  
   ```typescript
   createMountPoller({
     isPageMatch: () => Boolean(findNoteDetailAvatarElement()),
     findAnchor: findNoteDetailAnchorElement,
     insertPosition: "beforebegin"
   })
   ```
   不要仅依赖 URL；弹层场景 URL 可能不变。

3. **弹层 / 可反复开关的场景用 `useNoteDetailPresence`**  
   订阅 `SPA_HREF_EVENT`、`popstate`、`MutationObserver(document.body)`，在 `#noteContainer` 出现/消失时重新解析 `noteId` 并重置 `visible`。

4. **静态页面用 `useCsuiMountVisible`**  
   搜索页、首页 feed 等「进入页面后结构稳定」的场景，一次性 2 帧稳定检测即可。

5. **样式与 Root 壳统一**  
   - `getStyle` → `createPlasmoCsuiStyleGetter(antdResetCss)`  
   - JSX 外层 → `<CsuiRoot>`（`ConfigProvider` + `App`）  
   - 操作按钮 → `<button className="qmc-csui-btn">` + `qmcCsuiButtonStyle`

6. **改 content script / manifest 后必须重载扩展**  
   `chrome://extensions` → 重新加载；必要时硬刷新小红书页面。

**加载次序（排查时按序对照）：**

```
1. Chrome 注入 content script（matches 命中）
      ↓
2. getInlineAnchor / createMountPoller 等待锚点 DOM，插入 shadow host
      ↓
3. Plasmo 挂载 CSUI React 组件
      ↓
4. useCsuiMountVisible / useNoteDetailPresence（2 帧稳定 + noteId）
      ↓
5. 渲染工具栏按钮
```

**错误配置示例：**

```typescript
// ❌ 仅匹配笔记详情 URL，feed/搜索弹层时脚本未加载
matches: ["*://www.xiaohongshu.com/explore/*"]

// ❌ 只在首屏 resolveNoteId，不监听弹层 DOM
const noteId = resolveNoteId()
if (!noteId) return null

// ❌ getInlineAnchor 仅看 URL，弹层 URL 不变时永不挂载
isPageMatch: () => location.pathname.startsWith("/explore/")
```

**正确配置示例：**

```typescript
// ✅ 全站预加载 + 组件内 page gate
matches: ["*://www.xiaohongshu.com/*", "*://www.rednote.com/*"]

// ✅ 弹层：DOM 出现后再挂载 + 可 reset 的 presence hook
export const getInlineAnchor = async () =>
  createMountPoller({
    isPageMatch: () => Boolean(findNoteDetailAvatarElement()),
    findAnchor: findNoteDetailAnchorElement,
    insertPosition: "beforebegin"
  })

function ExplorePageCsui() {
  const { noteId, visible } = useNoteDetailPresence()
  if (!visible || !noteId) return null
  return (
    <CsuiRoot>
      <NoteDetailToolbar noteId={noteId} />
    </CsuiRoot>
  )
}
```

**关键配置要点：**

- **matches 宽、组件 gate 窄**：脚本预加载，渲染条件仍精确到页面/ DOM
- **锚点选择器单点维护**：`src/features/xiaohongshu/ui/note-detail-anchor.ts`
- **监听层与稳定检测层分离**：`subscribeMountPresenceBump` + `runUntilStableReady`（`csui-mount-ready.ts`）
- **改 CSUI 必重载扩展**：matches / content script 变更不会热更新到已打开标签页

**关键文件索引：**

| 场景 | 文件 |
|------|------|
| 笔记详情 CSUI 入口 | `src/contents/xiaohongshu-explore.tsx` |
| 搜索页 CSUI | `src/contents/xiaohongshu-search.tsx` |
| 首页 feed CSUI | `src/contents/xiaohongshu-explore-feed.tsx` |
| 挂载 poller / presence hooks | `src/features/xiaohongshu/utils/csui-mount-ready.ts` |
| SPA 路由判断 | `src/features/xiaohongshu/utils/spa-location.ts` |
| 笔记详情 DOM 锚点 | `src/features/xiaohongshu/ui/note-detail-anchor.ts` |
| CSUI 主题与样式 | `src/features/xiaohongshu/ui/csui-theme.ts` |
| CSUI Root 壳 | `src/features/xiaohongshu/ui/csui-root.tsx` |

**参考文档：**

- 项目内 `AGENTS.md` — Plasmo CSUI 约束与三层脚本架构
- 项目内 `docs/faqs/how-to-xiaohongshu-batch-note-collect-troubleshooting.md` — 批量采集 feed 排查（与 CSUI 挂载为不同主题）
