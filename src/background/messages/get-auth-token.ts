import type { PlasmoMessaging } from "@plasmohq/messaging"

const handler: PlasmoMessaging.MessageHandler = async (_req, res) => {
  const cookie = await chrome.cookies.get({
    url: "https://socialext.com",
    name: "access_token"
  })

  res.send({ token: cookie?.value ?? "" })
}

export default handler
