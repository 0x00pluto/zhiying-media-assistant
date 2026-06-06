declare global {
  interface Window {
    _webmsxyw?: (path: string, data?: unknown) => { "X-s": string; "X-t": number }
    mnsv2?: (input: string, md5Input: string, md5Path: string) => string
    xsecplatform?: string
  }
}

const B64_CHARS =
  "ZmserBbHoQNtNP+wOcza/LpnGgG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5"

const MRC_TABLE = [
  0, 1996959894, 3993919788, 2567524794, 124634137, 1886057615, 3915621685,
  2657392035, 249268274, 2044508324, 3772115230, 2547177864, 162941995,
  2125561021, 3887607047, 2428444049, 498536548, 1789927666, 4089016648,
  2227061214, 450548861, 1843258603, 4107580753, 2211677639, 325883990,
  1684777152, 4251122042, 2321926636, 335633487, 1661365465, 4195302755,
  2366115317, 997073096, 1281953886, 3579855332, 2724688242, 1006888145,
  1258607687, 3524101629, 2768942443, 901097722, 1119000684, 3686517206,
  2898065728, 853044451, 1172266101, 3705015759, 2882616665, 651767980,
  1373503546, 3369554304, 3218104598, 565507253, 1454621731, 3485111705,
  3099436303, 671266974, 1594198024, 3322730930, 2970347812, 795835527,
  1483230225, 3244367275, 3060149565, 1994146192, 31158534, 2563907772,
  4023717930, 1907459465, 112637215, 2680153253, 3904427059, 2013776290,
  251722036, 2517215374, 3775830040, 2137656763, 141376813, 2439277719,
  3865271297, 1802195444, 476864866, 2238001368, 4066508878, 1812370925,
  453092731, 2181625025, 4111451223, 1706088902, 314042704, 2344532202,
  4240017532, 1658658271, 366619977, 2362670323, 4224994405, 1303535960,
  984961486, 2747007092, 3569037538, 1256170817, 1037604311, 2765210733,
  3554079995, 1131014506, 879679996, 2909243462, 3663771856, 1141124467,
  855842277, 2852801631, 3708648649, 1342533948, 654459306, 3188396048,
  3373015174, 1466479909, 544179635, 3110523913, 3462522015, 1591671054,
  702138776, 2966460450, 3352799412, 1504918807, 783551873, 3082640443,
  3233442989, 3988292384, 2596254646, 62317068, 1957810842, 3939845945,
  2647816111, 81470997, 1943803523, 3814918930, 2489596804, 225274430,
  2053790376, 3826175755, 2466906013, 167816743, 2097651377, 4027552580,
  2265490386, 503444072, 1762050814, 4150417245, 2154129355, 426522225,
  1852507879, 4275313526, 2312317920, 282753626, 1742555852, 4189708143,
  2394877945, 397917763, 1622183637, 3604390888, 2714866558, 953729732,
  1340076626, 3518719985, 2797360999, 1068828381, 1219638859, 3624741850,
  2936675148, 906185462, 1090812512, 3747672003, 2825379669, 829329135,
  1181335161, 3412177804, 3160834842, 628085408, 1382605366, 3423369109,
  3138078467, 570562233, 1426400815, 3317316542, 2998733608, 733239954,
  1555261956, 3268935591, 3050360625, 752459403, 1541320221, 2607071920,
  3965973030, 1969922972, 40735498, 2617837225, 3943577151, 1913087877,
  83908371, 2512341634, 3803740692, 2075208622, 213261112, 2463272603,
  3855990285, 2094854071, 198958881, 2262029012, 4057260610, 1759359992,
  534414190, 2176718541, 4139329115, 1873836001, 414664567, 2282248934,
  4279200368, 1711684554, 285281116, 2405801727, 4167216745, 1634467795,
  376229701, 2685067896, 3608007406, 1308918612, 956543938, 2808555105,
  3495958263, 1231636301, 1047427035, 2932959818, 3654703836, 1088359270,
  936918000, 2847714899, 3736837829, 1202900863, 817233897, 3183342108,
  3401237130, 1404277552, 615818150, 3134207493, 3453421203, 1423857449,
  601450431, 3009837614, 3294710456, 1567103746, 711928724, 3020668471,
  3272380065, 1510334235, 755167117
]

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

