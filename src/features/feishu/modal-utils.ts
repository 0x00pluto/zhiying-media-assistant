export const FEISHU_MODAL_ZINDEX = 2147483646

export function getFeishuModalContainer() {
  return document.body
}

export function getFeishuModalProps() {
  return {
    getContainer: getFeishuModalContainer,
    zIndex: FEISHU_MODAL_ZINDEX,
    styles: {
      mask: { zIndex: FEISHU_MODAL_ZINDEX }
    } as const
  }
}
