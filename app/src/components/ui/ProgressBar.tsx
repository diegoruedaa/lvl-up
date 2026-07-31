interface ProgressBarProps {
  current: number
  max: number
  /** Color de relleno; por defecto verde musgo. Pásalo explícitamente para distinguir HP de XP/atributos, o para el rojo terracota de HP bajo. */
  color?: string
}

/** Sustituye las barras de HP/XP/atributos duplicadas inline en HpBar (Dashboard), AttributesScreen y TutorialOverlay. El track usa --color-border en vez del rgba(128,128,128,0.3) que tenían las tres copias. */
export function ProgressBar({ current, max, color = 'var(--color-accent)' }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100))
  return (
    <div className="progress-bar-track">
      <div className="progress-bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}
