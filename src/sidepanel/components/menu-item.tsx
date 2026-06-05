type Props = {
  icon?: React.ReactNode
  label: string
  onClick?: () => void
}

export function MenuItem({ icon, label, onClick }: Props) {
  return (
    <button type="button" className="sidepanel-menu-item" onClick={onClick}>
      <span className="sidepanel-menu-item__left">
        {icon && <span className="sidepanel-menu-item__icon">{icon}</span>}
        <span>{label}</span>
      </span>
      <span className="sidepanel-menu-item__arrow">›</span>
    </button>
  )
}
