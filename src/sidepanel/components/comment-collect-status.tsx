import { Alert, Typography } from "antd"

import {
  isRootCommentRecord
} from "~features/xiaohongshu/collectors/comment-collect-limit"
import type { CommentCollectPhase } from "~features/xiaohongshu/collectors/comment"
import { TaskStatus } from "~shared/task-runner"

type Props = {
  running: boolean
  status: TaskStatus
  includeSub: boolean
  progress: { completed: number; total: number }
  records: Record<string, unknown>[]
  collectPhase?: CommentCollectPhase
  subExpand?: { index: number; total: number }
  noteId?: string
}

function countRecords(
  records: Record<string, unknown>[],
  noteId?: string
) {
  const scoped = noteId
    ? records.filter((record) => record.note_id === noteId)
    : records
  const rootCount = scoped.filter(isRootCommentRecord).length
  return {
    rootCount,
    subCount: scoped.length - rootCount,
    totalCount: scoped.length
  }
}

function resolveUiPhase(input: {
  running: boolean
  includeSub: boolean
  progress: { completed: number; total: number }
  collectPhase?: CommentCollectPhase
}) {
  if (!input.running) {
    return "idle" as const
  }

  if (
    input.includeSub &&
    input.collectPhase === "sub" &&
    input.progress.completed >= input.progress.total &&
    input.progress.total > 0
  ) {
    return "sub" as const
  }

  return "root" as const
}

export function CommentCollectStatus({
  running,
  status,
  includeSub,
  progress,
  records,
  collectPhase,
  subExpand,
  noteId
}: Props) {
  const { rootCount, subCount, totalCount } = countRecords(records, noteId)
  const phase = resolveUiPhase({ running, includeSub, progress, collectPhase })

  if (phase === "sub") {
    const { total } = progress
    const expandTotal = subExpand?.total ?? 0
    const expandCurrent =
      expandTotal > 0
        ? Math.min((subExpand?.index ?? 0) + 1, expandTotal)
        : 0

    return (
      <Alert
        type="info"
        showIcon
        message="正在展开子评论"
        description={
          <div>
            <div>
              一级评论已完成（{total}/{total}），正在逐条展开回复。热帖可能需数分钟，请稍候。
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              已采集子评论 {subCount} 条
              {expandTotal > 0
                ? ` · 回复楼 ${expandCurrent}/${expandTotal}`
                : null}
            </Typography.Text>
          </div>
        }
        style={{ marginBottom: 12 }}
      />
    )
  }

  if (running) {
    return (
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        采集中 · 一级评论 {progress.completed}/{progress.total}
      </Typography.Paragraph>
    )
  }

  if (status === TaskStatus.COMPLETED && totalCount > 0) {
    return (
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        已完成 · 一级 {rootCount} 条，子评论 {subCount} 条，共 {totalCount} 条
      </Typography.Paragraph>
    )
  }

  if (status === TaskStatus.FAILED) {
    return (
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        采集失败
        {totalCount > 0
          ? ` · 已写入一级 ${rootCount} 条，子评论 ${subCount} 条，共 ${totalCount} 条`
          : null}
      </Typography.Paragraph>
    )
  }

  return (
    <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
      等待开始采集
    </Typography.Paragraph>
  )
}

export function resolveCommentCollectButtonLabel(input: {
  running: boolean
  includeSub: boolean
  progress: { completed: number; total: number }
  collectPhase?: CommentCollectPhase
}) {
  if (!input.running) {
    return "开始采集"
  }

  const phase = resolveUiPhase(input)
  if (phase === "sub") {
    return "展开子评论中..."
  }

  return "采集中..."
}
