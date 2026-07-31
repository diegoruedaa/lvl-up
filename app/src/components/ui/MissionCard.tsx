import type { CSSProperties } from 'react'
import type { BadgeVariant } from './Badge'
import { Badge } from './Badge'
import { Button } from './Button'
import { StarRating } from './StarRating'

interface MissionCardProps {
  typeLabel: string
  attributeIcon: string
  attributeLabel: string
  attributeColor: string
  attributeTextColor: string
  attributeTint: string
  /** Etiqueta del atributo secundario ("Intelecto"), o null/undefined si la misión no tiene. */
  secondaryAttributeLabel?: string | null
  name: string
  description: string | null
  starValue: number
  starLabel: string
  urgency: { label: string; variant: BadgeVariant } | null
  isPending: boolean
  /** Verdadero mientras esta misión concreta tiene una petición en curso (completar/eliminar). */
  busy: boolean
  countdownSeconds?: number
  onComplete: () => void
  onUndo: () => void
  onDelete: () => void
}

/** Tarjeta de Tarea/Rutina: zona superior con degradado del color de atributo (medalla ilustrada +
 * nombre e insignia de tipo), cuerpo con el mismo tono como tinte sutil, zona de estrellas
 * destacada, y acciones SIEMPRE visibles (sin gesto de deslizar ni menú). La medalla se muestra tal
 * cual (sin marco geométrico adicional: cada una ya tiene su propio contorno grueso y silueta
 * reconocible — circular, rectangular, irregular — que un hexágono uniforme solo apretaba). Puramente
 * presentacional — recibe todo ya resuelto (colores, textos, callbacks), igual que ItemRow con
 * rarityColor: el mapeo de datos de dominio (ATTRIBUTE_COLORS, DIFFICULTY_STAR_COUNT,
 * dueUrgencyBadge...) vive en el componente llamador (MissionList.tsx). */
export function MissionCard({
  typeLabel,
  attributeIcon,
  attributeLabel,
  attributeColor,
  attributeTextColor,
  attributeTint,
  secondaryAttributeLabel,
  name,
  description,
  starValue,
  starLabel,
  urgency,
  isPending,
  busy,
  countdownSeconds,
  onComplete,
  onUndo,
  onDelete,
}: MissionCardProps) {
  const style = {
    '--attr-color': attributeColor,
    '--attr-tint': attributeTint,
    '--attr-fg': attributeTextColor,
  } as CSSProperties

  return (
    <li className={`mission-card${isPending ? ' mission-card--pending' : ''}`} style={style}>
      <div className="mission-card__ribbon">
        <img className="mission-card__attr-medal" src={attributeIcon} alt="" aria-hidden="true" />
        <span className="mission-card__ribbon-text">
          <span className="mission-card__title-row">
            <strong className={`mission-card__name${isPending ? ' mission-card__name--done' : ''}`}>{name}</strong>
            <span className="mission-card__type-badge">{typeLabel}</span>
          </span>
          <span className="mission-card__attr-label">
            {attributeLabel}
            {secondaryAttributeLabel && (
              <span className="mission-card__attr-secondary"> + {secondaryAttributeLabel}</span>
            )}
          </span>
        </span>
      </div>

      <div className="mission-card__body">
        {description && <p className="mission-card__description">{description}</p>}

        <div className="mission-card__stars-zone">
          <StarRating value={starValue} label={starLabel} />
          {urgency && <Badge variant={urgency.variant}>{urgency.label}</Badge>}
        </div>

        {isPending ? (
          <div className="mission-card__pending-row">
            <Button variant="secondary" onClick={onUndo}>
              Deshacer
            </Button>
            <span className="mission-card__countdown">{countdownSeconds}s</span>
          </div>
        ) : (
          <div className="mission-card__actions">
            <Button variant="primary" onClick={onComplete} disabled={busy}>
              Completar
            </Button>
            <Button variant="danger" onClick={onDelete} disabled={busy}>
              Eliminar
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}
