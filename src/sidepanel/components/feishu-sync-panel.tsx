import { Button } from "antd"
import { useState } from "react"

import { FeishuSyncModal } from "~features/feishu/sync-modal"
import type { FieldOptions } from "~features/feishu/sync-records"
import type { ColumnDef } from "~shared/columns/types"

type Props = {
  columns: ColumnDef[]
  records: Record<string, unknown>[]
  fieldOptions?: FieldOptions
  storageKey?: string
  skipDialogKey?: string
}

export function FeishuSyncPanel({
  columns,
  records,
  fieldOptions,
  storageKey = "qmc-quickSyncFeishu-batch",
  skipDialogKey = "qmc-skipFeishuDialog-batch"
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="primary"
        style={{ marginTop: 16, background: "#2563eb" }}
        onClick={() => setOpen(true)}
        disabled={!records.length}>
        同步到飞书
      </Button>
      <FeishuSyncModal
        open={open}
        onClose={() => setOpen(false)}
        columns={columns}
        records={records}
        storageKey={storageKey}
        skipDialogKey={skipDialogKey}
        defaultFieldOptions={fieldOptions}
      />
    </>
  )
}
