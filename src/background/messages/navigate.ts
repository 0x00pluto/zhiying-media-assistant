import type { PlasmoMessaging } from "@plasmohq/messaging"

import type { NavigatePayload } from "~shared/messaging/types"

const handler: PlasmoMessaging.MessageHandler<NavigatePayload> = async (req, res) => {
  await chrome.runtime.sendMessage({
    type: "navigate",
    data: req.body,
    timestamp: Date.now()
  })
  res.send({ ok: true })
}

export default handler
