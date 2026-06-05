import { backgroundFetchJson } from "./feishu-fetch"

export {}

type FetchJsonMessage = {
  type: "qmc:fetch-json"
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if ((message as FetchJsonMessage)?.type !== "qmc:fetch-json") {
    return false
  }

  const { url, method, headers, body } = message as FetchJsonMessage

  void backgroundFetchJson(url, { method, headers, body }).then(sendResponse)
  return true
})

if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error))
} else {
  chrome.action.onClicked.addListener((tab) => {
    if (!tab.id) return
    chrome.sidePanel
      .open({ tabId: tab.id, windowId: tab.windowId })
      .catch((error) => console.error(error))
  })
}

if (chrome.storage.session?.setAccessLevel) {
  chrome.storage.session
    .setAccessLevel({
      accessLevel: chrome.storage.AccessLevel.TRUSTED_AND_UNTRUSTED_CONTEXTS
    })
    .catch(() => {})
}
