/** 仅在 background service worker 中调用，绕过页面 CORS */
export async function backgroundFetchJson<T = unknown>(
  url: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string
  }
): Promise<T & { __error?: string }> {
  try {
    const response = await fetch(url, init)

    if (!response.ok) {
      const text = await response.text()
      return {
        __error: `HTTP ${response.status}: ${text || response.statusText}`
      } as T & { __error?: string }
    }

    return (await response.json()) as T & { __error?: string }
  } catch (error) {
    return {
      __error: (error as Error).message || "请求失败"
    } as T & { __error?: string }
  }
}
