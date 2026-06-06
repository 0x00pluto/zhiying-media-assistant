import { App, ConfigProvider } from "antd"
import type { ReactNode } from "react"

import { qmcCsuiConfigProviderTheme } from "~features/xiaohongshu/ui/csui-theme"

type Props = {
  children: ReactNode
}

export function CsuiRoot({ children }: Props) {
  return (
    <ConfigProvider theme={qmcCsuiConfigProviderTheme}>
      <App>{children}</App>
    </ConfigProvider>
  )
}
