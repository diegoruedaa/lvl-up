import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import type { Attribute, BossType, Difficulty } from 'rules-engine'
import {
  ATTRIBUTES,
  ATTRIBUTE_COLORS,
  ATTRIBUTE_ICONS,
  ATTRIBUTE_LABELS,
  ATTRIBUTE_RIBBON_TEXT,
  BOSS_DIFFICULTIES,
  BOSS_DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  DIFFICULTY_STAR_COUNT,
  MISSION_DIFFICULTIES,
  MISSION_TYPE_LABELS,
} from '../types/database'
import type { MissionRow, MissionType } from '../types/database'
import { createMission } from '../lib/gameApi'
import { getErrorMessage } from '../lib/errors'
import { Button, StarPicker } from './ui'

interface MissionFormProps {
  adventureRunId: string
  onCreated: (mission: MissionRow) => void
}

function isBossDifficulty(difficulty: Difficulty): difficulty is BossType {
  return (BOSS_DIFFICULTIES as Difficulty[]).includes(difficulty)
}

export function MissionForm({ adventureRunId, onCreated }: MissionFormProps) {
  const [type, setType] = useState<MissionType>('task')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [primaryAttribute, setPrimaryAttribute] = useState<Attribute>('vitality')
  const [secondaryAttribute, setSecondaryAttribute] = useState<Attribute | ''>('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function handlePrimaryChange(next: Attribute) {
    setPrimaryAttribute(next)
    if (secondaryAttribute === next) setSecondaryAttribute('')
  }

  // Al cambiar de tipo, la dificultad seleccionada debe seguir siendo válida
  // para el nuevo tipo: mission_boss_difficulty_check (010_boss.sql) exige
  // boss_* si y solo si type = 'boss'.
  function handleTypeChange(next: MissionType) {
    setType(next)
    if (next === 'boss' && !isBossDifficulty(difficulty)) {
      setDifficulty(BOSS_DIFFICULTIES[0])
    } else if (next !== 'boss' && isBossDifficulty(difficulty)) {
      setDifficulty('easy')
    }
  }

  const usesDueDate = type === 'task' || type === 'boss'
  const isBoss = type === 'boss'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (usesDueDate && !dueDate) {
      setError(type === 'boss' ? 'Los Bosses necesitan una fecha de resultado.' : 'Las tareas necesitan una fecha límite.')
      return
    }

    setSubmitting(true)
    try {
      const mission = await createMission({
        adventureRunId,
        type,
        name,
        description: description.trim() === '' ? null : description.trim(),
        difficulty,
        primaryAttribute,
        secondaryAttribute: secondaryAttribute === '' ? null : secondaryAttribute,
        dueDate: usesDueDate ? dueDate : null,
        dueTime: usesDueDate && dueTime !== '' ? dueTime : null,
      })
      onCreated(mission)
      setName('')
      setDescription('')
      setDueDate('')
      setDueTime('')
      setSecondaryAttribute('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <h3>Nueva misión</h3>

      <label>
        Tipo
        <div className="tab-row" style={{ overflow: 'visible' }}>
          {(['task', 'routine', 'boss'] as MissionType[]).map((t) => (
            <Button key={t} type="button" variant={type === t ? 'primary' : 'secondary'} onClick={() => handleTypeChange(t)}>
              {MISSION_TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
      </label>

      <label>
        <span className="field-label">Nombre</span>
        <input className="field-input" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <label>
        <span className="field-label">Descripción (opcional)</span>
        <textarea className="field-input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <label>
        Dificultad
        {isBoss ? (
          <div className="difficulty-picker">
            {BOSS_DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                className={`difficulty-chip${difficulty === d ? ' difficulty-chip--selected' : ''}`}
                style={{ '--difficulty-color': DIFFICULTY_COLORS[d] } as CSSProperties}
                onClick={() => setDifficulty(d)}
                aria-pressed={difficulty === d}
              >
                {BOSS_DIFFICULTY_LABELS[d]}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <StarPicker value={DIFFICULTY_STAR_COUNT[difficulty]} onChange={(n) => setDifficulty(MISSION_DIFFICULTIES[n - 1])} />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{DIFFICULTY_LABELS[difficulty]}</span>
          </div>
        )}
      </label>

      <label>
        Atributo principal
        <div className="attribute-picker">
          {ATTRIBUTES.map((attr) => (
            <button
              key={attr}
              type="button"
              className={`attribute-chip${primaryAttribute === attr ? ' attribute-chip--selected' : ''}`}
              style={{ '--attr-color': ATTRIBUTE_COLORS[attr], '--attr-fg': ATTRIBUTE_RIBBON_TEXT[attr] } as CSSProperties}
              onClick={() => handlePrimaryChange(attr)}
              aria-pressed={primaryAttribute === attr}
            >
              <img className="attribute-chip__icon" src={ATTRIBUTE_ICONS[attr]} alt="" aria-hidden="true" />
              {ATTRIBUTE_LABELS[attr]}
            </button>
          ))}
        </div>
      </label>

      <label>
        Atributo secundario (opcional)
        <div className="attribute-picker">
          <button
            type="button"
            className={`attribute-chip${secondaryAttribute === '' ? ' attribute-chip--selected' : ''}`}
            onClick={() => setSecondaryAttribute('')}
            aria-pressed={secondaryAttribute === ''}
          >
            Ninguno
          </button>
          {ATTRIBUTES.map((attr) => {
            const isPrimary = attr === primaryAttribute
            const isSelected = secondaryAttribute === attr
            return (
              <button
                key={attr}
                type="button"
                className={`attribute-chip${isSelected ? ' attribute-chip--selected' : ''}`}
                style={{ '--attr-color': ATTRIBUTE_COLORS[attr], '--attr-fg': ATTRIBUTE_RIBBON_TEXT[attr] } as CSSProperties}
                onClick={() => setSecondaryAttribute(isSelected ? '' : attr)}
                disabled={isPrimary}
                aria-pressed={isSelected}
              >
                <img className="attribute-chip__icon" src={ATTRIBUTE_ICONS[attr]} alt="" aria-hidden="true" />
                {ATTRIBUTE_LABELS[attr]}
              </button>
            )
          })}
        </div>
      </label>

      {usesDueDate && (
        <>
          <label>
            <span className="field-label">{type === 'boss' ? 'Fecha de resultado' : 'Fecha límite'}</span>
            <input className="field-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </label>
          {type === 'task' && (
            <label>
              <span className="field-label">Hora límite (opcional, por defecto 23:59)</span>
              <input className="field-input" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </label>
          )}
        </>
      )}

      {type === 'routine' && (
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          Frecuencia: todos los días.
        </p>
      )}

      <Button type="submit" variant="primary" disabled={submitting}>
        Anotar misión
      </Button>

      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
    </form>
  )
}
