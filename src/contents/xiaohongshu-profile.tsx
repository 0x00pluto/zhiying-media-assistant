import type { PlasmoCSConfig, PlasmoGetInlineAnchor } from "plasmo"
import { App, ConfigProvider } from "antd"

import { useNoteBatchCollectEnabled } from "~features/xiaohongshu/use-note-batch-enabled"
import { CsuiCollectButton } from "~features/xiaohongshu/ui/csui-button"
import { PageCollectToolbar } from "~features/xiaohongshu/ui/page-collect-toolbar"

export const config: PlasmoCSConfig = {
  matches: [
    "*://www.xiaohongshu.com/user/profile/*",
    "*://www.rednote.com/user/profile/*"
  ]
}

export const getInlineAnchor: PlasmoGetInlineAnchor = async () => {
  const element = document.querySelector(
    "#userPageContainer .user-info .info-part .info"
  )
  if (!element) return null

  return {
    element,
    insertPosition: "afterend"
  }
}

function ProfilePageCsui() {
  const { enabled: noteBatchEnabled, ready } = useNoteBatchCollectEnabled()
  const url = location.href

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#ff2442",
          borderRadius: 8
        }
      }}>
      <App>
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
      </App>
    </ConfigProvider>
  )
}

export default ProfilePageCsui
