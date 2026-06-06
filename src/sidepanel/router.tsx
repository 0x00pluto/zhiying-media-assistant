import { Button } from "antd"
import { useCallback, useEffect, useState } from "react"

import { PlaceholderPage } from "./pages/general/placeholder"
import { BatchBloggerPage } from "./pages/xiaohongshu/batch-blogger"
import { BatchCommentPage } from "./pages/xiaohongshu/batch-comment"
import { BatchNotePage } from "./pages/xiaohongshu/batch-note"
import { XiaohongshuHome } from "./pages/xiaohongshu/index"
import { UrlTransformPage } from "./pages/xiaohongshu/url-transform"
import { consumePendingSidepanelRoute } from "~shared/sidepanel-route"

type RouteState = {
  path: string
  state?: Record<string, unknown>
}

const DEFAULT_ROUTE: RouteState = { path: "/xiaohongshu" }

const PLACEHOLDER_TITLES: Record<string, string> = {
  "/general/data-center/account": "账号管理",
  "/general/data-center/collect-history": "采集历史",
  "/general/data-center/task-alarm": "任务闹钟"
}

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

  setRoute({
    path: payload.to,
    state: payload.options?.state
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
        setRoute({ path: to, state: options?.state })
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

  const goBack = () => navigate("/xiaohongshu")

  let content: React.ReactNode

  switch (route.path) {
    case "/xiaohongshu/batch-collect/note":
      content = <BatchNotePage initialState={route.state} />
      break
    case "/xiaohongshu/batch-collect/blogger":
      content = <BatchBloggerPage initialState={route.state} />
      break
    case "/xiaohongshu/batch-collect/comment":
      content = <BatchCommentPage initialState={route.state} />
      break
    case "/xiaohongshu/other/url-transform":
      content = <UrlTransformPage />
      break
    default:
      if (PLACEHOLDER_TITLES[route.path]) {
        content = (
          <PlaceholderPage
            title={PLACEHOLDER_TITLES[route.path]}
            onBack={goBack}
          />
        )
      } else {
        content = <XiaohongshuHome onNavigate={navigate} />
      }
      break
  }

  const showBack =
    route.path !== "/xiaohongshu" && !PLACEHOLDER_TITLES[route.path]

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
  return (
    <header className="sidepanel-header">
      <h1 className="sidepanel-header__title">智赢媒体助手 - 小红书</h1>
      <Button type="text" aria-label="设置" onClick={() => chrome.runtime.openOptionsPage()}>
        设置
      </Button>
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
