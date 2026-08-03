import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { getErrorMessage } from '../lib/errors'
import { Button, PasswordInput } from './ui'

interface ChangePasswordFormProps {
  onSuccess: () => void
  onCancel: () => void
}

/** Reautentica con signInWithPassword antes de aceptar la contraseña nueva: es la única forma de
 * verificar la contraseña actual con la API de Supabase (no hay un endpoint "check password" que
 * no cree/renueve la sesión), y no invalida ni desloguea la sesión existente si falla. */
export function ChangePasswordForm({ onSuccess, onCancel }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const newPasswordTooShort = newPassword.length > 0 && newPassword.length < 6
  const passwordsMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword
  const canSubmit =
    currentPassword.length > 0 && newPassword.length >= 6 && confirmPassword.length > 0 && confirmPassword === newPassword

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (confirmPassword !== newPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setSubmitting(true)
    try {
      const { data: userData, error: getUserError } = await supabase.auth.getUser()
      if (getUserError) throw getUserError
      const email = userData.user?.email
      if (!email) throw new Error('No se ha podido obtener el email de la sesión actual.')

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
      if (signInError) {
        if (signInError.status === 429) {
          setError('Demasiados intentos. Prueba de nuevo en unos minutos.')
        } else {
          setError('La contraseña actual no es correcta.')
        }
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError

      onSuccess()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: 0 }}>
      <label>
        <span className="field-label">Contraseña actual</span>
        <PasswordInput
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </label>

      <label>
        <span className="field-label">Nueva contraseña</span>
        <PasswordInput
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
        {newPasswordTooShort && <p className="auth-message auth-message--error">La nueva contraseña debe tener al menos 6 caracteres.</p>}
      </label>

      <label>
        <span className="field-label">Confirmar nueva contraseña</span>
        <PasswordInput
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        {passwordsMismatch && <p className="auth-message auth-message--error">Las contraseñas no coinciden.</p>}
      </label>

      {error && <p className="auth-message auth-message--error">{error}</p>}

      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.4rem' }}>
        <Button type="submit" variant="primary" disabled={submitting || !canSubmit}>
          {submitting ? 'Cambiando...' : 'Cambiar contraseña'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
