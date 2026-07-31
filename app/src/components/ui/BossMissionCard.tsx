import type { CSSProperties } from 'react'
import { Button } from './Button'

interface BossMissionCardProps {
  name: string
  description: string | null
  attributeIcon: string
  difficultyLabel: string
  difficultyColor: string
  attributeText: string
  resultDate: string | null
  onBossAction?: () => void
  /** Solo se usa en el Boss aún no vencido de la lista normal (onBossAction ausente): permite
   * corregir un error (fecha mal puesta, misión creada por accidente) sin esperar a la fecha de
   * resultado. No sustituye a Victoria/Derrota, que siguen bloqueadas hasta esa fecha. */
  onDelete?: () => void
  busy?: boolean
}

/** Tarjeta de Boss: tratamiento de "entrada de diario" ya aprobado (franja lateral + insignia de
 * texto de dificultad, sin estrellas — los Bosses nunca se completan/declaran a mano, eso siempre
 * pasa por la Batalla). Se usa tanto para el Boss aún no vencido de la lista normal (sin botón de
 * resultado, solo texto informativo + "Eliminar" para corregir errores) como para las Batallas
 * pendientes (con "Ir a la batalla", sin Eliminar — ya está resuelto ahí). */
export function BossMissionCard({
  name,
  description,
  attributeIcon,
  difficultyLabel,
  difficultyColor,
  attributeText,
  resultDate,
  onBossAction,
  onDelete,
  busy,
}: BossMissionCardProps) {
  return (
    <li className="mission-entry" style={{ '--difficulty-color': difficultyColor } as CSSProperties}>
      <div className="mission-entry__header">
        <span className="mission-entry__title">
          <img className="mission-entry__type-icon" src={attributeIcon} alt="" />
          <span className="mission-entry__name">{name}</span>
        </span>
        <span className="difficulty-tag">{difficultyLabel}</span>
      </div>

      {description && <p className="mission-entry__description">{description}</p>}

      <div className="mission-entry__meta">
        <span>{attributeText}</span>
        {resultDate && <span>· Resultado: {resultDate}</span>}
      </div>

      <div className="mission-entry__actions">
        {onBossAction ? (
          <Button variant="primary" onClick={onBossAction}>
            Ir a la batalla
          </Button>
        ) : (
          <>
            <span className="mission-entry__hint">
              Disponible en Batallas pendientes desde la fecha de resultado.
            </span>
            {onDelete && (
              <Button variant="danger" onClick={onDelete} disabled={busy}>
                Eliminar
              </Button>
            )}
          </>
        )}
      </div>
    </li>
  )
}