function md5Hex(input: string): string {
  const bytes = new TextEncoder().encode(input)
  const words: number[] = []
  for (let i = 0; i < bytes.length; i++) {
    words[i >> 2] = (words[i >> 2] || 0) | (bytes[i] << ((i % 4) * 8))
  }
  words[bytes.length >> 2] = (words[bytes.length >> 2] || 0) | (0x80 << ((bytes.length % 4) * 8))
  words[(((bytes.length + 8) >> 6) << 4) + 14] = bytes.length * 8

  let a = 1732584193
  let b = -271733879
  let c = -1732584194
  let d = 271733878

  const ff = (aa: number, bb: number, cc: number, dd: number, x: number, s: number, t: number) => {
    const n = aa + ((bb & cc) | (~bb & dd)) + x + t
    return ((n << s) | (n >>> (32 - s))) + bb
  }
  const gg = (aa: number, bb: number, cc: number, dd: number, x: number, s: number, t: number) => {
    const n = aa + ((bb & dd) | (cc & ~dd)) + x + t
    return ((n << s) | (n >>> (32 - s))) + bb
  }
  const hh = (aa: number, bb: number, cc: number, dd: number, x: number, s: number, t: number) => {
    const n = aa + (bb ^ cc ^ dd) + x + t
    return ((n << s) | (n >>> (32 - s))) + bb
  }
  const ii = (aa: number, bb: number, cc: number, dd: number, x: number, s: number, t: number) => {
    const n = aa + (cc ^ (bb | ~dd)) + x + t
    return ((n << s) | (n >>> (32 - s))) + bb
  }

  for (let i = 0; i < words.length; i += 16) {
    const oa = a
    const ob = b
    const oc = c
    const od = d

    a = ff(a, b, c, d, words[i] || 0, 7, -680876936)
    d = ff(d, a, b, c, words[i + 1] || 0, 12, -389564586)
    c = ff(c, d, a, b, words[i + 2] || 0, 17, 606105819)
    b = ff(b, c, d, a, words[i + 3] || 0, 22, -1044525330)
    a = ff(a, b, c, d, words[i + 4] || 0, 7, -176418897)
    d = ff(d, a, b, c, words[i + 5] || 0, 12, 1200080426)
    c = ff(c, d, a, b, words[i + 6] || 0, 17, -1473231341)
    b = ff(b, c, d, a, words[i + 7] || 0, 22, -45705983)
    a = ff(a, b, c, d, words[i + 8] || 0, 7, 1770035416)
    d = ff(d, a, b, c, words[i + 9] || 0, 12, -1958414417)
    c = ff(c, d, a, b, words[i + 10] || 0, 17, -42063)
    b = ff(b, c, d, a, words[i + 11] || 0, 22, -1990404162)
    a = ff(a, b, c, d, words[i + 12] || 0, 7, 1804603682)
    d = ff(d, a, b, c, words[i + 13] || 0, 12, -40341101)
    c = ff(c, d, a, b, words[i + 14] || 0, 17, -1502002290)
    b = ff(b, c, d, a, words[i + 15] || 0, 22, 1236535329)

    a = gg(a, b, c, d, words[i + 1] || 0, 5, -165796510)
    d = gg(d, a, b, c, words[i + 6] || 0, 9, -1069501632)
    c = gg(c, d, a, b, words[i + 11] || 0, 14, 643717713)
    b = gg(b, c, d, a, words[i] || 0, 20, -373897302)
    a = gg(a, b, c, d, words[i + 5] || 0, 5, -701558691)
    d = gg(d, a, b, c, words[i + 10] || 0, 9, 38016083)
    c = gg(c, d, a, b, words[i + 15] || 0, 14, -660478335)
    b = gg(b, c, d, a, words[i + 4] || 0, 20, -405537848)
    a = gg(a, b, c, d, words[i + 9] || 0, 5, 568446438)
    d = gg(d, a, b, c, words[i + 14] || 0, 9, -1019803690)
    c = gg(c, d, a, b, words[i + 3] || 0, 14, -187363961)
    b = gg(b, c, d, a, words[i + 8] || 0, 20, 1163531501)
    a = gg(a, b, c, d, words[i + 13] || 0, 5, -1444681467)
    d = gg(d, a, b, c, words[i + 2] || 0, 9, -51403784)
    c = gg(c, d, a, b, words[i + 7] || 0, 14, 1735328473)
    b = gg(b, c, d, a, words[i + 12] || 0, 20, -1926607734)

    a = hh(a, b, c, d, words[i + 5] || 0, 4, -378558)
    d = hh(d, a, b, c, words[i + 8] || 0, 11, -2022574463)
    c = hh(c, d, a, b, words[i + 11] || 0, 16, 1839030562)
    b = hh(b, c, d, a, words[i + 14] || 0, 23, -35309556)
    a = hh(a, b, c, d, words[i + 1] || 0, 4, -1530992060)
    d = hh(d, a, b, c, words[i + 4] || 0, 11, 1272893353)
    c = hh(c, d, a, b, words[i + 7] || 0, 16, -155497632)
    b = hh(b, c, d, a, words[i + 10] || 0, 23, -1094730640)
    a = hh(a, b, c, d, words[i + 13] || 0, 4, 681279174)
    d = hh(d, a, b, c, words[i] || 0, 11, -358537222)
    c = hh(c, d, a, b, words[i + 3] || 0, 16, -722521979)
    b = hh(b, c, d, a, words[i + 6] || 0, 23, 76029189)
    a = hh(a, b, c, d, words[i + 9] || 0, 4, -640364487)
    d = hh(d, a, b, c, words[i + 12] || 0, 11, -421815835)
    c = hh(c, d, a, b, words[i + 15] || 0, 16, 530742520)
    b = hh(b, c, d, a, words[i + 2] || 0, 23, -995338651)

    a = ii(a, b, c, d, words[i] || 0, 6, -198630844)
    d = ii(d, a, b, c, words[i + 7] || 0, 10, 1126891415)
    c = ii(c, d, a, b, words[i + 14] || 0, 15, -1416354905)
    b = ii(b, c, d, a, words[i + 5] || 0, 21, -57434055)
    a = ii(a, b, c, d, words[i + 12] || 0, 6, 1700485571)
    d = ii(d, a, b, c, words[i + 3] || 0, 10, -1894986606)
    c = ii(c, d, a, b, words[i + 10] || 0, 15, -1051523)
    b = ii(b, c, d, a, words[i + 1] || 0, 21, -2054922799)
    a = ii(a, b, c, d, words[i + 8] || 0, 6, 1873313359)
    d = ii(d, a, b, c, words[i + 15] || 0, 10, -30611744)
    c = ii(c, d, a, b, words[i + 6] || 0, 15, -1560198380)
    b = ii(b, c, d, a, words[i + 13] || 0, 21, 1309151649)
    a = ii(a, b, c, d, words[i + 4] || 0, 6, -145523070)
    d = ii(d, a, b, c, words[i + 11] || 0, 10, -1120210379)
    c = ii(c, d, a, b, words[i + 2] || 0, 15, 718787259)
    b = ii(b, c, d, a, words[i + 9] || 0, 21, -343485551)

    a = (a + oa) | 0
    b = (b + ob) | 0
    c = (c + oc) | 0
    d = (d + od) | 0
  }

  const toHex = (n: number) => {
    let s = ""
    for (let i = 0; i < 4; i++) {
      s += ((n >> (i * 8)) & 255).toString(16).padStart(2, "0")
    }
    return s
  }

  return toHex(a) + toHex(b) + toHex(c) + toHex(d)
}

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ""
}

