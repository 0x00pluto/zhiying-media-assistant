import { Checkbox, Collapse, Input, Modal } from "antd"
import { useMemo, useState } from "react"

import type { ColumnDef } from "~shared/columns/types"

import { getFeishuModalProps } from "./modal-utils"
import type { FieldOptions } from "./sync-records"

type Props = {
  columns: ColumnDef[]
  value?: FieldOptions
  onChange?: (value: FieldOptions) => void
}

function groupColumns(columns: ColumnDef[]) {
  const groups = new Map<string, ColumnDef[]>()
  for (const column of columns) {
    const list = groups.get(column.category) || []
    list.push(column)
    groups.set(column.category, list)
  }
  return groups
}

export function FeishuFieldPicker({ columns, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FieldOptions>({
    keys: [],
    skipEmpty: true
  })
  const [keyword, setKeyword] = useState("")
  const [activeKeys, setActiveKeys] = useState<string[]>([])

  const grouped = useMemo(() => groupColumns(columns), [columns])
  const selectedCount = value?.keys.length || 0
  const lockedKey = columns[0]?.key

  const openPicker = () => {
    const next = value || {
      keys: columns.filter((column) => column.default !== false).map((c) => c.key),
      skipEmpty: true
    }
    setDraft(next)
    setActiveKeys([...grouped.keys()])
    setKeyword("")
    setOpen(true)
  }

  const filteredGroups = useMemo(() => {
    const text = keyword.trim().toLowerCase()
    if (!text) return grouped

    const next = new Map<string, ColumnDef[]>()
    for (const [category, items] of grouped.entries()) {
      const matched = items.filter(
        (item) =>
          item.name.toLowerCase().includes(text) ||
          category.toLowerCase().includes(text)
      )
      if (matched.length) next.set(category, matched)
    }
    return next
  }, [grouped, keyword])

  const toggleKey = (key: string, checked: boolean) => {
    if (key === lockedKey) return
    const keys = new Set(draft.keys)
    if (checked) keys.add(key)
    else keys.delete(key)
    if (lockedKey) keys.add(lockedKey)
    setDraft({ ...draft, keys: [...keys] })
  }

  const toggleGroup = (items: ColumnDef[], checked: boolean) => {
    const keys = new Set(draft.keys)
    for (const item of items) {
      if (checked) keys.add(item.key)
      else if (item.key !== lockedKey) keys.delete(item.key)
    }
    if (lockedKey) keys.add(lockedKey)
    setDraft({ ...draft, keys: [...keys] })
  }

  const isGroupChecked = (items: ColumnDef[]) =>
    items.every((item) => draft.keys.includes(item.key))

  const isGroupIndeterminate = (items: ColumnDef[]) => {
    const selected = items.filter((item) => draft.keys.includes(item.key)).length
    return selected > 0 && selected < items.length
  }

  const confirm = () => {
    onChange?.(draft)
    setOpen(false)
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") openPicker()
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 32,
          padding: "4px 11px",
          border: "1px solid #d9d9d9",
          borderRadius: 6,
          cursor: "pointer",
          background: "#fff"
        }}>
        <span>
          共 {columns.length} 项，已选 {selectedCount} 项
        </span>
        <span style={{ color: "#999" }}>{">"}</span>
      </div>

      <Modal
        title={`可选 ${columns.length} 列，已选 ${draft.keys.length} 列`}
        open={open}
        width={720}
        onCancel={() => setOpen(false)}
        onOk={confirm}
        okText="确定"
        cancelText="取消"
        {...getFeishuModalProps()}
        zIndex={2147483647}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12
          }}>
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="请输入分组名或字段名"
            allowClear
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8
          }}>
          <a
            onClick={() => setActiveKeys([])}
            style={{ fontSize: 13 }}>
            全部收起
          </a>
          <Checkbox
            checked={draft.keys.length === columns.length}
            indeterminate={
              draft.keys.length > 0 && draft.keys.length < columns.length
            }
            onChange={(event) => {
              const keys = event.target.checked
                ? columns.map((column) => column.key)
                : lockedKey
                  ? [lockedKey]
                  : []
              setDraft({ ...draft, keys })
            }}>
            全选({columns.length})
          </Checkbox>
        </div>

        <div style={{ maxHeight: 420, overflow: "auto" }}>
          <Collapse
            activeKey={activeKeys}
            onChange={(keys) => setActiveKeys(keys as string[])}
            items={[...filteredGroups.entries()].map(([category, items]) => ({
              key: category,
              label: (
                <Checkbox
                  checked={isGroupChecked(items)}
                  indeterminate={isGroupIndeterminate(items)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => toggleGroup(items, event.target.checked)}>
                  {category}
                </Checkbox>
              ),
              children: (
                <div style={{ display: "grid", gap: 8 }}>
                  {items.map((item) => (
                    <div
                      key={item.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 10px",
                        borderRadius: 6,
                        background: "#f0f7ff"
                      }}>
                      <Checkbox
                        checked={draft.keys.includes(item.key)}
                        disabled={item.key === lockedKey}
                        onChange={(event) =>
                          toggleKey(item.key, event.target.checked)
                        }>
                        {item.name}
                      </Checkbox>
                    </div>
                  ))}
                </div>
              )
            }))}
          />
        </div>
      </Modal>
    </>
  )
}
