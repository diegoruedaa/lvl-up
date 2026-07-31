import { useState } from 'react'
import { MAX_ATTRIBUTE_LEVEL } from 'rules-engine'
import type { Attribute, Difficulty } from 'rules-engine'
import { ATTRIBUTES, ATTRIBUTE_LABELS, DIFFICULTY_LABELS } from '../types/database'
import { todayLocalDateString } from '../lib/gameApi'
import {
  deltaColor,
  formatHistoryEventLines,
  groupEventsByDay,
  renderLineWithBoldQuotes,
  splitEventLines,
  EVENT_ICON_COLORS,
  EVENT_ICONS,
  daysBetween,
} from '../lib/historyEvents'
import { Button, HistoryEventRow as HistoryEventRowUi, ScreenHeader } from './ui'
import type {
  AttributeProgressRow,
  BossLostPayload,
  CharacterRow,
  HistoryEventRow,
  ItemPurchasedPayload,
  ItemUsedPayload,
  MissionCompletedPayload,
  MissionFailedPayload,
} from '../types/database'

interface HistoryScreenProps {
  historyEvents: HistoryEventRow[]
  character: CharacterRow
  attributeProgress: AttributeProgressRow[]
  onClose: () => void
}

interface Statistics {
  missionsCompleted: number
  missionsFailed: number
  missionsDeleted: number
  missionsEvaded: number
  /** null si todavía no hay ninguna misión completada ni fallada (sin datos suficientes para un porcentaje). */
  successRate: number | null
  completedByDifficulty: Partial<Record<Difficulty, number>>
  completedByAttribute: Partial<Record<Attribute, number>>
  bossesWon: number
  bossesLost: number
  hpLost: number
  hpRecovered: number
  potionsUsed: number
  shieldsUsed: number
  escapeRopesUsed: number
  celestialHandsUsed: number
  totemsActivated: number
  coinsEarned: number
  coinsSpent: number
  purchasesMade: number
  bestDailyStreakDays: number
}

/** "Mejor periodo completando una misión diaria" (documento 15.3): racha más larga de días consecutivos completados de una misma rutina, máximo entre todas las rutinas de la aventura activa. */
function longestDailyStreakDays(events: HistoryEventRow[]): number {
  const datesByMission = new Map<string, Set<string>>()

  for (const event of events) {
    if (event.event_type !== 'mission_completed') continue
    const p = event.payload as unknown as MissionCompletedPayload
    if (p.mission_type !== 'routine' || !p.occurrence_date) continue

    const dates = datesByMission.get(p.mission_id) ?? new Set<string>()
    dates.add(p.occurrence_date)
    datesByMission.set(p.mission_id, dates)
  }

  let best = 0
  for (const dates of datesByMission.values()) {
    const sorted = [...dates].sort()
    let current = 0
    let previous: string | null = null
    for (const date of sorted) {
      current = previous !== null && daysBetween(previous, date) === 1 ? current + 1 : 1
      best = Math.max(best, current)
      previous = date
    }
  }
  return best
}

/**
 * Agrega las 21 estadísticas de 15.3 sobre los history_event ya cargados
 * para el historial (sin otra llamada a Supabase). "Monedas obtenidas" usa
 * character.coins_earned_total directamente (ya es la fuente de verdad,
 * backend/015_achievement_counters.sql) en vez de sumar sobre eventos, para
 * no duplicar esa cuenta.
 */
