import type { CSSProperties, ReactNode } from 'react'

export type CardVariant = 'default' | 'highlighted' | 'dimmed'

interface CardProps {
  variant?: CardVariant
  children: ReactNode
  style?: CSSProperties
  className?: string
}

/** Tarjeta base: reemplaza el `border: '1px solid currentColor', borderRadius: '8px', padding: '0.75rem'` repetido en 8 pantallas. "highlighted" = actual/desbloqueado (borde dorado), "dimmed" = bloqueado/no conseguido. */
export function Card({ variant = 'default', children, style, className }: CardProps) {
  const variantClass = variant === 'default' ? '' : ` card--${variant}`
  return (
    <div className={`card${variantClass}${className ? ` ${className}` : ''}`} style={style}>
      {children}
    </div>
  )
}
