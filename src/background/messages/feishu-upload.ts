import type { PlasmoMessaging } from "@plasmohq/messaging"

import { feishuUpload } from "~features/media/upload"

export type RequestBody = {
  url: string
  file_name: string
  parent_type: string
  parent_node: string
  token: string
}

const handler: PlasmoMessaging.MessageHandler<RequestBody> = async (req, res) => {
  try {
    const data = await feishuUpload(req.body)
    res.send(data)
  } catch (error) {
    res.send({ error: (error as Error).message })
  }
}

export default handler
