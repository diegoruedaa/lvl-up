interface AchievementRowProps {
  icon: string
  name: string
  description: string
  unlocked: boolean
  /** Línea opcional bajo la descripción (p.ej. fecha de consecución) — más tenue que la descripción. */
  meta?: string
}

/** Fila tipo "advancement" de Minecraft para el listado de Logros: ranura de icono cuadrada +
 * título + descripción sobre fondo oscuro (--color-bg-dark), en vez del fondo pergamino claro del
 * resto de la app — esta pantalla es una "vitrina de trofeos" con su propio contraste. Conseguido =
 * ranura/título en dorado vivo; bloqueado = fila atenuada al 40% con icono en escala de grises. */
export function AchievementRow({ icon, name, description, unlocked, meta }: AchievementRowProps) {
  return (
    <li className={`achievement-row${unlocked ? '' : ' achievement-row--locked'}`}>
      <span className={`achievement-row__frame${unlocked ? ' achievement-row__frame--unlocked' : ''}`}>
        <span className="achievement-row__icon" aria-hidden="true">
          {icon}
        </span>
      </span>
      <div className="achievement-row__body">
        <strong className={`achievement-row__title${unlocked ? ' achievement-row__title--unlocked' : ''}`}>
          {name}
        </strong>
        <p className="achievement-row__description">{description}</p>
        {meta && <p className="achievement-row__meta">{meta}</p>}
      </div>
    </li>
  )
}
