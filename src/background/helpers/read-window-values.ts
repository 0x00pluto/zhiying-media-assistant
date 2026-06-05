import type { GetWindowValuePayload } from "~shared/messaging/types"

/** 在页面 MAIN world 执行，读取 window 嵌套属性 */
export function readWindowValues(paths: GetWindowValuePayload) {
  const result: Record<string, unknown> = {}

  for (const [key, chain] of Object.entries(paths)) {
    let current: unknown = window
    for (const segment of chain) {
      if (current == null) {
        result[key] = undefined
        break
      }
      current = (current as Record<string, unknown>)[segment]
    }
    if (!(key in result)) {
      result[key] = current
    }
  }

  return result
}
