import { message } from "antd"

import { PLATFORMS } from "~shared/constants/platforms"
import { createTab } from "~shared/messaging"

import { MenuItem } from "./menu-item"

const CURRENT_PLATFORM = "www.xiaohongshu"

type Props = {
  title?: string
}

export function PlatformSwitcher({ title = "其他平台" }: Props) {
  const others = PLATFORMS.filter((p) => p.code !== CURRENT_PLATFORM)

  const handleSwitch = async (origin: string, name: string) => {
    await createTab({ url: origin, active: true })
    message.info(`已打开${name}，请在该平台页面使用侧边栏`)
  }

  return (
    <div>
      {others.map((platform) => (
        <MenuItem
          key={platform.code}
          label={platform.name}
          icon={
            <img
              src={chrome.runtime.getURL(`assets/platforms/${platform.icon}`)}
              alt=""
              width={20}
              height={20}
              style={{ borderRadius: 4 }}
            />
          }
          onClick={() => handleSwitch(platform.origin, platform.name)}
        />
      ))}
    </div>
  )
}
