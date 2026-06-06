import { useState } from "react"

import {
  QMC_CSUI_FLOATING_Z_INDEX,
  qmcCsuiFloatingButtonStyle
} from "~features/xiaohongshu/ui/csui-theme"
import { navigateSidepanel } from "~shared/messaging"

type Props = {
  label: string
  to: string
  state: Record<string, unknown>
  bottom?: number
}

export function CsuiCollectButton({ label, to, state, bottom = 24 }: Props) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      await navigateSidepanel({ to, options: { state } })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      className="qmc-csui-btn"
      onClick={handleClick}
      disabled={loading}
      style={{
        ...qmcCsuiFloatingButtonStyle,
        position: "fixed",
        right: 24,
        bottom,
        zIndex: QMC_CSUI_FLOATING_Z_INDEX,
        cursor: loading ? "wait" : "pointer"
      }}>
      {loading ? "跳转中..." : label}
    </button>
  )
}
