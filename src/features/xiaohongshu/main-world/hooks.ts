import {
  QMC_API_RESPONSE_EVENT,
  type ApiInterceptPayload
} from "~shared/messaging/types"

function isJsonText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  )
}

function parseJson(text: string): unknown {
  if (!isJsonText(text)) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function shouldInterceptUrl(url: string | URL | Request, suffix: string): boolean {
  if (!suffix) return false

  try {
    if (typeof url === "string") {
      if (url.startsWith("/") || url.startsWith(location.origin)) return true
      if (!url.startsWith("https://")) return false
      return url.includes(suffix)
    }

    if (url instanceof URL) {
      return url.hostname.endsWith(suffix.replace(/^\./, ""))
    }

    if (url instanceof Request) {
      return url.url.includes(suffix)
    }
  } catch {
    return false
  }

  return false
}

function emitResponse(payload: ApiInterceptPayload) {
  try {
    window.dispatchEvent(
      new CustomEvent(QMC_API_RESPONSE_EVENT, { detail: payload })
    )
  } catch (error) {
    console.warn("dispatch api response failed", error)
  }

  try {
    chrome.runtime?.sendMessage?.({
      type: "response",
      data: payload,
      timestamp: Date.now()
    })
  } catch {
    // MAIN world 下 chrome.runtime 可能不可用，依赖 CustomEvent
  }
}

async function handleFetchResponse(
  response: Response,
  init?: RequestInit,
  clone = true
) {
  const target = clone ? response.clone() : response
  const contentType = target.headers.get("content-type") || ""

  if (!contentType.includes("application/json")) return

  const text = await target.text()
  const result = parseJson(text)
  if (result === undefined) return

  let body: unknown
  if (typeof init?.body === "string") {
    body = parseJson(init.body)
  }

  emitResponse({
    url: response.url,
    method: init?.method || "GET",
    body,
    result
  })
}

export function installFetchHook(domainSuffix: string) {
  const nativeFetch = window.fetch.bind(window)

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    if (!shouldInterceptUrl(args[0] as string | URL | Request, domainSuffix)) {
      return nativeFetch(...args)
    }

    const response = await nativeFetch(...args)
    try {
      const init = args[1] as RequestInit | undefined
      await handleFetchResponse(response, init)
    } catch (error) {
      console.warn(error)
    }
    return response
  }
}

export function installXhrHook(domainSuffix: string) {
  const nativeOpen = XMLHttpRequest.prototype.open
  const nativeSend = XMLHttpRequest.prototype.send

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: [boolean?, string?, string?]
  ) {
    if (typeof url === "string" && shouldInterceptUrl(url, domainSuffix)) {
      ; (this as XMLHttpRequest & { _smzs_method?: string })._smzs_method = method
    }
    return nativeOpen.call(this, method, url, ...rest)
  }

  XMLHttpRequest.prototype.send = function (
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    const xhr = this as XMLHttpRequest & {
      _smzs_method?: string
      _smzs_data?: string
    }

    if (!xhr._smzs_method) {
      return nativeSend.call(this, body)
    }

    const previousOnLoad = xhr.onload
    xhr.onload = function (ev: ProgressEvent<EventTarget>) {
      try {
        const contentType = xhr.getResponseHeader("content-type") || ""
        if (
          contentType.includes("application/json") &&
          ["", "text"].includes(xhr.responseType) &&
          isJsonText(xhr.responseText)
        ) {
          const result = parseJson(xhr.responseText)
          if (result !== undefined) {
            emitResponse({
              url: xhr.responseURL,
              method: xhr._smzs_method || "GET",
              body: xhr._smzs_data ? parseJson(xhr._smzs_data) : undefined,
              result
            })
          }
        }
      } catch (error) {
        console.warn(error)
      }

      return previousOnLoad?.call(this, ev)
    }

    if (typeof body === "string" && isJsonText(body)) {
      xhr._smzs_data = body
    }

    return nativeSend.call(this, body)
  }
}

export function getDomainSuffix(): string | undefined {
  const hostname = window.location.hostname
  if (!hostname || hostname === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return undefined
  }

  const parts = hostname.split(":")
  const host = parts[0].split(".")
  if (host.length >= 2) {
    return "." + host.slice(-2).join(".")
  }
  return host[0]
}
