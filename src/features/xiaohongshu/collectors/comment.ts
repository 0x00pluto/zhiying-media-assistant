import { fetchComments, fetchSubComments } from "~features/xiaohongshu/api/client"
import { parseNoteUrl, sleep } from "~features/xiaohongshu/api/parsers"
import { COMMENT_COLUMNS } from "~features/xiaohongshu/columns/comment"
import { TaskRunner } from "~shared/task-runner"

export type CommentCollectCondition = {
  name?: string
  collectBy: "links"
  urls: string[]
  limitPerId?: number
  includeSub?: boolean
}

export class CommentCollector extends TaskRunner<CommentCollectCondition> {
  readonly type = "comment"
  readonly allColumns = COMMENT_COLUMNS

  getTotal() {
    return (this.condition.urls?.length || 0) * (this.condition.limitPerId || 100)
  }

  async execute() {
    for (const url of this.condition.urls || []) {
      await this.collectNoteComments(url, this.condition.limitPerId || 100)
    }
  }

  private async addComment(
    data: Record<string, unknown>,
    noteId: string,
    isSub = false
  ) {
    const record: Record<string, unknown> = { note_id: noteId, is_sub: isSub }
    this.fillRecord(
      { data: { ...data, note_id: noteId, is_sub: isSub }, api: "comment" },
      record
    )
    this.records.push(record)
  }

  private async collectNoteComments(url: string, limit: number) {
    const note = parseNoteUrl(url)
    let cursor = ""
    let collected = 0

    while (collected < limit) {
      const result = (await fetchComments({
        note_id: note.id,
        cursor,
        top_comment_id: "",
        image_formats: "jpg,webp,avif",
        xsec_token: note.token
      })) as {
        comments?: Array<Record<string, unknown>>
        cursor?: string
        has_more?: boolean
      }

      const comments = result.comments || []
      for (const comment of comments) {
        if (collected >= limit) break
        await this.addComment(comment, note.id)
        collected++

        if (this.condition.includeSub && comment.sub_comment_count) {
          const subResult = (await fetchSubComments({
            note_id: note.id,
            root_comment_id: comment.id as string,
            num: 10,
            cursor: "",
            xsec_token: note.token
          })) as { comments?: Array<Record<string, unknown>> }

          for (const sub of subResult.comments || []) {
            if (collected >= limit) break
            await this.addComment(sub, note.id, true)
            collected++
          }
        }
      }

      if (!result.has_more || !result.cursor) break
      cursor = result.cursor
      await sleep()
    }
  }
}
