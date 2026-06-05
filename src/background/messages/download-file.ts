import type { PlasmoMessaging } from "@plasmohq/messaging"

export type RequestBody = chrome.downloads.DownloadOptions

const handler: PlasmoMessaging.MessageHandler<RequestBody> = async (req, res) => {
  const downloadId = await chrome.downloads.download(req.body)
  res.send({ downloadId })
}

export default handler