function mrc(input: string): number {
  let o = -1
  const len = Math.min(57, input.length)
  for (let n = 0; n < len; n++) {
    o = MRC_TABLE[(o & 255) ^ input.charCodeAt(n)] ^ (o >>> 8)
  }
  return o ^ -1 ^ 3988292384
}

function getPlatformLabel() {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes("android")) return "Android"
  if (ua.includes("iphone") || ua.includes("ipad")) return "iOS"
  if (ua.includes("mac")) return "Mac OS"
  if (ua.includes("windows")) return "Windows"
  if (ua.includes("linux")) return "Linux"
  return "PC"
}

function buildXsCommon(xs: string, xt: string): string {
  const b1 = localStorage.getItem("b1") || ""
  const payload = {
    s0: 5,
    s1: "",
    x0: localStorage.getItem("b1b1") || "1",
    x1: "4.2.6",
    x2: getPlatformLabel(),
    x3: "xhs-pc-web",
    x4: "4.83.1",
    x5: getCookie("a1"),
    x6: xt,
    x7: xs,
    x8: b1,
    x9: mrc(`${xt}${xs}${b1}`),
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
  if (window.mnsv2) {
    let payload = path
    if (data && typeof data === "object") {
      payload += JSON.stringify(data)
    } else if (typeof data === "string") {
      payload += data
    }

    const md5Payload = md5Hex(payload)
    const md5Path = md5Hex(path)
    const x3 = window.mnsv2(payload, md5Payload, md5Path)
    const body = {
      x0: "4.3.3",
      x1: "xhs-pc-web",
      x2: window.xsecplatform || "PC",
      x3,
      x4: data ? typeof data : ""
    }

    const xt = String(Date.now())
    const xs = `XYS_${b64EncodeBytes(encodeUriToBytes(JSON.stringify(body)))}`

    return {
      "x-s": xs,
      "x-t": xt,
      "x-b3-traceid": randomHex(16),
      "x-xray-traceid": randomHex(32),
      "x-s-common": buildXsCommon(xs, xt)
    }
  }

  if (window._webmsxyw) {
    const signed = window._webmsxyw(path, data)
    const xs = signed["X-s"]
    const xt = String(signed["X-t"])

    return {
      "x-s": xs,
      "x-t": xt,
      "x-b3-traceid": randomHex(16),
      "x-xray-traceid": randomHex(32),
      "x-s-common": buildXsCommon(xs, xt)
    }
  }

  throw new Error("页面签名函数未就绪，请刷新小红书页面后重试")
}
