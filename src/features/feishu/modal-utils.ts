export const FEISHU_MODAL_ZINDEX = 2147483647

export function getFeishuModalContainer() {
  return document.body
}

export function getFeishuModalProps() {
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
