import { App, ConfigProvider } from "antd"
import { useEffect, type ReactNode } from "react"

import { ensureFeishuMessageLayer } from "~features/feishu/modal-utils"
import { qmcCsuiConfigProviderTheme } from "~features/xiaohongshu/ui/csui-theme"

type Props = {
  children: ReactNode
}

export function CsuiRoot({ children }: Props) {
  useEffect(() => {
    ensureFeishuMessageLayer()
  }, [])

  return (
    <ConfigProvider theme={qmcCsuiConfigProviderTheme}>
      <App>{children}</App>
    </ConfigProvider>
  )
}
