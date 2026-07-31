import { ITEM_CATALOG, RANKS } from './constants.js'
import type {
  AchievementCounters,
  Attribute,
  AttributeLevelState,
  CharacterState,
  InventoryQuantities,
  ItemId,
} from './types.js'

/** IDs de logro (ACHIEVEMENT_CATALOG) de "nivel y rangos" que dependen de cruzar un rango, indexados por nombre de rango. Novato no tiene logro asociado (es el rango inicial). */
const RANK_ACHIEVEMENT_ID_BY_RANK_NAME: Readonly<Record<string, string>> = {
  Aventurero: 'rank_adventurer',
  Guerrero: 'rank_warrior',
  Élite: 'rank_elite',
  Maestro: 'rank_master',
  Leyenda: 'rank_legend',
  Héroe: 'rank_hero',
}

const ATTRIBUTE_MILESTONES = [10, 25, 50] as const

/** IDs de logro de atributos (ACHIEVEMENT_CATALOG), indexados por atributo y nivel hito. */
const ATTRIBUTE_MILESTONE_ACHIEVEMENT_IDS: Readonly<Record<Attribute, Readonly<Record<10 | 25 | 50, string>>>> = {
  vitality: { 10: 'attribute_vitality_10', 25: 'attribute_vitality_25', 50: 'attribute_vitality_50' },
  intellect: { 10: 'attribute_intellect_10', 25: 'attribute_intellect_25', 50: 'attribute_intellect_50' },
  discipline: { 10: 'attribute_discipline_10', 25: 'attribute_discipline_25', 50: 'attribute_discipline_50' },
  relations: { 10: 'attribute_relations_10', 25: 'attribute_relations_25', 50: 'attribute_relations_50' },
  adventure: { 10: 'attribute_adventure_10', 25: 'attribute_adventure_25', 50: 'attribute_adventure_50' },
  fortune: { 10: 'attribute_fortune_10', 25: 'attribute_fortune_25', 50: 'attribute_fortune_50' },
}

const ALL_ATTRIBUTES: readonly Attribute[] = ['vitality', 'intellect', 'discipline', 'relations', 'adventure', 'fortune']

const ALL_ITEM_IDS = Object.keys(ITEM_CATALOG) as ItemId[]

const ZERO_COUNTERS: AchievementCounters = {
  missionsCompletedCount: 0,
  bossesWonCount: 0,
  potionsUsedCount: 0,
  marketPurchasesCount: 0,
  coinsEarnedTotal: 0,
}

/** [umbral, id de logro] por contador acumulado, en orden ascendente (documento 14.3, 14.5, 14.9, 14.10). */
const MISSION_COMPLETED_COUNT_THRESHOLDS: readonly (readonly [number, string])[] = [
  [1, 'mission_first'],
  [10, 'mission_10'],
  [50, 'mission_50'],
  [100, 'mission_100'],
  [250, 'mission_250'],
  [500, 'mission_500'],
  [1000, 'mission_1000'],
]

const BOSS_WON_COUNT_THRESHOLDS: readonly (readonly [number, string])[] = [
  [1, 'boss_first_win'],
  [5, 'boss_5_wins'],
  [10, 'boss_10_wins'],
  [25, 'boss_25_wins'],
  [50, 'boss_50_wins'],
]

const POTIONS_USED_COUNT_THRESHOLDS: readonly (readonly [number, string])[] = [[10, 'potions_used_10']]

const MARKET_PURCHASES_COUNT_THRESHOLDS: readonly (readonly [number, string])[] = [
  [1, 'first_purchase'],
  [25, 'market_25_purchases'],
]

const COINS_EARNED_TOTAL_THRESHOLDS: readonly (readonly [number, string])[] = [
  [50, 'coins_earned_50_total'],
  [500, 'coins_earned_500_total'],
]

/** [umbral, id de logro] de días consecutivos con al menos un mission_completed de Tarea/Rutina (documento 14.4; los Bosses no cuentan). */
const COMPLETION_STREAK_DAYS_THRESHOLDS: readonly (readonly [number, string])[] = [
  [3, 'streak_3'],
  [7, 'streak_7'],
  [14, 'streak_14'],
  [30, 'streak_30'],
  [60, 'streak_60'],
  [100, 'streak_100'],
  [365, 'streak_365'],
]

function idsAtOrAboveThreshold(value: number, thresholds: readonly (readonly [number, string])[]): string[] {
  return thresholds.filter(([threshold]) => value >= threshold).map(([, id]) => id)
}

