import type { CSSProperties } from 'react'
import { ProgressBar } from './ProgressBar'

interface AttributeCardProps {
  icon: string
  label: string
  color: string
  level: number
  atMaxLevel: boolean
  currentXp: number
  requiredXp: number
}

/** Tarjeta de la pantalla de Atributos (Dashboard → "Atributos"): mismo lenguaje visual que
 * MissionCard (borde + degradado del color de atributo), pero en formato fila compacta — aquí no
 * hay acciones ni descripción, solo icono + nombre/nivel + barra de XP. Nivel máximo (50) sustituye
 * la línea de XP actual/requerida por el texto "Nivel máximo" en el color del atributo, con la
 * barra ya llena. */
export function AttributeCard({ icon, label, color, level, atMaxLevel, currentXp, requiredXp }: AttributeCardProps) {
  const style = { '--attr-color': color } as CSSProperties

  return (
    <li className="attribute-card" style={style}>
      <span className="attribute-card__icon" aria-hidden="true">
        <img className="attribute-card__icon-img" src={icon} alt="" />
      </span>
      <div className="attribute-card__body">
        <div className="attribute-card__header">
          <strong className="attribute-card__label">{label}</strong>
          <span className="attribute-card__level">Nivel {level}</span>
        </div>
        {atMaxLevel ? (
          <>
            <ProgressBar current={1} max={1} color={color} />
            <span className="attribute-card__max">Nivel máximo</span>
          </>
        ) : (
          <>
            <ProgressBar current={currentXp} max={requiredXp} color={color} />
            <span className="attribute-card__xp">
              {currentXp} / {requiredXp} XP
            </span>
          </>
        )}
      </div>
    </li>
  )
}
