import { useState } from "react"

import { FeishuSyncModal } from "~features/feishu/sync-modal"
import type { ColumnDef } from "~shared/columns/types"

type Props = {
  columns: ColumnDef[]
  records: Record<string, unknown>[]
}

export function FeishuSyncPanel({ columns, records }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!records.length}
        style={{
          marginTop: 16,
          padding: "8px 14px",
          borderRadius: 6,
          border: "none",
          background: "#2563eb",
          color: "#fff",
          cursor: records.length ? "pointer" : "not-allowed"
        }}>
        同步到飞书
      </button>
      <FeishuSyncModal
        open={open}
        onClose={() => setOpen(false)}
        columns={columns}
        records={records}
        storageKey="qmc-quickSyncFeishu-batch"
        skipDialogKey="qmc-skipFeishuDialog-batch"
      />
    </>
  )
}
