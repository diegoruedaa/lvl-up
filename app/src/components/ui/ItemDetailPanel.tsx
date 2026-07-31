import type { ReactNode } from 'react'
import { Card } from './Card'

interface ItemDetailPanelProps {
  icon: string
  name: string
  rarityColor: string
  rarityLabel: string
  description: string
  children?: ReactNode
}

/** Panel fijo de descripción + acción del objeto seleccionado en la lista de la Mochila (patrón
 * GBA/DS: ItemRow solo selecciona, este panel es donde se lee el efecto y se actúa). */
export function ItemDetailPanel({ icon, name, rarityColor, rarityLabel, description, children }: ItemDetailPanelProps) {
  return (
    <Card variant="highlighted" className="item-detail">
      <div className="item-detail__header">
        <span className="item-detail__icon" aria-hidden="true">
          <img className="item-detail__icon-img" src={icon} alt="" />
        </span>
        <div>
          <strong className="item-detail__name">{name}</strong>
          <span className="item-detail__rarity" style={{ color: rarityColor }}>
            {rarityLabel}
          </span>
        </div>
      </div>
      <p className="item-detail__description">{description}</p>
      {children && <div className="item-detail__actions">{children}</div>}
    </Card>
  )
}
