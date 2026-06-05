import { useEffect } from "react"

import { applyExtensionTitle } from "~shared/extension-title"

type DownloadCommand =
  | { cmd: "fetch"; index: number; url: string }
  | { cmd: "abort"; index: number }
  | { cmd: "revoke"; url: string }

/**
 * 隐藏 Tab 页：通过 chrome.runtime.connect 长连接代理跨域下载。
 * 逻辑移植自原项目 download-repeater.js。
 */
function DownloadRepeaterPage() {
  useEffect(() => {
    applyExtensionTitle()
  }, [])

  useEffect(() => {
    if ((window as Window & { downloadRepeaterInstalled?: boolean }).downloadRepeaterInstalled) {
      return
    }

    ;(window as Window & { downloadRepeaterInstalled?: boolean }).downloadRepeaterInstalled =
      true

    const controllers = new Map<number, AbortController>()

    chrome.runtime.onConnect.addListener((port) => {
      if (port.name !== "download-repeater") return

      port.onDisconnect.addListener(() => {
        controllers.forEach((controller) => controller.abort())
        controllers.clear()
      })

      port.onMessage.addListener((message: DownloadCommand & { index?: number }) => {
        if (typeof message.index !== "number") return

        if (message.cmd === "fetch" && "url" in message) {
          void fetchWithProgress(port, message.index, message.url, controllers)
          return
        }

        if (message.cmd === "abort") {
          controllers.get(message.index)?.abort()
          controllers.delete(message.index)
          return
        }

        if (message.cmd === "revoke" && "url" in message) {
          URL.revokeObjectURL(message.url)
        }
      })
    })
  }, [])

  return null
}

async function fetchWithProgress(
  port: chrome.runtime.Port,
  index: number,
  url: string,
  controllers: Map<number, AbortController>
) {
  const controller = new AbortController()

  try {
    controllers.set(index, controller)

    const response = await fetch(url.replace(/^http:/, "https:"), {
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const contentLength = response.headers.get("Content-Length")
    const totalBytes = contentLength ? Number.parseInt(contentLength, 10) : 0

    port.postMessage({ index, totalBytes })

    if (!response.body) {
      throw new Error("Response body is not readable")
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    let lastReportAt = Date.now()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length

      const now = Date.now()
      if ((now - lastReportAt) / 1000 >= 0.5) {
        port.postMessage({ index, bytesReceived: received, status: "downloading" })
        lastReportAt = now
      }
    }

    port.postMessage({ index, bytesReceived: received, status: "downloading" })

    const buffer = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) {
      buffer.set(chunk, offset)
      offset += chunk.length
    }

    const blobUrl = URL.createObjectURL(
      new Blob([buffer], { type: "application/octet-stream" })
    )

    port.postMessage({ index, status: "completed", blobUrl })
  } catch (error) {
    console.error("download error.", error)
    port.postMessage({ index, status: "error" })
  } finally {
    controllers.delete(index)
  }
}

export default DownloadRepeaterPage
