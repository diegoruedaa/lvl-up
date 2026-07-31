import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

/** Botón base con altura táctil mínima (~44px) y las tres variantes que necesita la app: primary (verde musgo, acción principal), secondary (neutro, Volver/Cancelar), danger (terracota, Derrota/borrar). */
export function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  return <button className={`btn btn--${variant}${className ? ` ${className}` : ''}`} {...rest} />
}
