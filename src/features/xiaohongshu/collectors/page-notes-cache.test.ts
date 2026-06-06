import { beforeEach, describe, expect, it, vi } from "vitest"

const NOTE_HOME = "6a1058f5000000000803e331"
const NOTE_SEARCH = "6a01dd9b000000000702c59f"
const TOKEN = "test-xsec-token"

function createWindowStub() {
  return {
    __qmcPageNotesStore: undefined as
      | Map<string, import("./page-notes-cache").PageNoteEntry>
      | undefined,
    __qmcPageCollectContext: undefined as
      | import("./page-notes-cache").PageCollectType
      | undefined,
    location: {
      hostname: "www.xiaohongshu.com",
      href: "https://www.xiaohongshu.com/explore"
    },
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}

vi.stubGlobal("window", createWindowStub())
vi.stubGlobal("location", (globalThis.window as ReturnType<typeof createWindowStub>).location)

import {
  activatePageCollectContext,
  bootstrapPageNotesFromFeeds,
  getCollectiblePageNotesForContext,
  handlePageNotesApiResponse,
  resolvePageCollectTypeFromHref
} from "./page-notes-cache"

describe("resolvePageCollectTypeFromHref", () => {
  it("maps explore / search / profile paths", () => {
    expect(
      resolvePageCollectTypeFromHref("https://www.xiaohongshu.com/explore")
    ).toBe("explore")
    expect(
      resolvePageCollectTypeFromHref(
        "https://www.xiaohongshu.com/search_result?keyword=test"
      )
    ).toBe("search")
    expect(
      resolvePageCollectTypeFromHref(
        "https://www.xiaohongshu.com/user/profile/abc123"
      )
    ).toBe("profile")
    expect(
      resolvePageCollectTypeFromHref(
        "https://www.xiaohongshu.com/explore/6a1058f5000000000803e331"
      )
    ).toBeNull()
  })
})

describe("activatePageCollectContext", () => {
  beforeEach(() => {
    const win = globalThis.window as ReturnType<typeof createWindowStub>
    win.__qmcPageNotesStore = undefined
    win.__qmcPageCollectContext = undefined
  })

  it("removes homefeed notes when switching to search context", () => {
    bootstrapPageNotesFromFeeds([
      { id: NOTE_HOME, xsec_token: TOKEN, note_card: { title: "home" } }
    ])
    handlePageNotesApiResponse({
      url: "https://www.xiaohongshu.com/api/sns/web/v2/search/notes",
      result: {
        data: {
          items: [
            { id: NOTE_SEARCH, xsec_token: TOKEN, note_card: { title: "search" } }
          ]
        }
      }
    })

    activatePageCollectContext("search")

    const notes = getCollectiblePageNotesForContext("search")
    expect(notes).toHaveLength(1)
    expect(notes[0]?.id).toBe(NOTE_SEARCH)
    expect(notes[0]?.url).toContain("pc_search")
    expect(notes.some((note) => note.url.includes("pc_feed"))).toBe(false)
  })

  it("keeps contexts isolated across explore → search → explore", () => {
    bootstrapPageNotesFromFeeds([
      { id: NOTE_HOME, xsec_token: TOKEN, note_card: {} }
    ])
    activatePageCollectContext("explore")
    expect(getCollectiblePageNotesForContext("explore")).toHaveLength(1)

    handlePageNotesApiResponse({
      url: "https://www.xiaohongshu.com/api/sns/web/v2/search/notes",
      result: {
        data: {
          items: [{ id: NOTE_SEARCH, xsec_token: TOKEN, note_card: {} }]
        }
      }
    })
    activatePageCollectContext("search")
    expect(getCollectiblePageNotesForContext("search")).toHaveLength(1)
    expect(getCollectiblePageNotesForContext("search")[0]?.id).toBe(NOTE_SEARCH)

    bootstrapPageNotesFromFeeds([
      { id: NOTE_HOME, xsec_token: TOKEN, note_card: {} }
    ])
    activatePageCollectContext("explore")
    expect(getCollectiblePageNotesForContext("explore")).toHaveLength(1)
    expect(getCollectiblePageNotesForContext("explore")[0]?.id).toBe(NOTE_HOME)
    expect(getCollectiblePageNotesForContext("search")).toHaveLength(0)
  })
})
