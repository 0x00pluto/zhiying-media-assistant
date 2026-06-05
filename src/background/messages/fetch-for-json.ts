import type { PlasmoMessaging } from "@plasmohq/messaging"

import { backgroundFetchJson } from "~background/feishu-fetch"

export type RequestBody = {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
}

const handler: PlasmoMessaging.MessageHandler<RequestBody> = async (req, res) => {
  const { url, ...init } = req.body
  res.send(await backgroundFetchJson(url, init))
}

export default handler
