import type { ReactNode } from "react"

type Props = {
  title?: string
  children: ReactNode
  className?: string
}

export function SidepanelCard({ title, children, className }: Props) {
  return (
    <section className={["sidepanel-card-v2", className].filter(Boolean).join(" ")}>
      {title && <h2 className="sidepanel-card-v2__title">{title}</h2>}
      <div className="sidepanel-card-v2__body">{children}</div>
    </section>
  )
}
