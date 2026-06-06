import type { CSSProperties } from "react"
import type { PlasmoGetStyle } from "plasmo"

export const QMC_CSUI_PRIMARY = "#1677ff"
export const QMC_CSUI_PRIMARY_HOVER = "#4096ff"
export const QMC_CSUI_PRIMARY_ACTIVE = "#0958d9"
export const QMC_CSUI_BORDER_RADIUS = 10
export const QMC_CSUI_FLOATING_Z_INDEX = 100

export const qmcCsuiConfigProviderTheme = {
  token: {
    colorPrimary: QMC_CSUI_PRIMARY,
    borderRadius: QMC_CSUI_BORDER_RADIUS
  }
}

export const qmcCsuiButtonStyle: CSSProperties = {
  padding: "8px 16px",
  borderRadius: QMC_CSUI_BORDER_RADIUS,
  border: "none",
  background: QMC_CSUI_PRIMARY,
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(22, 119, 255, 0.25)"
}

export const qmcCsuiFloatingButtonStyle: CSSProperties = {
  ...qmcCsuiButtonStyle,
  padding: "10px 16px",
  boxShadow: "0 4px 12px rgba(22, 119, 255, 0.25)"
}

export const qmcCsuiHostCss = `
:host {
  position: relative;
  z-index: 0;
  display: block;
}
`

export const qmcCsuiButtonCss = `
.qmc-csui-btn {
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.15s ease;
}

.qmc-csui-btn:not(:disabled):hover {
  background: ${QMC_CSUI_PRIMARY_HOVER};
  box-shadow: 0 4px 14px rgba(22, 119, 255, 0.38);
  transform: translateY(-1px);
}

.qmc-csui-btn:not(:disabled):active {
  background: ${QMC_CSUI_PRIMARY_ACTIVE};
  box-shadow: 0 1px 4px rgba(9, 88, 217, 0.35);
  transform: translateY(1px) scale(0.98);
}

.qmc-csui-btn:focus-visible {
  outline: 2px solid rgba(22, 119, 255, 0.45);
  outline-offset: 2px;
}

.qmc-csui-btn:disabled {
  opacity: 0.65;
  cursor: wait;
}
`

export function buildCsuiStyleSheet(extraCss = "") {
  return `${qmcCsuiHostCss}${qmcCsuiButtonCss}${extraCss}`
}

export function createPlasmoCsuiStyleGetter(antdResetCss: string): PlasmoGetStyle {
  return () => {
    const style = document.createElement("style")
    style.textContent = `${antdResetCss}${buildCsuiStyleSheet()}`
    return style
  }
}
