import { BloggerCollector } from "~features/xiaohongshu/tasks/blogger"
import { CommentCollector } from "~features/xiaohongshu/tasks/comment"
import { NoteCollector } from "~features/xiaohongshu/tasks/note"
import type { TaskRunner } from "~shared/task-runner"

export type TaskType = "note" | "blogger" | "comment"

let currentTask: TaskRunner<Record<string, unknown>> | null = null

export function runTask(
  type: TaskType,
  condition: Record<string, unknown>,
  path = ""
) {
  if (currentTask?.isRunning) {
    throw new Error("已有任务正在运行")
  }

  if (type === "note") {
    currentTask = new NoteCollector(condition as never, path)
  } else if (type === "blogger") {
    currentTask = new BloggerCollector(condition as never, path)
  } else if (type === "comment") {
    currentTask = new CommentCollector(condition as never, path)
  } else {
    throw new Error(`未知任务类型: ${type}`)
  }

  return currentTask
}

export function getCurrentTask() {
  return currentTask
}

export function clearTask() {
  currentTask = null
}
