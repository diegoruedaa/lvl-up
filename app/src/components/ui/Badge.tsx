import type { ReactNode } from 'react'

export type BadgeVariant = 'neutral' | 'success' | 'locked' | 'gold' | 'danger'

interface BadgeProps {
  variant?: BadgeVariant
  icon?: ReactNode
  children: ReactNode
}

/** Contenedor consistente para icono + texto corto: reemplaza los emoji sueltos (✅, 🔒, rareza de objetos) que hoy varían de tamaño en cada pantalla. */
export function Badge({ variant = 'neutral', icon, children }: BadgeProps) {
  return (
    <span className={`badge badge--${variant}`}>
      {icon}
      {children}
    </span>
  )
}
