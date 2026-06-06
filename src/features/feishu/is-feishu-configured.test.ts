import { describe, expect, it } from "vitest"

import { isFeishuConfigured } from "~features/feishu/use-feishu-configured"

describe("isFeishuConfigured", () => {
  it("returns false when appId and appSecret are empty", () => {
    expect(
      isFeishuConfigured({ provider: "custom", appId: "", appSecret: "" })
    ).toBe(false)
  })

  it("returns false when values are whitespace only", () => {
    expect(
      isFeishuConfigured({ provider: "custom", appId: "  ", appSecret: "  " })
    ).toBe(false)
  })

  it("returns false when only appId is set", () => {
    expect(
      isFeishuConfigured({
        provider: "custom",
        appId: "cli_xxx",
        appSecret: ""
      })
    ).toBe(false)
  })

  it("returns false when only appSecret is set", () => {
    expect(
      isFeishuConfigured({
        provider: "custom",
        appId: "",
        appSecret: "secret"
      })
    ).toBe(false)
  })

  it("returns true when both appId and appSecret are set", () => {
    expect(
      isFeishuConfigured({
        provider: "custom",
        appId: "cli_xxx",
        appSecret: "secret"
      })
    ).toBe(true)
  })
})
