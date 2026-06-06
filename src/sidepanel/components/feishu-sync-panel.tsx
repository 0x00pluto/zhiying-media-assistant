import { Button } from "antd"
import type { ReactNode } from "react"
import { useState } from "react"

import { FeishuSyncModal } from "~features/feishu/sync-modal"
import { FEISHU_TARGET_KEYS } from "~features/feishu/sync-prefs"
import type { FieldOptions } from "~features/feishu/sync-records"
import type { ColumnDef } from "~shared/columns/types"

type Props = {
  columns: ColumnDef[]
  records: Record<string, unknown>[]
  fieldOptions?: FieldOptions
  storageKey?: string
  skipDialogKey?: string
  extraActions?: ReactNode
}

export function FeishuSyncPanel({
  columns,
  records,
  fieldOptions,
  storageKey = FEISHU_TARGET_KEYS.batchNote,
  skipDialogKey,
  extraActions
}: Props) {
  const [open, setOpen] = useState(false)
  const resolvedSkipKey =
    skipDialogKey ?? `qmc-skipFeishuDialog:${storageKey}`

  return (
    <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 16
        }}>
        <Button
          type="primary"
          style={{ background: "#2563eb" }}
          onClick={() => setOpen(true)}
          disabled={!records.length}>
          同步到飞书
        </Button>
        {extraActions}
      </div>
      <FeishuSyncModal
        open={open}
        onClose={() => setOpen(false)}
        columns={columns}
        records={records}
        storageKey={storageKey}
        skipDialogKey={resolvedSkipKey}
        defaultFieldOptions={fieldOptions}
      />
    </>
  )
}
