import type { PlasmoCSConfig, PlasmoGetInlineAnchor, PlasmoGetStyle } from "plasmo"
import { App, ConfigProvider } from "antd"

import { NoteDetailToolbar } from "~features/xiaohongshu/ui/note-detail-toolbar"
import { resolveNoteId } from "~features/xiaohongshu/collectors/single-note"

import antdResetCss from "data-text:antd/dist/reset.css"

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = `${antdResetCss}
    .qmc-note-toolbar .ant-btn-primary {
      background: #1677ff;
      border-color: #1677ff;
      box-shadow: none;
    }
  `
  return style
}

export const config: PlasmoCSConfig = {
  matches: [
    "*://www.xiaohongshu.com/explore/*",
    "*://www.rednote.com/explore/*",
    "*://www.xiaohongshu.com/discovery/item/*",
    "*://www.rednote.com/discovery/item/*"
  ]
}

export const getInlineAnchor: PlasmoGetInlineAnchor = async () => {
  const hasAvatar = document.querySelector(
    "#noteContainer div.interaction-container div.author-container .info img.avatar-item"
  )
  if (!hasAvatar) return null

  const element = document.querySelector(
    "#noteContainer div.interaction-container div.note-content"
  )
  if (!element) return null

  return {
    element,
    insertPosition: "beforebegin"
  }
}

function ExplorePageCsui() {
  const noteId = resolveNoteId()
  if (!noteId) return null

  return (
    <ConfigProvider>
      <App>
        <NoteDetailToolbar noteId={noteId} />
      </App>
    </ConfigProvider>
  )
}

export default ExplorePageCsui
