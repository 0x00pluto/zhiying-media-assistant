import { SettingOutlined } from "@ant-design/icons"
import { Button } from "antd"
import { useCallback, useEffect, useMemo, useState } from "react"

import iconUrl from "url:~/assets/icon.png"

import { BatchBloggerPage } from "./pages/xiaohongshu/batch-blogger"
import { BatchCommentPage } from "./pages/xiaohongshu/batch-comment"
import { BatchNotePage } from "./pages/xiaohongshu/batch-note"
import { XiaohongshuHome } from "./pages/xiaohongshu/index"
import { getExtensionName } from "~shared/extension-title"
import { consumePendingSidepanelRoute } from "~shared/sidepanel-route"

type RouteState = {
  path: string
  state?: Record<string, unknown>
}

const DEFAULT_ROUTE: RouteState = { path: "/xiaohongshu" }

const BATCH_ROUTES = new Set([
  "/xiaohongshu/batch-collect/note",
  "/xiaohongshu/batch-collect/blogger",
  "/xiaohongshu/batch-collect/comment"
])

const REMOVED_ROUTES = new Set([
  "/xiaohongshu/other/url-transform",
  "/general/data-center/account",
  "/general/data-center/collect-history",
  "/general/data-center/task-alarm"
])

async function applyNavigatePayload(
  payload: {
    to: string
    options?: { state?: Record<string, unknown> }
    tabId?: number
  },
  setRoute: (route: RouteState) => void
) {
  if (payload.tabId) {
    await chrome.storage.session.set({ "qmc:activeXhsTabId": payload.tabId })
  }

  const path = REMOVED_ROUTES.has(payload.to) ? DEFAULT_ROUTE.path : payload.to

  setRoute({
    path,
    state: {
      ...payload.options?.state,
      navId: Date.now()
    }
  })
}

export function SidepanelRouter() {
  const [route, setRoute] = useState<RouteState>(DEFAULT_ROUTE)

  const navigate = useCallback((path: string, state?: Record<string, unknown>) => {
    setRoute({ path, state })
  }, [])

  useEffect(() => {
    const handleNavigateMessage = (message: {
      type?: string
      data?: {
        to: string
        options?: { state?: Record<string, unknown> }
        tabId?: number
      }
    }) => {
      if (message?.type === "navigate" && message.data?.to) {
        void applyNavigatePayload(message.data, setRoute)
      }
    }

    chrome.runtime.onMessage.addListener(handleNavigateMessage)

    void consumePendingSidepanelRoute().then((pending) => {
      if (pending?.to) {
        applyNavigatePayload(pending, setRoute)
      }
    })

    window.router = {
      navigate: (to, options) => {
        const path = REMOVED_ROUTES.has(to) ? DEFAULT_ROUTE.path : to
        setRoute({
          path,
          state: {
            ...options?.state,
            navId: Date.now()
          }
        })
      },
      location: { pathname: "/xiaohongshu" }
    }

    return () => {
      chrome.runtime.onMessage.removeListener(handleNavigateMessage)
    }
  }, [])

  useEffect(() => {
    if (window.router) {
      window.router.location = { pathname: route.path }
    }
  }, [route.path])

  useEffect(() => {
    if (REMOVED_ROUTES.has(route.path)) {
      setRoute(DEFAULT_ROUTE)
    }
  }, [route.path])

  const goBack = () => navigate("/xiaohongshu")

  let content: React.ReactNode

  switch (route.path) {
    case "/xiaohongshu/batch-collect/note":
      content = (
        <BatchNotePage
          key={String(route.state?.navId ?? "batch-note")}
          initialState={route.state}
        />
      )
      break
    case "/xiaohongshu/batch-collect/blogger":
      content = <BatchBloggerPage initialState={route.state} />
      break
    case "/xiaohongshu/batch-collect/comment":
      content = <BatchCommentPage initialState={route.state} />
      break
    default:
      content = <XiaohongshuHome />
      break
  }

  const showBack = BATCH_ROUTES.has(route.path)

  return (
    <div className="sidepanel-body">
      {showBack && (
        <Button
          type="link"
          onClick={goBack}
          style={{ padding: 0, marginBottom: 12, height: "auto" }}>
          ← 返回
        </Button>
      )}
      {content}
    </div>
  )
}

export function SidepanelHeader() {
  const extName = useMemo(() => getExtensionName(), [])

  return (
    <header className="sidepanel-header">
      <div className="sidepanel-header__brand">
        <img
          className="sidepanel-header__logo"
          src={iconUrl}
          alt=""
          width={28}
          height={28}
        />
        <h1 className="sidepanel-header__title">{extName}</h1>
      </div>
      <Button
        type="text"
        icon={<SettingOutlined />}
        className="sidepanel-header__settings"
        aria-label="打开扩展设置"
        onClick={() => chrome.runtime.openOptionsPage()}
      />
    </header>
  )
}

declare global {
  interface Window {
    router?: {
      navigate: (to: string, options?: { state?: Record<string, unknown> }) => void
      location?: { pathname: string }
    }
  }
}
