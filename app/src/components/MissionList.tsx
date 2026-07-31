import { useEffect, useState } from 'react'
import type { BossType, Difficulty } from 'rules-engine'
import {
  ATTRIBUTE_COLORS,
  ATTRIBUTE_ICONS,
  ATTRIBUTE_LABELS,
  ATTRIBUTE_RIBBON_TEXT,
  ATTRIBUTE_TINTS,
  BOSS_DIFFICULTIES,
  BOSS_DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  DIFFICULTY_STAR_COUNT,
  MISSION_TYPE_LABELS,
  attributeSummaryText,
  bossIllustration,
  dueUrgencyBadge,
} from '../types/database'
import type { MissionRow } from '../types/database'
import { BossMissionCard, MissionCard } from './ui'

function isBossDifficulty(difficulty: Difficulty): difficulty is BossType {
  return (BOSS_DIFFICULTIES as Difficulty[]).includes(difficulty)
}

/** Etiqueta corta para Boss ("Menor"/"Importante"/"Legendario", el icono de tipo ya dice "Boss")
 * o la etiqueta normal de Tarea/Rutina ("Trivial".."Épica") — mismo criterio que la vista previa. */
function difficultyLabel(difficulty: Difficulty): string {
  return isBossDifficulty(difficulty) ? BOSS_DIFFICULTY_LABELS[difficulty] : DIFFICULTY_LABELS[difficulty]
}

interface MissionListProps {
  missions: MissionRow[]
  today: string
  completedTodayMissionIds: Set<string>
  busyMissionId: string | null
  /** Misión id -> instante (epoch ms) en el que expira su margen de deshacer. */
  pendingCompletions: Record<string, number>
  onComplete: (mission: MissionRow) => void
  onUndo: (mission: MissionRow) => void
  onDelete: (mission: MissionRow) => void
}

function effectiveDueDate(mission: MissionRow, today: string): string | null {
  return mission.type === 'routine' ? today : mission.due_date
}

/** Segundos restantes hasta `deadline`, recalculados cada 200ms mientras el componente está
 * montado. `deadline: null` (misión sin margen de deshacer en curso) no arranca ningún intervalo —
 * evita un setInterval por cada tarjeta de la lista cuando solo una (como mucho) está pendiente. */
function useCountdownSeconds(deadline: number | null): number {
  const [remainingMs, setRemainingMs] = useState(() => (deadline === null ? 0 : Math.max(0, deadline - Date.now())))

  useEffect(() => {
    if (deadline === null) return
    setRemainingMs(Math.max(0, deadline - Date.now()))
    const interval = setInterval(() => {
      setRemainingMs(Math.max(0, deadline - Date.now()))
    }, 200)
    return () => clearInterval(interval)
  }, [deadline])

  return Math.ceil(remainingMs / 1000)
}

export function MissionList({
  missions,
  today,
  completedTodayMissionIds,
  busyMissionId,
  pendingCompletions,
  onComplete,
  onUndo,
  onDelete,
}: MissionListProps) {
  const visible = missions.filter(
    (mission) => mission.type === 'task' || !completedTodayMissionIds.has(mission.id),
  )

  const sorted = [...visible].sort((a, b) => {
    const dueA = effectiveDueDate(a, today)
    const dueB = effectiveDueDate(b, today)
    if (dueA === dueB) return 0
    if (dueA === null) return 1
    if (dueB === null) return -1
    return dueA.localeCompare(dueB)
  })

  if (sorted.length === 0) {
    return <p>No hay misiones activas. ¡Crea una!</p>
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {sorted.map((mission) => {
        if (mission.type === 'boss') {
          return (
            <BossMissionCard
              key={mission.id}
              name={mission.name}
              description={mission.description}
              attributeIcon={bossIllustration(mission.primary_attribute)}
              difficultyLabel={difficultyLabel(mission.difficulty)}
              difficultyColor={DIFFICULTY_COLORS[mission.difficulty]}
              attributeText={attributeSummaryText(mission)}
              resultDate={mission.due_date}
              onDelete={() => onDelete(mission)}
              busy={busyMissionId === mission.id}
            />
          )
        }

        const pendingDeadline = pendingCompletions[mission.id]
        const isPending = pendingDeadline !== undefined

        return (
          <MissionCardWithCountdown
            key={mission.id}
            mission={mission}
            today={today}
            isPending={isPending}
            pendingDeadline={pendingDeadline}
            busy={busyMissionId === mission.id}
            onComplete={() => onComplete(mission)}
            onUndo={() => onUndo(mission)}
            onDelete={() => onDelete(mission)}
          />
        )
      })}
    </ul>
  )
}

/** Envuelve MissionCard para llamar a useCountdownSeconds solo cuando hay margen de deshacer en
 * curso (el hook necesita un deadline numérico, no uno opcional). */
function MissionCardWithCountdown({
  mission,
  today,
  isPending,
  pendingDeadline,
  busy,
  onComplete,
  onUndo,
  onDelete,
}: {
  mission: MissionRow
  today: string
  isPending: boolean
  pendingDeadline: number | undefined
  busy: boolean
  onComplete: () => void
  onUndo: () => void
  onDelete: () => void
}) {
  const countdownSeconds = useCountdownSeconds(pendingDeadline ?? null)
  const urgency = mission.type === 'task' ? dueUrgencyBadge(mission.due_date, today) : null

  return (
    <MissionCard
      typeLabel={MISSION_TYPE_LABELS[mission.type]}
      attributeIcon={ATTRIBUTE_ICONS[mission.primary_attribute]}
      attributeLabel={ATTRIBUTE_LABELS[mission.primary_attribute]}
      attributeColor={ATTRIBUTE_COLORS[mission.primary_attribute]}
      attributeTextColor={ATTRIBUTE_RIBBON_TEXT[mission.primary_attribute]}
      attributeTint={ATTRIBUTE_TINTS[mission.primary_attribute]}
      secondaryAttributeLabel={mission.secondary_attribute ? ATTRIBUTE_LABELS[mission.secondary_attribute] : null}
      name={mission.name}
      description={mission.description}
      starValue={DIFFICULTY_STAR_COUNT[mission.difficulty]}
      starLabel={`Dificultad: ${DIFFICULTY_LABELS[mission.difficulty]}`}
      urgency={urgency}
      isPending={isPending}
      busy={busy}
      countdownSeconds={isPending ? countdownSeconds : undefined}
      onComplete={onComplete}
      onUndo={onUndo}
      onDelete={onDelete}
    />
  )
}
