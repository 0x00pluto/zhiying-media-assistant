import type { ColumnDef, XhsApiType } from "~shared/columns/types"

export enum TaskStatus {
  INITIAL = "initial",
  PROCESSING = "processing",
  PAUSING = "pausing",
  PAUSED = "paused",
  COMPLETED = "completed",
  FAILED = "failed"
}

export type FillRecordInput = {
  data: Record<string, unknown>
  api: XhsApiType
  uniqueId?: string
  pageUrl?: string
  keyword?: string
  overwrite?: boolean
}

export abstract class TaskRunner<TCondition extends Record<string, unknown>> {
  isRunning = false
  status = TaskStatus.INITIAL
  records: Record<string, unknown>[] = []
  files: unknown[] = []
  filterRules: unknown[] = []
  id?: number
  name: string
  createdAt = Date.now()
  updatedAt = Date.now()
  interval = { min: 1, max: 3 }

  abstract readonly type: string
  abstract readonly allColumns: ColumnDef[]
  abstract execute(): Promise<void>
  abstract getTotal(): number

  constructor(
    public condition: TCondition,
    public path = ""
  ) {
    this.name = (condition.name as string) || "导出数据"
  }

  getCompleted() {
    return this.records.length
  }

  getData(filter?: unknown) {
    if (!filter || this.records.length === 0) return this.records
    return this.records
  }

  fillRecord(input: FillRecordInput, target: Record<string, unknown>) {
    const columns = this.allColumns.filter((col) => col.apis.includes(input.api))

    for (const column of columns) {
      if (!input.overwrite && target[column.key] !== undefined) continue
      const value = column.handle({
        data: input.data,
        api: input.api,
        pageUrl: input.pageUrl,
        keyword: input.keyword
      })
      if (value !== undefined) {
        target[column.key] = value
      }
    }

    return target
  }

  async setStatus(status: TaskStatus) {
    this.status = status
    this.updatedAt = Date.now()
  }

  async run() {
    if (this.isRunning) return
    this.isRunning = true
    this.records = []
    this.files = []

    try {
      await this.setStatus(TaskStatus.PROCESSING)
      await this.execute()
      if (this.status === TaskStatus.PAUSING) {
        await this.setStatus(TaskStatus.PAUSED)
      } else {
        await this.setStatus(TaskStatus.COMPLETED)
      }
    } catch (error) {
      if (this.status === TaskStatus.PROCESSING) {
        await this.setStatus(TaskStatus.FAILED)
      }
      throw error
    } finally {
      this.isRunning = false
    }
  }
}
