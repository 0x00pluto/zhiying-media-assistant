import type { PlasmoCSConfig, PlasmoGetInlineAnchor } from "plasmo"
import { useCallback } from "react"

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
  const checkReady = useCallback(() => isProfileMountReady(), [])
  const visible = useCsuiMountVisible(checkReady)

  if (!visible) return null

  return (
    <CsuiRoot>
      <PageCollectToolbar pageType="profile" />
    </CsuiRoot>
  )
}

export default ProfilePageCsui
