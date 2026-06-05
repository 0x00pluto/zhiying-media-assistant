import { useEffect, useMemo, useState } from "react"

import {
  feishuConfigStorage,
  feishuSyncConfigStorage,
  xiaohongshuFieldConfigStorage
} from "~features/feishu/storage"

import iconUrl from "url:~/assets/icon.png"

import { getExtensionName } from "~shared/extension-title"

const menuItems = [
  { key: "feishu", label: "飞书同步" },
  { key: "fields", label: "小红书字段" }
] as const

type MenuKey = (typeof menuItems)[number]["key"]

function resolveMenuFromHash(): MenuKey {
  const hash = window.location.hash.replace(/^#\/?/, "")
  if (hash === "sync-feishu" || hash === "feishu") return "feishu"
  if (hash === "fields") return "fields"
  return "feishu"
}

function OptionsPage() {
  const extName = useMemo(() => getExtensionName(), [])
  const [active, setActive] = useState<MenuKey>(() => resolveMenuFromHash())
  const [appId, setAppId] = useState("")
  const [appSecret, setAppSecret] = useState("")
  const [maxBatchSize, setMaxBatchSize] = useState(500)
  const [maxBatchSizeWithMedias, setMaxBatchSizeWithMedias] = useState(100)
  const [maxConcurrentUploads, setMaxConcurrentUploads] = useState(5)
  const [maxFileSize, setMaxFileSize] = useState(20)
  const [removeContentTags, setRemoveContentTags] = useState(false)
  const [saved, setSaved] = useState("")

  useEffect(() => {
    document.title = `${getExtensionName()} - 设置`
    setActive(resolveMenuFromHash())
    const onHashChange = () => setActive(resolveMenuFromHash())
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  useEffect(() => {
    feishuConfigStorage.get().then((config) => {
      setAppId(config.appId)
      setAppSecret(config.appSecret)
    })
    feishuSyncConfigStorage.get().then((config) => {
      setMaxBatchSize(config.maxBatchSize)
      setMaxBatchSizeWithMedias(config.maxBatchSizeWithMedias)
      setMaxConcurrentUploads(config.maxConcurrentUploads)
      setMaxFileSize(config.maxFileSize)
    })
    xiaohongshuFieldConfigStorage.get().then((config) => {
      setRemoveContentTags(Boolean(config.note?.removeContentTags))
    })
  }, [])

  const saveFeishu = async () => {
    await feishuConfigStorage.set({
      provider: "custom",
      appId,
      appSecret
    })
    await feishuSyncConfigStorage.set({
      maxBatchSize,
      maxBatchSizeWithMedias,
      maxConcurrentUploads,
      maxFileSize
    })
    setSaved("飞书配置已保存")
  }

  const saveFields = async () => {
    await xiaohongshuFieldConfigStorage.set({
      note: { removeContentTags }
    })
    setSaved("字段配置已保存")
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        background: "#fff",
        color: "#0f172a"
      }}>
      <aside
        style={{
          width: 288,
          borderRight: "1px solid #e2e8f0",
          padding: "24px 20px"
        }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <img src={iconUrl} alt="" width={32} height={32} />
          <h1 style={{ margin: 0, fontSize: 22 }}>{extName}</h1>
        </div>

        <nav style={{ marginTop: 24, display: "grid", gap: 4 }}>
          {menuItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setActive(item.key)
                setSaved("")
                window.location.hash = item.key === "feishu" ? "sync-feishu" : item.key
              }}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                border: "none",
                borderRadius: 8,
                background: item.key === active ? "#eff6ff" : "transparent",
                color: item.key === active ? "#1d4ed8" : "#334155",
                cursor: "pointer",
                fontSize: 14
              }}>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <section style={{ flex: 1, padding: 32, maxWidth: 640 }}>
        {active === "feishu" && (
          <>
            <h2 style={{ marginTop: 0 }}>飞书同步配置</h2>
            <p style={{ color: "#64748b", lineHeight: 1.6 }}>
              使用自建飞书应用凭证，不接入 socialext 平台。
            </p>
            <label style={labelStyle}>
              App ID
              <input value={appId} onChange={(e) => setAppId(e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              App Secret
              <input
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                type="password"
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              批量写入上限
              <input
                type="number"
                value={maxBatchSize}
                onChange={(e) => setMaxBatchSize(Number(e.target.value))}
                style={inputStyle}
              />
            </label>
            <h3 style={{ fontSize: 16, margin: "24px 0 12px" }}>上传素材限制</h3>
            <label style={labelStyle}>
              含素材时批量写入上限
              <input
                type="number"
                value={maxBatchSizeWithMedias}
                onChange={(e) => setMaxBatchSizeWithMedias(Number(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              素材并发上传数
              <input
                type="number"
                value={maxConcurrentUploads}
                onChange={(e) => setMaxConcurrentUploads(Number(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              单个素材大小上限（MB）
              <input
                type="number"
                value={maxFileSize}
                onChange={(e) => setMaxFileSize(Number(e.target.value))}
                style={inputStyle}
              />
            </label>
            <button type="button" onClick={saveFeishu} style={primaryBtn}>
              保存
            </button>
          </>
        )}

        {active === "fields" && (
          <>
            <h2 style={{ marginTop: 0 }}>小红书字段转换</h2>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={removeContentTags}
                onChange={(e) => setRemoveContentTags(e.target.checked)}
              />
              导出笔记内容时移除话题标签
            </label>
            <button type="button" onClick={saveFields} style={{ ...primaryBtn, marginTop: 16 }}>
              保存
            </button>
          </>
        )}

        {saved && <p style={{ color: "#16a34a", marginTop: 16 }}>{saved}</p>}
      </section>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 16,
  fontSize: 14
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  boxSizing: "border-box"
}

const primaryBtn: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 6,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer"
}

export default OptionsPage
