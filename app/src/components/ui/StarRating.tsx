import { StarIcon } from './StarIcon'

interface StarRatingProps {
  value: number
  label: string
  max?: number
}

/** Fila de estrellas de solo lectura (dificultad de Tarea/Rutina en la tarjeta de misión):
 * dorada por nivel alcanzado, solo contorno del color de borde para el resto de la escala. */
export function StarRating({ value, label, max = 5 }: StarRatingProps) {
  return (
    <span className="star-rating" role="img" aria-label={label}>
      {Array.from({ length: max }, (_, i) => (
        <StarIcon key={i} filled={i < value} />
      ))}
    </span>
  )
}