function computeStatistics(events: HistoryEventRow[], character: CharacterRow): Statistics {
  let missionsCompleted = 0
  let missionsFailed = 0
  let missionsDeleted = 0
  let missionsEvaded = 0
  const completedByDifficulty: Partial<Record<Difficulty, number>> = {}
  const completedByAttribute: Partial<Record<Attribute, number>> = {}
  let bossesWon = 0
  let bossesLost = 0
  let hpLost = 0
  let hpRecovered = 0
  let potionsUsed = 0
  let shieldsUsed = 0
  let celestialHandsUsed = 0
  let totemsActivated = 0
  let coinsSpent = 0
  let purchasesMade = 0

  for (const event of events) {
    switch (event.event_type) {
      case 'mission_completed': {
        missionsCompleted += 1
        const p = event.payload as unknown as MissionCompletedPayload
        completedByDifficulty[p.difficulty] = (completedByDifficulty[p.difficulty] ?? 0) + 1
        completedByAttribute[p.primary_attribute] = (completedByAttribute[p.primary_attribute] ?? 0) + 1
        break
      }
      case 'mission_failed': {
        missionsFailed += 1
        hpLost += (event.payload as unknown as MissionFailedPayload).damage
        break
      }
      case 'mission_deleted':
        missionsDeleted += 1
        break
      case 'mission_evaded':
        missionsEvaded += 1
        break
      case 'boss_won':
        bossesWon += 1
        break
      case 'boss_lost':
        bossesLost += 1
        hpLost += (event.payload as unknown as BossLostPayload).damage
        break
      case 'item_used': {
        const p = event.payload as unknown as ItemUsedPayload
        if (p.item_id === 'celestial_hand') celestialHandsUsed += 1
        else if (p.heal_amount !== null) potionsUsed += 1
        if (p.heal_amount !== null) hpRecovered += p.heal_amount
        break
      }
      case 'shield_activated':
        shieldsUsed += 1
        break
      case 'item_purchased': {
        purchasesMade += 1
        coinsSpent += (event.payload as unknown as ItemPurchasedPayload).price
        break
      }
      case 'totem_activated':
        totemsActivated += 1
        break
      default:
        break
    }
  }

  const successRate =
    missionsCompleted + missionsFailed > 0
      ? Math.round((missionsCompleted / (missionsCompleted + missionsFailed)) * 100)
      : null

  return {
    missionsCompleted,
    missionsFailed,
    missionsDeleted,
    missionsEvaded,
    successRate,
    completedByDifficulty,
    completedByAttribute,
    bossesWon,
    bossesLost,
    hpLost,
    hpRecovered,
    potionsUsed,
    shieldsUsed,
    escapeRopesUsed: missionsEvaded,
    celestialHandsUsed,
    totemsActivated,
    coinsEarned: character.coins_earned_total,
    coinsSpent,
    purchasesMade,
    bestDailyStreakDays: longestDailyStreakDays(events),
  }
}

/** Fila simple "etiqueta: valor" para la sección de estadísticas. */
export function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.35rem 0' }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

/** Encabezado de sección dentro de Estadísticas (p.ej. "Completadas por dificultad"): --font-title
 * y un tamaño mayor al de las StatRow que agrupa (--font-body a --text-base), para que se lea como
 * jerarquía superior en vez de una nota al margen. */
export function StatSectionHeader({ children }: { children: string }) {
  return (
    <h4
      style={{
        margin: '0.85rem 0 0.3rem',
        fontFamily: 'var(--font-title)',
        fontSize: 'var(--text-lg)',
        fontWeight: 400,
        color: 'var(--color-text)',
      }}
    >
      {children}
    </h4>
  )
}

const DIFFICULTIES_FOR_STATS: Difficulty[] = ['trivial', 'easy', 'medium', 'hard', 'epic']

type HistoryTab = 'historial' | 'estadisticas'

