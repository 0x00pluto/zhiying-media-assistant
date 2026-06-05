import { Button, Empty } from "antd"

type Props = {
  title: string
  onBack: () => void
}

export function PlaceholderPage({ title, onBack }: Props) {
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <Empty
        description="功能开发中，敬请期待"
        style={{ marginTop: 48 }}
      />
      <Button type="link" onClick={onBack} style={{ marginTop: 16, padding: 0 }}>
        ← 返回
      </Button>
    </div>
  )
}
