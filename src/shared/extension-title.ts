const FALLBACK_NAME = "智赢媒体助手"

export function getExtensionName() {
  return chrome.i18n.getMessage("extName") || FALLBACK_NAME
}

export function applyExtensionTitle(suffix?: string) {
  const name = getExtensionName()
  document.title = suffix ? `${name} - ${suffix}` : name
}
