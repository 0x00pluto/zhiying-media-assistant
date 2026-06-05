import type { NavigatePayload } from "~shared/messaging/types"

const PENDING_ROUTE_KEY = "qmc:pendingSidepanelRoute"
const ACTIVE_XHS_TAB_KEY = "qmc:activeXhsTabId"

export type PendingSidepanelRoute = NavigatePayload & {
  timestamp: number
  tabId?: number
}

export async function savePendingSidepanelRoute(
  payload: NavigatePayload & { tabId?: number }
) {
  const pending: PendingSidepanelRoute = {
    ...payload,
    timestamp: Date.now()
  }
  await chrome.storage.session.set({ [PENDING_ROUTE_KEY]: pending })
}

export async function consumePendingSidepanelRoute() {
  const result = await chrome.storage.session.get(PENDING_ROUTE_KEY)
  const pending = result[PENDING_ROUTE_KEY] as PendingSidepanelRoute | undefined
  if (!pending?.to) return null

  await chrome.storage.session.remove(PENDING_ROUTE_KEY)
  if (pending.tabId) {
    await chrome.storage.session.set({ [ACTIVE_XHS_TAB_KEY]: pending.tabId })
  }
  return pending
}

export async function getActiveXhsTabId() {
  const result = await chrome.storage.session.get(ACTIVE_XHS_TAB_KEY)
  return result[ACTIVE_XHS_TAB_KEY] as number | undefined
}
