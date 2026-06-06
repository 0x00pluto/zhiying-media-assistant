import {
  CheckCircleOutlined,
  FileTextOutlined,
  SearchOutlined,
  UserOutlined
} from "@ant-design/icons"
import { Alert } from "antd"
import { useState } from "react"

import { useFeishuConfigured } from "~features/feishu/use-feishu-configured"
import { PLATFORMS } from "~shared/constants/platforms"
import { MenuItem } from "~sidepanel/components/menu-item"
import { SidepanelCard } from "~sidepanel/components/sidepanel-card"

const XHS_PLATFORM = PLATFORMS.find((p) => p.code === "www.xiaohongshu")!

const SCENE_GUIDES = [
  {
    scene: "搜索页",
    buttons: "采集本页笔记、关键词博主采集",
    icon: <SearchOutlined />
  },
  {
    scene: "博主主页",
    buttons: "采集博主信息、采集博主笔记",
    icon: <UserOutlined />
  },
  {
    scene: "笔记详情",
    buttons: "下载图片/视频、复制笔记、同步飞书、导出评论",
    icon: <FileTextOutlined />
  }
] as const

function openOptionsPage() {
  void chrome.runtime.openOptionsPage()
}

function openXiaohongshu() {
  void chrome.tabs.create({ url: XHS_PLATFORM.origin, active: true })
}

function XiaohongshuPlatformIcon() {
  const [failed, setFailed] = useState(false)
  const iconUrl = chrome.runtime.getURL(`assets/platforms/${XHS_PLATFORM.icon}`)

  if (failed) {
    return (
      <span className="sidepanel-platform-icon sidepanel-platform-icon--fallback">
        红
      </span>
    )
  }

  return (
    <img
      className="sidepanel-platform-icon"
      src={iconUrl}
      alt=""
      width={22}
      height={22}
      onError={() => setFailed(true)}
    />
  )
}

export function XiaohongshuHome() {
  const { configured, ready } = useFeishuConfigured()

  return (
    <div className="sidepanel-home">
      <SidepanelCard title="开始使用">
        <p className="sidepanel-home__lead">
          请打开小红书网页，在对应页面使用采集功能
        </p>
        <p className="sidepanel-home__sub">
          搜索页、博主主页、笔记详情页会出现采集按钮
        </p>
        <p className="sidepanel-home__tip">
          首次使用请先点右上角设置，配置飞书与下载选项
        </p>

        {ready && !configured && (
          <Alert
            type="warning"
            showIcon
            className="sidepanel-home__feishu-alert"
            message="你还未配置飞书，如需同步到飞书，请先点右上角「设置」"
            onClick={openOptionsPage}
          />
        )}

        {ready && configured && (
          <p className="sidepanel-home__feishu-ok">
            <CheckCircleOutlined aria-hidden />
            飞书已配置，采集结果可直接同步到多维表格
          </p>
        )}
      </SidepanelCard>

      <SidepanelCard title="当前支持的平台">
        <MenuItem
          label={XHS_PLATFORM.name}
          icon={<XiaohongshuPlatformIcon />}
          onClick={openXiaohongshu}
        />
      </SidepanelCard>

      <SidepanelCard title="在哪里使用">
        {SCENE_GUIDES.map(({ scene, buttons, icon }) => (
          <MenuItem
            key={scene}
            icon={icon}
            label={scene}
            description={buttons}
            showArrow={false}
          />
        ))}
      </SidepanelCard>
    </div>
  )
}
