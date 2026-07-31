import { useState } from 'react'
import { getErrorMessage } from '../lib/errors'
import { setPlayerCharacter } from '../lib/gameApi'
import { playerIllustration } from '../types/database'
import type { PlayerCharacter } from '../types/database'
import { ScreenHeader } from './ui'

interface CharacterSelectOverlayProps {
  userId: string
  /** 'onboarding': primera elección (aún no hay a qué volver, sin botón de volver).
   * 'change': ya hay un personaje elegido, se puede cancelar sin cambiar nada. */
  mode: 'onboarding' | 'change'
  onSelected: (character: PlayerCharacter) => void
  onClose: () => void
}

const OPTIONS: { value: PlayerCharacter; label: string }[] = [
  { value: 'chico', label: 'Chico' },
  { value: 'chica', label: 'Chica' },
]

/** Selector de personaje jugable (backend/022_player_character.sql, documento de diseño 2026-07-29):
 * mismo componente para la elección forzosa la primera vez (mode='onboarding', sin salida) y para el
 * cambio voluntario posterior desde el botón del Dashboard (mode='change', con "Volver"). */
export function CharacterSelectOverlay({ userId, mode, onSelected, onClose }: CharacterSelectOverlayProps) {
  const [saving, setSaving] = useState<PlayerCharacter | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handlePick(character: PlayerCharacter) {
    if (saving) return
    setSaving(character)
    setError(null)
    try {
      await setPlayerCharacter(userId, character)
      onSelected(character)
    } catch (err) {
      setError(getErrorMessage(err))
      setSaving(null)
    }
  }

  return (
    <div className="character-select">
      {mode === 'change' ? (
        <ScreenHeader title="Elige tu personaje" onBack={onClose} />
      ) : (
        <h2 className="character-select__title">Elige tu personaje</h2>
      )}

      <p className="character-select__hint">Podrás cambiarlo más adelante.</p>

      {error && <p className="character-select__error">{error}</p>}

      <div className="character-select__options">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="character-select__option"
            onClick={() => handlePick(option.value)}
            disabled={saving !== null}
          >
            <img src={playerIllustration(option.value)} alt={option.label} className="character-select__image" />
            <span className="character-select__label">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
