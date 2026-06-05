import type { PlasmoCSConfig, PlasmoGetInlineAnchor, PlasmoGetStyle } from "plasmo"
import { App, ConfigProvider } from "antd"

import { NoteDetailToolbar } from "~features/xiaohongshu/ui/note-detail-toolbar"
import { resolveNoteId } from "~features/xiaohongshu/collectors/single-note"

import antdResetCss from "data-text:antd/dist/reset.css"

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = `${antdResetCss}
    .qmc-note-toolbar {
      --qmc-primary: #1677ff;
      --qmc-primary-hover: #4096ff;
      --qmc-primary-active: #0958d9;
    }

    .qmc-note-toolbar .qmc-toolbar-btn.ant-btn-primary {
      height: 36px;
      padding: 0 18px;
      border-radius: 10px;
      border: none;
      background: var(--qmc-primary);
      font-weight: 500;
      letter-spacing: 0.02em;
      box-shadow: 0 2px 0 rgba(5, 45, 140, 0.15);
      transition:
        background 0.2s ease,
        box-shadow 0.2s ease,
        transform 0.15s ease;
    }

    .qmc-note-toolbar .qmc-toolbar-btn.ant-btn-primary:not(:disabled):hover {
      background: var(--qmc-primary-hover) !important;
      box-shadow: 0 4px 14px rgba(22, 119, 255, 0.38) !important;
      transform: translateY(-1px);
    }

    .qmc-note-toolbar .qmc-toolbar-btn.ant-btn-primary:not(:disabled):active {
      background: var(--qmc-primary-active) !important;
      box-shadow: 0 1px 4px rgba(9, 88, 217, 0.35) !important;
      transform: translateY(1px) scale(0.98);
    }

    .qmc-note-toolbar .qmc-toolbar-btn.ant-btn-primary:focus-visible {
      outline: 2px solid rgba(22, 119, 255, 0.45);
      outline-offset: 2px;
    }

    .qmc-note-toolbar .qmc-toolbar-btn.ant-btn-primary.ant-btn-loading {
      opacity: 0.88;
      transform: none;
      pointer-events: none;
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
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 10,
          colorPrimary: "#1677ff",
          controlHeight: 36
        }
      }}>
      <App>
        <NoteDetailToolbar noteId={noteId} />
      </App>
    </ConfigProvider>
  )
}

export default ExplorePageCsui
