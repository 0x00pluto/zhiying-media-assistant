import { describe, expect, it } from "vitest"

import {
  isDocumentLoadedSync,
  isElementLayoutReady
} from "./csui-mount-ready"

describe("isDocumentLoadedSync", () => {
  it("returns true when document is complete", () => {
    expect(isDocumentLoadedSync()).toBe(true)
  })
})

describe("isElementLayoutReady", () => {
  it("returns false for null", () => {
    expect(isElementLayoutReady(null)).toBe(false)
  })

  it("returns false for zero-size element", () => {
    const element = {
      getBoundingClientRect: () => ({
        top: 0,
        left: 0,
        width: 0,
        height: 0
      })
    } as Element

    expect(isElementLayoutReady(element)).toBe(false)
  })

  it("returns true for visible element", () => {
    const element = {
      getBoundingClientRect: () => ({
        top: 10,
        left: 20,
        width: 120,
        height: 36
      })
    } as Element

    expect(isElementLayoutReady(element)).toBe(true)
  })
})
