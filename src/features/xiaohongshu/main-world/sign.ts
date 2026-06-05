declare global {
  interface Window {
    _webmsxyw?: (path: string, data?: unknown) => { "X-s": string; "X-t": number }
    mnsv2?: (input: string, md5Input: string, md5Path: string) => string
    xsecplatform?: string
  }
}

const B64_CHARS =
  "ZmserBbHoQNtNP+wOcza/LpnGgG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5"

function encodeUriToBytes(input: string): number[] {
  const encoded = encodeURIComponent(input)
  const bytes: number[] = []
  for (let i = 0; i < encoded.length; i++) {
    const ch = encoded.charAt(i)
    if (ch === "%") {
      bytes.push(parseInt(encoded.charAt(i + 1) + encoded.charAt(i + 2), 16))
      i += 2
    } else {
      bytes.push(ch.charCodeAt(0))
    }
  }
  return bytes
}

function b64EncodeBytes(bytes: number[]): string {
  let output = ""
  const len = bytes.length
  const remainder = len % 3
  const chunkSize = 16383

  for (let i = 0; i < len - remainder; i += chunkSize) {
    const end = i + chunkSize > len - remainder ? len - remainder : i + chunkSize
    for (let j = i; j < end; j += 3) {
      const n =
        ((bytes[j] << 16) & 0xff0000) +
        ((bytes[j + 1] << 8) & 0xff00) +
        (bytes[j + 2] & 0xff)
      output +=
        B64_CHARS[(n >> 18) & 63] +
        B64_CHARS[(n >> 12) & 63] +
        B64_CHARS[(n >> 6) & 63] +
        B64_CHARS[n & 63]
    }
  }

  if (remainder === 1) {
    const n = bytes[len - 1]
    output += B64_CHARS[n >> 2] + B64_CHARS[(n << 4) & 63] + "=="
  } else if (remainder === 2) {
    const n = (bytes[len - 2] << 8) + bytes[len - 1]
    output +=
      B64_CHARS[n >> 10] +
      B64_CHARS[(n >> 4) & 63] +
      B64_CHARS[(n << 2) & 63] +
      "="
  }

  return output
}

async function md5Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32)
}

function buildXsCommon(): string {
  const ua = navigator.userAgent.toLowerCase()
  let platform = "PC"
  if (ua.includes("android")) platform = "Android"
  else if (ua.includes("iphone") || ua.includes("ipad")) platform = "iOS"
  else if (ua.includes("mac")) platform = "Mac OS"
  else if (ua.includes("windows")) platform = "Windows"
  else if (ua.includes("linux")) platform = "Linux"

  const b1 = localStorage.getItem("b1") || ""
  const payload = {
    s0: 5,
    s1: "",
    x0: localStorage.getItem("b1b1") || "1",
    x1: "4.2.6",
    x2: platform,
    x3: "xhs-pc-web",
    x4: "4.83.1",
    x5: "",
    x6: "",
    x7: "",
    x8: b1,
    x9: b1,
    x10: 0,
    x11: "normal"
  }

  return b64EncodeBytes(encodeUriToBytes(JSON.stringify(payload)))
}

function randomHex(length: number): string {
  const chars = "abcdef0123456789"
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("")
}

export async function buildSignedHeaders(
  path: string,
  data?: unknown
): Promise<Record<string, string>> {
  if (window._webmsxyw) {
    const signed = window._webmsxyw(path, data)
    return {
      "x-s": signed["X-s"],
      "x-t": String(signed["X-t"]),
      "x-b3-traceid": randomHex(16),
      "x-xray-traceid": randomHex(32),
      "x-s-common": buildXsCommon()
    }
  }

  if (window.mnsv2) {
    let payload = path
    if (data && typeof data === "object") {
      payload += JSON.stringify(data)
    } else if (typeof data === "string") {
      payload += data
    }

    const md5Payload = await md5Hex(payload)
    const md5Path = await md5Hex(path)
    const x3 = window.mnsv2(payload, md5Payload, md5Path)
    const body = {
      x0: "4.3.3",
      x1: "xhs-pc-web",
      x2: window.xsecplatform || "PC",
      x3,
      x4: data ? typeof data : ""
    }

    return {
      "x-s": `XYS_${b64EncodeBytes(encodeUriToBytes(JSON.stringify(body)))}`,
      "x-t": String(Date.now()),
      "x-b3-traceid": randomHex(16),
      "x-xray-traceid": randomHex(32),
      "x-s-common": buildXsCommon()
    }
  }

  throw new Error("页面签名函数未就绪，请刷新小红书页面后重试")
}
