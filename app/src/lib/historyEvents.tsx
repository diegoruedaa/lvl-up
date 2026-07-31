import type { ReactNode } from 'react'
import { ATTRIBUTE_LABELS } from '../types/database'
import type {
  AchievementUnlockedPayload,
  BossLostPayload,
  BossWonPayload,
  HistoryEventRow,
  ItemPurchasedPayload,
  ItemUsedPayload,
  LevelUpPayload,
  MissionCompletedPayload,
  MissionDeletedPayload,
  MissionEvadedPayload,
  MissionFailedPayload,
  RankChangedPayload,
  ShieldActivatedPayload,
  TotemActivatedPayload,
} from '../types/database'
import { localDateString } from './gameApi'

/** Icono por event_type, solo para escanear la lista más rápido (documento 15.1: sigue siendo una sección secundaria, sin pretensiones visuales). */
export const EVENT_ICONS: Record<HistoryEventRow['event_type'], string> = {
  mission_completed: '✅',
  mission_failed: '💥',
  mission_deleted: '🗑️',
  mission_evaded: '🪢',
  boss_won: '⚔️',
  boss_lost: '💀',
  item_used: '🧪',
  shield_activated: '🛡️',
  item_purchased: '🛒',
  achievement_unlocked: '🏅',
  level_up: '⬆️',
  rank_changed: '🏆',
  totem_activated: '🗿',
}

/** Color del marco del icono por event_type: verde (--color-accent) para completar/subir de
 * nivel/logro, terracota (--color-danger) para fallar/recibir daño, dorado (--color-accent-gold)
 * para compra/objeto. mission_deleted es la única acción sin recompensa ni penalización, así que
 * usa el borde neutro (--color-border) en vez de sumarse a alguno de los tres grupos anteriores. */
export const EVENT_ICON_COLORS: Record<HistoryEventRow['event_type'], string> = {
  mission_completed: 'var(--color-accent)',
  mission_failed: 'var(--color-danger)',
  mission_deleted: 'var(--color-border)',
  mission_evaded: 'var(--color-accent-gold)',
  boss_won: 'var(--color-accent)',
  boss_lost: 'var(--color-danger)',
  item_used: 'var(--color-accent-gold)',
  shield_activated: 'var(--color-accent-gold)',
  item_purchased: 'var(--color-accent-gold)',
  achievement_unlocked: 'var(--color-accent)',
  level_up: 'var(--color-accent)',
  rank_changed: 'var(--color-accent)',
  totem_activated: 'var(--color-accent-gold)',
}

