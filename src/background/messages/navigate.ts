import type { PlasmoMessaging } from "@plasmohq/messaging"

import type { NavigatePayload } from "~shared/messaging/types"
import { savePendingSidepanelRoute } from "~shared/sidepanel-route"

const handler: PlasmoMessaging.MessageHandler<NavigatePayload> = async (req, res) => {
  const payload = req.body
  if (!payload?.to) {
    res.send({ ok: false })
    return
  }

  const routePayload = {
    ...payload,
    tabId: req.sender?.tab?.id
  }

  await savePendingSidepanelRoute(routePayload)

  try {
    await chrome.runtime.sendMessage({
      type: "navigate",
      data: routePayload,
      timestamp: Date.now()
    })
  } catch {
    // sidepanel 未打开时 sendMessage 会失败，依赖 session 中的 pending route
  }

  res.send({ ok: true })
}

export default handler
