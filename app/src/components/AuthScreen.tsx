import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { getErrorMessage } from '../lib/errors'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

type Mode = 'signIn' | 'signUp'

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function selectMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    try {
      if (mode === 'signIn') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        if (data.session === null) {
          setInfo('Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión.')
        }
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="app-shell">
      <div className="auth-brand">
        <h1 className="auth-brand-title">LVL UP</h1>
        <div className="auth-brand-rule" />
        <p className="auth-brand-subtitle">Convierte tus hábitos en aventura</p>
      </div>

      <Card className="auth-card">
        <div className="tab-row auth-tabs">
          <Button type="button" variant={mode === 'signIn' ? 'primary' : 'secondary'} onClick={() => selectMode('signIn')}>
            Iniciar sesión
          </Button>
          <Button type="button" variant={mode === 'signUp' ? 'primary' : 'secondary'} onClick={() => selectMode('signUp')}>
            Crear cuenta
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            <span className="field-label">Email</span>
            <input
              className="field-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoComplete="email"
            />
          </label>

          <label>
            <span className="field-label">Contraseña</span>
            <input
              className="field-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            />
          </label>

          {error && <p className="auth-message auth-message--error">{error}</p>}
          {info && <p className="auth-message auth-message--info">{info}</p>}

          <Button type="submit" variant="primary" disabled={submitting} className="auth-submit">
            {mode === 'signIn' ? 'Entrar a la aventura' : 'Crear cuenta'}
          </Button>
        </form>
      </Card>
    </main>
  )
}