function formatEventDate(occurredAt: string): string {
  return new Date(occurredAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
}

/** Envuelve en <strong> los fragmentos entre comillas de una línea ya generada por
 * formatHistoryEventLines (p.ej. el nombre de la misión/Boss/logro), sin tocar el texto en sí. */
export function renderLineWithBoldQuotes(line: string): ReactNode {
  return line.split(/("[^"]*")/g).map((part, index) => (part.startsWith('"') ? <strong key={index}>{part}</strong> : part))
}

/** Separa las líneas de un evento (formatHistoryEventLines) en título (la primera), "deltas"
 * (líneas que empiezan por + o −: XP/HP/monedas) y notas sueltas (p.ej. "Se consumió tu Mano
 * Celestial."). No reordena ni reescribe nada, solo clasifica lo que ya se genera hoy. */
export function splitEventLines(lines: string[]): { title: string; deltaLines: string[]; noteLines: string[] } {
  const [title, ...rest] = lines
  const deltaLines = rest.filter((line) => line.startsWith('+') || line.startsWith('−'))
  const noteLines = rest.filter((line) => !line.startsWith('+') && !line.startsWith('−'))
  return { title: title ?? '', deltaLines, noteLines }
}

/** Color del delta combinado de un evento: dorado para ganancias (+XP, +monedas, +HP curado),
 * terracota para HP perdido, texto secundario para monedas gastadas. Los deltas de un mismo
 * evento son siempre homogéneos (o todo ganancias, o un único −HP), así que basta mirar el primero. */
export function deltaColor(deltaLines: string[]): string | undefined {
  const first = deltaLines[0]
  if (!first) return undefined
  if (first.startsWith('+')) return 'var(--color-accent-gold)'
  if (first.includes('HP')) return 'var(--color-danger)'
  return 'var(--color-text-secondary)'
}

/** Días entre dos fechas locales YYYY-MM-DD (b − a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

export interface HistoryDayGroup {
  dateStr: string
  label: string
  events: HistoryEventRow[]
}

/** Agrupa los eventos (ya ordenados del más al menos reciente) por "día local" del usuario —
 * mismo criterio que el resto de la app (localDateString/todayLocalDateString, lib/gameApi.ts).
 * "HOY"/"AYER" para los dos días más recientes, y "D de mes" (formatEventDate) para el resto. */
export function groupEventsByDay(events: HistoryEventRow[], todayStr: string): HistoryDayGroup[] {
  const groups: HistoryDayGroup[] = []
  for (const event of events) {
    const dateStr = localDateString(new Date(event.occurred_at))
    const lastGroup = groups[groups.length - 1]
    if (lastGroup && lastGroup.dateStr === dateStr) {
      lastGroup.events.push(event)
      continue
    }
    const daysAgo = daysBetween(dateStr, todayStr)
    const label = daysAgo === 0 ? 'HOY' : daysAgo === 1 ? 'AYER' : formatEventDate(event.occurred_at)
    groups.push({ dateStr, label, events: [event] })
  }
  return groups
}

/**
 * xp_secondary ya NO es fraccional: xpForMissionCompletion (rules-engine/xp.ts)
 * redondea el 25% de XP secundaria hacia abajo con Math.floor antes de
 * aplicarlo (cambio de diseño confirmado por el usuario, distinto de la
 * fracción exacta del ejemplo del documento funcional original — no es un
 * bug a "corregir" de vuelta). El toFixed(2) que sigue aquí es solo una red
 * de seguridad de formato, no una necesidad real desde este cambio.
 */
function formatXp(amount: number): string {
  return Number(amount.toFixed(2)).toString()
}

/** Una o varias líneas legibles por evento (documento 15.2, ejemplos de "24 de julio"). */
export function formatHistoryEventLines(event: HistoryEventRow): string[] {
  switch (event.event_type) {
    case 'mission_completed': {
      const p = event.payload as unknown as MissionCompletedPayload
      const lines = [
        `Completaste "${p.mission_name}".`,
        `+${formatXp(p.xp_general)} XP general.`,
        `+${formatXp(p.xp_primary)} XP de ${ATTRIBUTE_LABELS[p.primary_attribute]}.`,
      ]
      if (p.secondary_attribute && p.xp_secondary !== null) {
        lines.push(`+${formatXp(p.xp_secondary)} XP de ${ATTRIBUTE_LABELS[p.secondary_attribute]}.`)
      }
      return lines
    }
    case 'mission_failed': {
      const p = event.payload as unknown as MissionFailedPayload
      return [`Fallaste "${p.mission_name}".`, `−${p.damage} HP.`]
    }
    case 'mission_deleted': {
      const p = event.payload as unknown as MissionDeletedPayload
      return [`Eliminaste "${p.mission_name}".`]
    }
    case 'mission_evaded': {
      const p = event.payload as unknown as MissionEvadedPayload
      return [`Evitaste "${p.mission_name}" con la Cuerda Huida.`]
    }
    case 'boss_won': {
      const p = event.payload as unknown as BossWonPayload
      const lines = [
        `Venciste al Boss "${p.boss_name}".`,
        `+${p.coins_gained} monedas.`,
        `+${formatXp(p.xp_general)} XP general.`,
        `+${formatXp(p.xp_primary)} XP de ${ATTRIBUTE_LABELS[p.primary_attribute]}.`,
      ]
      if (p.secondary_attribute && p.xp_secondary !== null) {
        lines.push(`+${formatXp(p.xp_secondary)} XP de ${ATTRIBUTE_LABELS[p.secondary_attribute]}.`)
      }
      if (p.celestial_hand_consumed) lines.push('Se consumió tu Mano Celestial.')
      return lines
    }
    case 'boss_lost': {
      const p = event.payload as unknown as BossLostPayload
      const lines = [`Perdiste contra el Boss "${p.boss_name}".`, `−${p.damage} HP.`]
      if (p.celestial_hand_consumed) lines.push('Se consumió tu Mano Celestial.')
      return lines
    }
    case 'item_used': {
      const p = event.payload as unknown as ItemUsedPayload
      return p.heal_amount !== null ? [`Usaste ${p.item_name}.`, `+${p.heal_amount} HP.`] : [`Activaste ${p.item_name}.`]
    }
    case 'shield_activated': {
      const p = event.payload as unknown as ShieldActivatedPayload
      return [`Activaste ${p.item_name}.`]
    }
    case 'item_purchased': {
      const p = event.payload as unknown as ItemPurchasedPayload
      return [`Compraste ${p.item_name} por ${p.price} monedas.`]
    }
    case 'achievement_unlocked': {
      const p = event.payload as unknown as AchievementUnlockedPayload
      return [`Desbloqueaste el logro "${p.achievement_name}".`]
    }
    case 'level_up': {
      const p = event.payload as unknown as LevelUpPayload
      return p.levels_gained > 1
        ? [`¡Subiste del nivel ${p.from_level} al ${p.to_level}!`]
        : [`¡Subiste al nivel ${p.to_level}!`]
    }
    case 'rank_changed': {
      const p = event.payload as unknown as RankChangedPayload
      return [`¡Alcanzaste el rango ${p.to_rank}!`]
    }
    case 'totem_activated': {
      const p = event.payload as unknown as TotemActivatedPayload
      if (!p.source_name) return ['El Tótem de la Inmortalidad te salvó de la muerte.']
      return p.context === 'boss_defeat'
        ? [`El Tótem de la Inmortalidad te salvó al perder contra el Boss "${p.source_name}".`]
        : [`El Tótem de la Inmortalidad te salvó al fallar "${p.source_name}".`]
    }
    default:
      return []
  }
}
