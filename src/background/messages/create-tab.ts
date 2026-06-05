import type { PlasmoMessaging } from "@plasmohq/messaging"

export type RequestBody = chrome.tabs.CreateProperties

const handler: PlasmoMessaging.MessageHandler<RequestBody> = async (req, res) => {
  const tab = await chrome.tabs.create(req.body)
  res.send(tab)
}

export default handler
