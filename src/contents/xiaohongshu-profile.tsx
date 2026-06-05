import type { PlasmoCSConfig } from "plasmo"

import { CsuiCollectButton } from "~features/xiaohongshu/ui/csui-button"

export const config: PlasmoCSConfig = {
  matches: [
    "*://www.xiaohongshu.com/user/profile/*",
    "*://www.rednote.com/user/profile/*"
  ]
}

function ProfilePageCsui() {
  const url = location.href

  return (
    <>
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
      <CsuiCollectButton
        label="采集博主信息"
        to="/xiaohongshu/batch-collect/blogger"
        state={{
          name: "当前博主",
          collectBy: "links",
          urls: [url]
        }}
      />
    </>
  )
}

export default ProfilePageCsui
