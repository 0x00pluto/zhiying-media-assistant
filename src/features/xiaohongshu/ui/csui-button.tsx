import { useState } from "react"

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
      onClick={handleClick}
      disabled={loading}
      style={{
        position: "fixed",
        right: 24,
        bottom,
        zIndex: 2147483646,
        padding: "10px 16px",
        borderRadius: 8,
        border: "none",
        background: "#ff2442",
        color: "#fff",
        fontSize: 14,
        fontWeight: 600,
        cursor: loading ? "wait" : "pointer",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
      }}>
      {loading ? "跳转中..." : label}
    </button>
  )
}