export function HistoryScreen({ historyEvents, character, attributeProgress, onClose }: HistoryScreenProps) {
  const [activeTab, setActiveTab] = useState<HistoryTab>('historial')
  const stats = computeStatistics(historyEvents, character)
  const byAttribute = new Map(attributeProgress.map((row) => [row.attribute, row]))
  const dayGroups = groupEventsByDay(historyEvents, todayLocalDateString())

  return (
    <div>
      <ScreenHeader title="Historial y estadísticas" onBack={onClose} />

      <div className="tab-row" style={{ margin: '0.75rem 0' }}>
        <Button variant={activeTab === 'historial' ? 'primary' : 'secondary'} onClick={() => setActiveTab('historial')}>
          Historial
        </Button>
        <Button
          variant={activeTab === 'estadisticas' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('estadisticas')}
        >
          Estadísticas
        </Button>
      </div>

      {activeTab === 'historial' ? (
        <section>
          {historyEvents.length === 0 ? (
            <p style={{ fontSize: '0.9em', opacity: 0.75 }}>Todavía no ha pasado nada en esta aventura.</p>
          ) : (
            dayGroups.map((group) => (
              <div key={group.dateStr} className="history-day-group">
                <span className="history-day-group__label">{group.label}</span>
                <ul className="history-list">
                  {group.events.map((event) => {
                    const { title, deltaLines, noteLines } = splitEventLines(formatHistoryEventLines(event))
                    return (
                      <HistoryEventRowUi
                        key={event.id}
                        icon={EVENT_ICONS[event.event_type]}
                        color={EVENT_ICON_COLORS[event.event_type]}
                        title={renderLineWithBoldQuotes(title)}
                        delta={deltaLines.length > 0 ? deltaLines.join(' · ') : undefined}
                        deltaColor={deltaColor(deltaLines)}
                        notes={noteLines.length > 0 ? noteLines : undefined}
                      />
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </section>
      ) : (
        <section>
          <StatSectionHeader>General</StatSectionHeader>
          <StatRow label="Misiones completadas" value={stats.missionsCompleted} />
          <StatRow label="Misiones falladas" value={stats.missionsFailed} />
          <StatRow label="Misiones eliminadas" value={stats.missionsDeleted} />
          <StatRow label="Misiones evitadas" value={stats.missionsEvaded} />
          <StatRow label="Porcentaje de éxito" value={stats.successRate !== null ? `${stats.successRate}%` : '—'} />

          <StatSectionHeader>Completadas por dificultad</StatSectionHeader>
          {DIFFICULTIES_FOR_STATS.map((difficulty) => (
            <StatRow
              key={difficulty}
              label={DIFFICULTY_LABELS[difficulty]}
              value={stats.completedByDifficulty[difficulty] ?? 0}
            />
          ))}

          <StatSectionHeader>Completadas por atributo</StatSectionHeader>
          {ATTRIBUTES.map((attribute) => (
            <StatRow
              key={attribute}
              label={ATTRIBUTE_LABELS[attribute]}
              value={stats.completedByAttribute[attribute] ?? 0}
            />
          ))}

          <StatSectionHeader>Otras estadísticas</StatSectionHeader>
          <StatRow label="Bosses ganados" value={stats.bossesWon} />
          <StatRow label="Bosses perdidos" value={stats.bossesLost} />
          <StatRow label="HP perdido" value={stats.hpLost} />
          <StatRow label="HP recuperado" value={stats.hpRecovered} />
          <StatRow label="Pociones utilizadas" value={stats.potionsUsed} />
          <StatRow label="Escudos utilizados" value={stats.shieldsUsed} />
          <StatRow label="Cuerdas Huida utilizadas" value={stats.escapeRopesUsed} />
          <StatRow label="Manos Celestiales utilizadas" value={stats.celestialHandsUsed} />
          <StatRow label="Tótems activados" value={stats.totemsActivated} />
          <StatRow label="Monedas obtenidas" value={stats.coinsEarned} />
          <StatRow label="Monedas gastadas" value={stats.coinsSpent} />
          <StatRow label="Compras realizadas" value={stats.purchasesMade} />
          <StatRow
            label="Mejor periodo completando una misión diaria"
            value={stats.bestDailyStreakDays > 0 ? `${stats.bestDailyStreakDays} días` : '—'}
          />

          <StatSectionHeader>Nivel actual de cada atributo</StatSectionHeader>
          {ATTRIBUTES.map((attribute) => {
            const row = byAttribute.get(attribute)
            return (
              <StatRow
                key={attribute}
                label={ATTRIBUTE_LABELS[attribute]}
                value={row ? (row.level >= MAX_ATTRIBUTE_LEVEL ? `${row.level} (máx.)` : row.level) : '—'}
              />
            )
          })}
          <StatRow label="Nivel general actual" value={character.level} />
        </section>
      )}
    </div>
  )
}
