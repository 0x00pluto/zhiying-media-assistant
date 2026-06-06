import type { PlasmoCSConfig, PlasmoGetInlineAnchor } from "plasmo"
import { useCallback } from "react"

import { useNoteBatchCollectEnabled } from "~features/xiaohongshu/use-note-batch-enabled"
import { CsuiCollectButton } from "~features/xiaohongshu/ui/csui-button"
import { PageCollectToolbar } from "~features/xiaohongshu/ui/page-collect-toolbar"
import { CsuiRoot } from "~features/xiaohongshu/ui/csui-root"
import { createPlasmoCsuiStyleGetter } from "~features/xiaohongshu/ui/csui-theme"
import {
  createMountPoller,
  findProfileAnchorElement,
  isProfileMountReady,
  useCsuiMountVisible
} from "~features/xiaohongshu/utils/csui-mount-ready"

import antdResetCss from "data-text:antd/dist/reset.css"

export const config: PlasmoCSConfig = {
  matches: [
    "*://www.xiaohongshu.com/user/profile/*",
    "*://www.rednote.com/user/profile/*"
  ],
  run_at: "document_idle"
}

export const getStyle = createPlasmoCsuiStyleGetter(antdResetCss)

export const getInlineAnchor: PlasmoGetInlineAnchor = async () =>
  createMountPoller({
    isPageMatch: () => true,
    findAnchor: findProfileAnchorElement,
    insertPosition: "afterend"
  })

function ProfilePageCsui() {
  const { enabled: noteBatchEnabled, ready } = useNoteBatchCollectEnabled()
  const url = location.href
  const checkReady = useCallback(() => isProfileMountReady(), [])
  const visible = useCsuiMountVisible(checkReady)

  if (!visible) return null

  return (
    <CsuiRoot>
      <PageCollectToolbar pageType="profile" />

      {ready && noteBatchEnabled && (
        <CsuiCollectButton
          label="采集博主笔记"
          to="/xiaohongshu/batch-collect/note"
          bottom={80}
          state={{
            name: "当前博主笔记",
            collectBy: "author-links",
            urls: [url],
            limitPerId: 100
          }}
        />
      )}
      <CsuiCollectButton
        label="采集博主信息"
        to="/xiaohongshu/batch-collect/blogger"
        state={{
          name: "当前博主",
          collectBy: "links",
          urls: [url]
        }}
      />
    </CsuiRoot>
  )
}

export default ProfilePageCsui
