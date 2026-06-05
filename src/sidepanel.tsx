import { ConfigProvider } from "antd"
import zhCN from "antd/locale/zh_CN"
import { useEffect } from "react"

import { applyExtensionTitle } from "~shared/extension-title"
import { SidepanelHeader, SidepanelRouter } from "~sidepanel/router"

import "antd/dist/reset.css"
import "~sidepanel/styles/sidepanel.css"

function SidePanel() {
  useEffect(() => {
    applyExtensionTitle()
  }, [])

  return (
    <ConfigProvider locale={zhCN}>
      <main className="sidepanel-root">
        <SidepanelHeader />
        <SidepanelRouter />
      </main>
    </ConfigProvider>
  )
}

export default SidePanel
