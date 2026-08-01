import { useEffect, useRef, useState } from 'react'
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
  /** Racha de días consecutivos sin fallar (solo rutinas). undefined = no aplica (tareas); 0 = oculto
   * a propósito (ver mission-card__badges más abajo), nunca se pinta "🔥 0". */
  streak?: number
  isPending: boolean
  /** Verdadero mientras esta misión concreta tiene una petición en curso (completar/eliminar). */
  busy: boolean
  countdownSeconds?: number
  onComplete: () => void
  onUndo: () => void
  onDelete: () => void
  onEdit: () => void
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
  streak,
  isPending,
  busy,
  countdownSeconds,
  onComplete,
  onUndo,
  onDelete,
  onEdit,
}: MissionCardProps) {
  const style = {
    '--attr-color': attributeColor,
    '--attr-tint': attributeTint,
    '--attr-fg': attributeTextColor,
  } as CSSProperties

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Cierra el menú al tocar/clicar fuera de él — no hace falta nada al pulsar Editar, porque
  // seleccionar la opción ya lo cierra explícitamente antes de llamar a onEdit.
  useEffect(() => {
    if (!menuOpen) return
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [menuOpen])

  return (
    <li className={`mission-card${isPending ? ' mission-card--pending' : ''}`} style={style}>
      {/* Oculto durante isPending: mismo criterio que ya aplicaba a Completar/Eliminar (no se edita
          una misión con una confirmación de hoy todavía en el margen de deshacer). */}
      {!isPending && (
        <div className="mission-card__menu" ref={menuRef}>
          <button
            type="button"
            className="mission-card__menu-trigger"
            aria-label="Más acciones"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            ⋮
          </button>
          {menuOpen && (
            <div className="mission-card__menu-dropdown" role="menu">
              <button
                type="button"
                role="menuitem"
                className="mission-card__menu-item"
                onClick={() => {
                  setMenuOpen(false)
                  onEdit()
                }}
              >
                Editar
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mission-card__ribbon">
        <img className="mission-card__attr-medal" src={attributeIcon} alt="" aria-hidden="true" />
        <span className="mission-card__ribbon-text">
          <strong className={`mission-card__name${isPending ? ' mission-card__name--done' : ''}`}>{name}</strong>
          <span className="mission-card__meta-row">
            <span className="mission-card__attr-label">
              {attributeLabel}
              {secondaryAttributeLabel && (
                <span className="mission-card__attr-secondary"> + {secondaryAttributeLabel}</span>
              )}
            </span>
            <span className="mission-card__badges">
              {typeof streak === 'number' && streak >= 1 && (
                <Badge variant="streak" icon={<img className="mission-card__streak-icon" src="/ilustraciones/racha.png" alt="" />}>
                  {streak}
                </Badge>
              )}
              <span className="mission-card__type-badge">{typeLabel}</span>
            </span>
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
