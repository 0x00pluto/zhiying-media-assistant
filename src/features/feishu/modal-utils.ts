import { message } from "antd"

/** Modal 须低于 message，否则 toast 会被遮罩盖住 */
export const FEISHU_MODAL_ZINDEX = 2147483646
export const FEISHU_MESSAGE_ZINDEX = 2147483647

const FEISHU_MESSAGE_CONTAINER_ID = "qmc-feishu-message-container"

let feishuMessageLayerConfigured = false

function getFeishuMessageContainer() {
  let el = document.getElementById(FEISHU_MESSAGE_CONTAINER_ID)
  if (!el) {
    el = document.createElement("div")
    el.id = FEISHU_MESSAGE_CONTAINER_ID
    el.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:${FEISHU_MESSAGE_ZINDEX}`
    document.body.appendChild(el)
  }
  return el
}

/** 将 antd message 挂到最高层容器，避免 CSUI 飞书弹窗打开时被遮罩压住 */
export function ensureFeishuMessageLayer() {
  if (feishuMessageLayerConfigured) return
  feishuMessageLayerConfigured = true
  message.config({
    top: 24,
    getContainer: getFeishuMessageContainer
  })
}

export function getFeishuModalContainer() {
  return document.body
}

export function getFeishuModalProps() {
  ensureFeishuMessageLayer()
  return {
    getContainer: getFeishuModalContainer,
    zIndex: FEISHU_MODAL_ZINDEX,
    centered: true,
    styles: {
      mask: { zIndex: FEISHU_MODAL_ZINDEX },
      wrapper: { zIndex: FEISHU_MODAL_ZINDEX, pointerEvents: "auto" },
      close: { zIndex: FEISHU_MODAL_ZINDEX, pointerEvents: "auto" }
    } as const
  }
}
