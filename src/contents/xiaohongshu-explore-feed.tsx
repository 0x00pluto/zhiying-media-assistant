import type { PlasmoCSConfig, PlasmoGetInlineAnchor } from "plasmo"
import { useCallback } from "react"

import { PageCollectToolbar } from "~features/xiaohongshu/ui/page-collect-toolbar"
import { CsuiRoot } from "~features/xiaohongshu/ui/csui-root"
import { createPlasmoCsuiStyleGetter } from "~features/xiaohongshu/ui/csui-theme"
import {
  createMountPoller,
  isExploreFeedMountReady,
  isElementLayoutReady,
  useCsuiMountVisible
} from "~features/xiaohongshu/utils/csui-mount-ready"
import {
  findExploreFeedAnchorElement,
  isExploreFeedPage,
  useXhsSpaHref
} from "~features/xiaohongshu/utils/spa-location"

import antdResetCss from "data-text:antd/dist/reset.css"

export const config: PlasmoCSConfig = {
  matches: ["*://www.xiaohongshu.com/*", "*://www.rednote.com/*"],
  run_at: "document_idle"
}

export const getStyle = createPlasmoCsuiStyleGetter(antdResetCss)

export const getInlineAnchor: PlasmoGetInlineAnchor = async () =>
  createMountPoller({
    isPageMatch: isExploreFeedPage,
    findAnchor: findExploreFeedAnchorElement,
    insertPosition: "beforebegin",
    isAnchorReady: (channel) => {
      const firstTab =
        channel.querySelector(".channel-list .channel") ||
        channel.querySelector(".channel") ||
        channel.firstElementChild
      return isElementLayoutReady(firstTab)
    }
  })

function ExploreFeedCsui() {
  const href = useXhsSpaHref()
  const onExploreFeed = isExploreFeedPage(href)
  const checkReady = useCallback(() => isExploreFeedMountReady(), [])
  const visible = useCsuiMountVisible(checkReady)

  if (!onExploreFeed || !visible) return null

  return (
    <CsuiRoot>
      <PageCollectToolbar pageType="explore" layout="explore-channel" />
    </CsuiRoot>
  )
}

export default ExploreFeedCsui
