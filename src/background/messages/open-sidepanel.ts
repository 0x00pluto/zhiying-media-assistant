import type { PlasmoMessaging } from "@plasmohq/messaging"

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const tabId = req.sender?.tab?.id
  const windowId = req.sender?.tab?.windowId

  if (!tabId || !chrome.sidePanel?.open) {
    res.send({ ok: false })
    return
  }

  try {
    await chrome.sidePanel.open({ tabId, windowId })
    res.send({ ok: true })
  } catch (error) {
    console.error(error)
    res.send({ ok: false })
  }
}

export default handler
