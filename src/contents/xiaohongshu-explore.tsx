import type { PlasmoCSConfig, PlasmoGetInlineAnchor } from "plasmo"
import { useCallback } from "react"

import { NoteDetailToolbar } from "~features/xiaohongshu/ui/note-detail-toolbar"
import { CsuiRoot } from "~features/xiaohongshu/ui/csui-root"
import { createPlasmoCsuiStyleGetter } from "~features/xiaohongshu/ui/csui-theme"
import {
  createMountPoller,
  findNoteDetailAnchorElement,
  findNoteDetailAvatarElement,
  useNoteDetailPresence
} from "~features/xiaohongshu/utils/csui-mount-ready"

import antdResetCss from "data-text:antd/dist/reset.css"

export const getStyle = createPlasmoCsuiStyleGetter(antdResetCss)

export const config: PlasmoCSConfig = {
  matches: ["*://www.xiaohongshu.com/*", "*://www.rednote.com/*"],
  run_at: "document_idle"
}

export const getInlineAnchor: PlasmoGetInlineAnchor = async () =>
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

export default ExplorePageCsui
