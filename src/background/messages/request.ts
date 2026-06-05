import type { PlasmoMessaging } from "@plasmohq/messaging"

import { requestViaMainWorld } from "~background/helpers/main-world"
import type { HttpRequestConfig } from "~shared/messaging/types"

export type RequestBody = HttpRequestConfig & { tabId?: number }

const handler: PlasmoMessaging.MessageHandler<RequestBody> = async (req, res) => {
  try {
    const { tabId, ...config } = req.body
    const data = await requestViaMainWorld(config, tabId)
    if (!data) {
      res.send({
        status: 500,
        statusText: "Error",
        data: null,
        headers: {},
        error: "页面未响应，请刷新小红书页面后重试"
      })
      return
    }
    res.send(data)
  } catch (error) {
    res.send({
      status: 500,
      statusText: "Error",
      data: null,
      headers: {},
      error: (error as Error).message
    })
  }
}

export default handler
