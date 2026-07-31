import { StarIcon } from './StarIcon'

interface StarPickerProps {
  value: number
  onChange: (next: number) => void
  max?: number
}

/** Selector de estrellas interactivo (formulario): cada estrella es su propio botón — tocar la
 * 3ª estrella dispara onChange(3), que el formulario traduce a la dificultad correspondiente. */
export function StarPicker({ value, onChange, max = 5 }: StarPickerProps) {
  return (
    <span className="star-picker" role="group" aria-label="Dificultad, de 1 a 5 estrellas">
      {Array.from({ length: max }, (_, i) => {
        const starValue = i + 1
        const filled = starValue <= value
        return (
          <button
            key={starValue}
            type="button"
            className="star-picker__star"
            aria-pressed={filled}
            aria-label={`${starValue} de ${max} estrellas`}
            onClick={() => onChange(starValue)}
          >
            <StarIcon filled={filled} />
          </button>
        )
      })}
    </span>
  )
}
