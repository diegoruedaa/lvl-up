import type { ReactNode } from 'react'

interface ItemRowProps {
  icon: string
  name: string
  rarityColor: string
  /** Cantidad en mano; omitido en filas de recompensa pendiente (usar statusLabel en su lugar). */
  quantity?: number
  /** Sustituye la cantidad cuando la fila no representa algo "en mano" (p. ej. "En espera"). */
  statusLabel?: string
  /** Sustituye cantidad/statusLabel por contenido a medida (p. ej. precio + icono de moneda en el Mercado). */
  rightContent?: ReactNode
  /** Cantidad ya poseída del objeto, como insignia discreta sobre el icono en vez de en la zona de
   * cantidad/precio (Mercado: evita que "(tienes N)" compita visualmente con el precio). Se omite si es 0. */
  ownedCount?: number
  selected: boolean
  onSelect: () => void
}

/** Fila compacta de lista tipo mochila de Pokémon (GBA/DS): icono pequeño + nombre coloreado por
 * rareza + cantidad a la derecha, sin tarjeta ni botón propio. Sustituye la casilla-tarjeta grande de
 * la iteración anterior; la acción vive aparte, en ItemDetailPanel, cuando la fila está seleccionada. */
export function ItemRow({
  icon,
  name,
  rarityColor,
  quantity,
  statusLabel,
  rightContent,
  ownedCount,
  selected,
  onSelect,
}: ItemRowProps) {
  return (
    <button type="button" className={`item-row${selected ? ' item-row--selected' : ''}`} onClick={onSelect} aria-pressed={selected}>
      <span className="item-row__cursor" aria-hidden="true">
        {selected ? '▶' : ''}
      </span>
      <span className="item-row__icon-wrap">
        <span className="item-row__icon" aria-hidden="true">
          <img className="item-row__icon-img" src={icon} alt="" />
        </span>
        {ownedCount !== undefined && ownedCount > 0 && (
          <span className="item-row__owned-badge" aria-hidden="true">
            ×{ownedCount}
          </span>
        )}
      </span>
      <span className="item-row__dot" style={{ background: rarityColor }} aria-hidden="true" />
      <span className="item-row__name" style={{ color: rarityColor }}>
        {name}
        {ownedCount !== undefined && ownedCount > 0 && <span className="sr-only"> (tienes {ownedCount})</span>}
      </span>
      <span className={rightContent !== undefined ? 'item-row__price' : statusLabel !== undefined ? 'item-row__status' : 'item-row__qty'}>
        {rightContent ?? statusLabel ?? `× ${quantity}`}
      </span>
    </button>
  )
}
