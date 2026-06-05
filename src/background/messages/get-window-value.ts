import type { PlasmoMessaging } from "@plasmohq/messaging"

import { getWindowValueViaMainWorld } from "~background/helpers/main-world"
import type { GetWindowValuePayload } from "~shared/messaging/types"

export type RequestBody = GetWindowValuePayload & { tabId?: number }

const handler: PlasmoMessaging.MessageHandler<RequestBody> = async (req, res) => {
  try {
    const tabId = req.body.tabId ?? req.sender?.tab?.id
    const paths = { ...req.body } as GetWindowValuePayload & { tabId?: number }
    delete paths.tabId
    const data = await getWindowValueViaMainWorld(paths, tabId)
    res.send(data)
  } catch (error) {
    res.send({ error: (error as Error).message })
  }
}

export default handler
