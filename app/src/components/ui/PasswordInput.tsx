import { useId, useState } from 'react'
import type { InputHTMLAttributes } from 'react'

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/** Campo de contraseña con botón de mostrar/ocultar (ojo): alterna type="password"/"text" en
 * lugar de depender de un icono de librería externa, ya que el proyecto no tiene ninguna. */
export function PasswordInput({ className, id, ...rest }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className="password-input">
      <input
        id={inputId}
        className={`field-input password-input__field${className ? ` ${className}` : ''}`}
        type={visible ? 'text' : 'password'}
        {...rest}
      />
      <button
        type="button"
        className="password-input__toggle"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-controls={inputId}
      >
        {visible ? '🙈' : '👁️'}
      </button>
    </div>
  )
}
