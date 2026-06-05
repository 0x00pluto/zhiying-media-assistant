import type { PlasmoMessaging } from "@plasmohq/messaging"

export type RequestBody = {
  url: string
}

const handler: PlasmoMessaging.MessageHandler<RequestBody> = async (req, res) => {
  const finalUrl = await fetch(req.body.url).then((response) => response.url)
  res.send({ url: finalUrl })
}

export default handler
