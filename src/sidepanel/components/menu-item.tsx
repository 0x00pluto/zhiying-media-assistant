type Props = {
  icon?: React.ReactNode
  label: string
  description?: string
  showArrow?: boolean
  onClick?: () => void
}

export function MenuItem({
  icon,
  label,
  description,
  showArrow = true,
  onClick
}: Props) {
  const Tag = onClick ? "button" : "div"

  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={[
        "sidepanel-menu-item",
        onClick ? "sidepanel-menu-item--clickable" : "sidepanel-menu-item--static"
      ].join(" ")}
      onClick={onClick}>
      <span className="sidepanel-menu-item__left">
        {icon && <span className="sidepanel-menu-item__icon">{icon}</span>}
        <span className="sidepanel-menu-item__text">
          <span className="sidepanel-menu-item__label">{label}</span>
          {description && (
            <span className="sidepanel-menu-item__description">{description}</span>
          )}
        </span>
      </span>
      {showArrow && <span className="sidepanel-menu-item__arrow">›</span>}
    </Tag>
  )
}
