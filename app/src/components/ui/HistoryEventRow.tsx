import type { ReactNode } from 'react'

interface HistoryEventRowProps {
  icon: string
  color: string
  title: ReactNode
  delta?: string
  deltaColor?: string
  notes?: string[]
}

/** Fila de una entrada del Historial: marco cuadrado de icono (borde en el color del tipo de
 * evento) + texto principal + "delta" opcional resaltado (XP/HP/monedas) + notas adicionales
 * (p.ej. "Se consumió tu Mano Celestial."). Sin el patrón Card pesado — la separación entre filas
 * de un mismo día la pone el contenedor (borde inferior fino, --color-border). */
export function HistoryEventRow({ icon, color, title, delta, deltaColor, notes }: HistoryEventRowProps) {
  return (
    <li className="history-event">
      <span className="history-event__frame" style={{ borderColor: color }}>
        <span className="history-event__icon" aria-hidden="true">
          {icon}
        </span>
      </span>
      <div className="history-event__body">
        <p className="history-event__title">{title}</p>
        {delta && (
          <p className="history-event__delta" style={{ color: deltaColor }}>
            {delta}
          </p>
        )}
        {notes?.map((note, index) => (
          <p key={index} className="history-event__note">
            {note}
          </p>
        ))}
      </div>
    </li>
  )
}