/** Instante UTC (ms) de medianoche de una fecha 'YYYY-MM-DD' (Date.UTC evita el problema de horario de verano de restar Date locales). */
function dateStringToUtcMs(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)
}

/** Datos adicionales (más allá de nivel/rango/atributos) para evaluateStateBasedAchievements. Si se omite, equivale a los 5 contadores en 0, 0 monedas en mano y mochila vacía: ningún logro de esta tanda se desbloquea. */
export interface StateBasedAchievementExtras {
  counters: AchievementCounters
  /** Saldo de monedas actual (no acumulado histórico: ver AchievementCounters.coinsEarnedTotal para eso). */
  coinsHeld: number
  inventoryQuantities: InventoryQuantities
  /** Racha de días locales consecutivos con al menos un mission_completed de Tarea/Rutina (Tanda 3, documento 14.4). Ausente equivale a 0: ningún streak_* se desbloquea. */
  completionStreakDays?: number
  /** Racha de mission_completed consecutivos (Tarea/Rutina) sin ningún mission_failed intercalado (documento 14.8/14.11). Ausente equivale a 0. */
  flawlessStreak?: number
  /** HP mínimo alcanzado en la partida activa, nunca por debajo de 1 en una partida viva (morir reinicia esta columna a 100 en una partida nueva — documento 14.8/14.11). Ausente equivale a 100 (nunca ha bajado). */
  minHpReachedThisRun?: number
  /** Días locales transcurridos desde el último evento que restó HP (o desde el inicio de la partida si nunca ha recibido daño). Ausente equivale a 0: 'no_damage_30_days' no se desbloquea. */
  daysSinceLastDamage?: number
  /** Fecha local ('YYYY-MM-DD') del último mission_completed de Tarea/Rutina con cada atributo como principal, indexada por atributo (documento 14.11, "Maestro versátil"). Ausente equivale a mapa vacío. */
  attributeLastCompletedDates?: Partial<Record<Attribute, string>>
}

/**
 * Evalúa, a partir del estado actual del personaje, los logros de las
 * categorías 'level_rank' y 'attributes' (nivel y niveles de atributo) y,
 * cuando se pasa `extras`, también los de contador acumulado ('missions',
 * 'bosses' salvo el evento único, 'items_market' salvo los 3 eventos únicos,
 * 'coins' salvo el saldo), los de estado actual de monedas/mochila
 * (coins_held_100/250, backpack_5_items, item_collector_all_types), los 7 de
 * 'consistency' (streak_3..streak_365, Tanda 3) y los de 'survival'/
 * 'failure_recovery' que se derivan de un valor de estado ya persistido
 * (level_50_no_death, no_damage_30_days, flawless_25_missions,
 * hp_below_25_first, survive_1_hp, hp_recovery_10_to_50,
 * recovery_10_missions_after_below_25, versatile_master_6_attributes_7_days
 * — Tanda 3) cuya condición ya se cumple. Es pura y no sabe nada de qué
 * logros ya estaban desbloqueados antes: la capa de llamada (gameApi/
 * Dashboard) es la que compara este resultado contra achievement_progress y
 * decide qué insertar.
 *
 * Los logros que dependen del ORDEN relativo entre dos eventos, no solo de
 * un valor de estado ya cumplido (Sin miedo, Defensa perfecta, Huida
 * estratégica, La parada celestial, La muerte tendrá que esperar, Una
 * lección aprendida, De vuelta al camino) no viven aquí: se desbloquean como
 * unlocks directos en el instante exacto de la acción que los dispara (ver
 * gameApi), porque volver a evaluar esta función en otro punto de cambio de
 * estado (p.ej. tras una Derrota de Boss) los desbloquearía prematuramente.
 */
