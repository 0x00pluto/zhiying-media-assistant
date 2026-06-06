import { describe, expect, it } from "vitest"

import { parseFeedNoteCard } from "~features/xiaohongshu/feed/parse-feed-note"

import {
  extractNoteMediaFiles,
  extractVideoFile,
  resolveVideoUrl
} from "./extract"

const videoFeedEnvelope = {
  code: 0,
  success: true,
  data: {
    items: [
      {
        id: "6a167757000000000803fc0e",
        model_type: "note",
        note_card: {
          note_id: "6a167757000000000803fc0e",
          type: "video",
          interact_info: { liked_count: "274", comment_count: "14" },
          desc: "疫苗话题",
          image_list: [
            {
              url_default:
                "http://sns-webpic-qc.xhscdn.com/202606062159/507d3d3b5737a9ebe5273f497597737e/1040g2sg320lk8b3d5sl05pakejb25u25rs9vo7g!nd_dft_wlteh_webp_3"
            }
          ],
          video: {
            media: {
              stream: {
                h264: [
                  {
                    stream_desc: "WM_X264_MP4_web",
                    master_url:
                      "http://sns-video-qc.xhscdn.com/stream/1/110/259/01ea16775613eee8010370039e67c4dd50_259.mp4?sign=abc&t=1",
                    size: 47863110
                  }
                ],
                h265: [
                  {
                    stream_desc: "X265_MP4_WEB_309",
                    master_url:
                      "http://sns-video-qc.xhscdn.com/stream/1/110/309/01ea16775613eee8010370019e67c973bf_309.mp4?sign=def&t=1",
                    size: 40987294
                  },
                  {
                    stream_desc: "X265_MP4_WEB_301",
                    master_url:
                      "http://sns-video-qc.xhscdn.com/stream/1/110/301/01ea16775613eee8010370019e67c65057_301.mp4?sign=ghi&t=1",
                    size: 63594163
                  }
                ],
                h266: [],
                av1: []
              }
            }
          }
        }
      }
    ]
  }
}

describe("resolveVideoUrl with feed video note", () => {
  it("从 feed note_card 解析 h265 最高清 mp4", () => {
    const noteCard = parseFeedNoteCard(videoFeedEnvelope)
    expect(noteCard).not.toBeNull()

    const url = resolveVideoUrl(noteCard!)
    expect(url).toContain("sns-video-qc.xhscdn.com")
    expect(url).toContain("_301.mp4")
  })
})

describe("extractNoteMediaFiles videoOnly", () => {
  const noteCard = parseFeedNoteCard(videoFeedEnvelope)!

  it("videoOnly 有视频时只返回 mp4", () => {
    const files = extractNoteMediaFiles(noteCard, "6a167757000000000803fc0e", {
      videoOnly: true
    })
    expect(files).toHaveLength(1)
    expect(files[0].type).toBe("video")
    expect(files[0].filename).toMatch(/\.mp4$/)
  })

  it("videoOnly 无 video stream 时不返回封面", () => {
    const coverOnlyNote = {
      type: "video",
      image_list: noteCard.image_list
    }
    const files = extractNoteMediaFiles(coverOnlyNote, "note-id", {
      videoOnly: true
    })
    expect(files).toHaveLength(0)
  })

  it("默认模式仍包含封面", () => {
    const files = extractNoteMediaFiles(noteCard, "6a167757000000000803fc0e")
    expect(files.some((file) => file.type === "video")).toBe(true)
    expect(files.some((file) => file.type === "cover")).toBe(true)
  })
})

describe("extractVideoFile", () => {
  it("无 video 字段时返回 undefined", () => {
    expect(extractVideoFile({ type: "video" }, "id")).toBeUndefined()
  })
})
