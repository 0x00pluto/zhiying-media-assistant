import type { PlasmoCSConfig, PlasmoGetInlineAnchor } from "plasmo"
import { App, ConfigProvider } from "antd"

import { PageCollectToolbar } from "~features/xiaohongshu/ui/page-collect-toolbar"

export const config: PlasmoCSConfig = {
  matches: [
    "*://www.xiaohongshu.com/explore",
    "*://www.rednote.com/explore"
  ]
}

export const getInlineAnchor: PlasmoGetInlineAnchor = async () => {
  const element = document.querySelector("div.feeds-page > div.channel-container")
  if (!element) return null

  return {
    element,
    insertPosition: "beforebegin"
  }
}

function ExploreFeedCsui() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#ff2442",
          borderRadius: 8
        }
      }}>
      <App>
        <PageCollectToolbar pageType="explore" layout="explore-channel" />
      </App>
    </ConfigProvider>
  )
}

export default ExploreFeedCsui