export function evaluateStateBasedAchievements(
  character: CharacterState,
  attributeLevels: AttributeLevelState[],
  extras?: StateBasedAchievementExtras,
): string[] {
  const unlocked: string[] = []

  if (character.level >= 5) unlocked.push('level_5')
  if (character.level >= 100) unlocked.push('level_100')
  // Morir crea una adventure_run nueva (die_and_restart_adventure): "sin
  // morir" es automático con solo comprobar el nivel de la partida activa.
  if (character.level >= 50) unlocked.push('level_50_no_death')

  // Un rango alcanzado implica también todos los rangos inferiores ya
  // cruzados (p.ej. estar en Guerrero implica haber pasado por Aventurero),
  // así que se comprueban todos los rangos por debajo del nivel actual, no
  // solo el rango actual.
  for (const rank of RANKS) {
    const achievementId = RANK_ACHIEVEMENT_ID_BY_RANK_NAME[rank.name]
    if (achievementId && character.level >= rank.minLevel) {
      unlocked.push(achievementId)
    }
  }

  const levelByAttribute = new Map(attributeLevels.map((entry) => [entry.attribute, entry.level]))

  for (const [attribute, level] of levelByAttribute) {
    const milestoneIds = ATTRIBUTE_MILESTONE_ACHIEVEMENT_IDS[attribute]
    for (const milestone of ATTRIBUTE_MILESTONES) {
      if (level >= milestone) unlocked.push(milestoneIds[milestone])
    }
  }

  const allAttributesAt50 = ALL_ATTRIBUTES.every((attribute) => (levelByAttribute.get(attribute) ?? 0) >= 50)
  if (allAttributesAt50) unlocked.push('all_attributes_50')

  const counters = extras?.counters ?? ZERO_COUNTERS
  const coinsHeld = extras?.coinsHeld ?? 0
  const inventoryQuantities = extras?.inventoryQuantities ?? {}

  unlocked.push(...idsAtOrAboveThreshold(counters.missionsCompletedCount, MISSION_COMPLETED_COUNT_THRESHOLDS))
  unlocked.push(...idsAtOrAboveThreshold(counters.bossesWonCount, BOSS_WON_COUNT_THRESHOLDS))
  unlocked.push(...idsAtOrAboveThreshold(counters.potionsUsedCount, POTIONS_USED_COUNT_THRESHOLDS))
  unlocked.push(...idsAtOrAboveThreshold(counters.marketPurchasesCount, MARKET_PURCHASES_COUNT_THRESHOLDS))
  unlocked.push(...idsAtOrAboveThreshold(counters.coinsEarnedTotal, COINS_EARNED_TOTAL_THRESHOLDS))

  if (coinsHeld >= 100) unlocked.push('coins_held_100')
  if (coinsHeld >= 250) unlocked.push('coins_held_250')

  const totalItemsInBackpack = ALL_ITEM_IDS.reduce((sum, itemId) => sum + (inventoryQuantities[itemId] ?? 0), 0)
  if (totalItemsInBackpack >= 5) unlocked.push('backpack_5_items')

  const hasAllItemTypes = ALL_ITEM_IDS.every((itemId) => (inventoryQuantities[itemId] ?? 0) >= 1)
  if (hasAllItemTypes) unlocked.push('item_collector_all_types')

  // Tanda 3: consistency (streak_3..streak_365).
  const completionStreakDays = extras?.completionStreakDays ?? 0
  unlocked.push(...idsAtOrAboveThreshold(completionStreakDays, COMPLETION_STREAK_DAYS_THRESHOLDS))

  // Tanda 3: survival y failure_recovery derivables de un valor de estado ya
  // persistido (ver StateBasedAchievementExtras para el resto, que requiere
  // orden relativo entre eventos y vive como unlock directo en gameApi).
  const flawlessStreak = extras?.flawlessStreak ?? 0
  const minHpReachedThisRun = extras?.minHpReachedThisRun ?? 100
  const daysSinceLastDamage = extras?.daysSinceLastDamage ?? 0
  const attributeLastCompletedDates = extras?.attributeLastCompletedDates ?? {}

  if (flawlessStreak >= 25) unlocked.push('flawless_25_missions')
  if (flawlessStreak >= 10 && minHpReachedThisRun < 25) unlocked.push('recovery_10_missions_after_below_25')
  if (minHpReachedThisRun < 25) unlocked.push('hp_below_25_first')
  // En una partida viva, min_hp_reached_this_run nunca es <= 0 (eso sería
  // muerte, que reinicia la columna a 100 en la partida nueva): que valga
  // exactamente 1 solo puede deberse a una resolución de daño que terminó
  // ahí, con o sin Tótem de por medio.
  if (minHpReachedThisRun === 1) unlocked.push('survive_1_hp')
  if (minHpReachedThisRun < 10 && character.currentHp > 50) unlocked.push('hp_recovery_10_to_50')
  if (daysSinceLastDamage >= 30) unlocked.push('no_damage_30_days')

  const attributeDates = ALL_ATTRIBUTES.map((attribute) => attributeLastCompletedDates[attribute]).filter(
    (date): date is string => date != null,
  )
  if (attributeDates.length === ALL_ATTRIBUTES.length) {
    const msValues = attributeDates.map(dateStringToUtcMs)
    const spanDays = Math.round((Math.max(...msValues) - Math.min(...msValues)) / 86_400_000)
    if (spanDays <= 6) unlocked.push('versatile_master_6_attributes_7_days')
  }

  return unlocked
}
