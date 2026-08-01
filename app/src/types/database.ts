import { ITEM_CATALOG } from 'rules-engine'
import type { AchievementCategory, Attribute, BossType, Difficulty, ItemDefinition, ItemId, ShieldType } from 'rules-engine'

/** Los 6 atributos, para iterar (crear attribute_progress, poblar selects, etc). */
export const ATTRIBUTES: Attribute[] = [
  'vitality',
  'intellect',
  'discipline',
  'relations',
  'adventure',
  'fortune',
]

export const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  vitality: 'Vitalidad',
  intellect: 'Intelecto',
  discipline: 'Disciplina',
  relations: 'Relaciones',
  adventure: 'Aventura',
  fortune: 'Fortuna',
}

/** Medalla ilustrada representativa de cada atributo (public/ilustraciones/<slug>.png, mismo slug
 * que bossIllustration), para el hexágono de la tarjeta de misión, el selector de atributo del
 * formulario y la pantalla de Atributos. Sustituye al emoji de la iteración anterior. */
export const ATTRIBUTE_ICONS: Record<Attribute, string> = {
  vitality: '/ilustraciones/vitalidad.png',
  intellect: '/ilustraciones/intelecto.png',
  discipline: '/ilustraciones/disciplina.png',
  relations: '/ilustraciones/relaciones.png',
  adventure: '/ilustraciones/aventura.png',
  fortune: '/ilustraciones/fortuna.png',
}

/** Slug en español de cada atributo, usado para construir las rutas de las ilustraciones de Boss
 * en public/ilustraciones/ (boss_<slug>.png / _victoria.png / _derrota.png). */
const ATTRIBUTE_ILLUSTRATION_SLUG: Record<Attribute, string> = {
  vitality: 'vitalidad',
  intellect: 'intelecto',
  discipline: 'disciplina',
  relations: 'relaciones',
  adventure: 'aventura',
  fortune: 'fortuna',
}

/** Ilustración de un Boss por atributo y variante ('neutral' para la ficha/lista y la pantalla VS
 * antes de resolver, 'victoria'/'derrota' para la pantalla de resultado — ver BossBattleScreen). */
export function bossIllustration(attribute: Attribute, variant: 'neutral' | 'victoria' | 'derrota' = 'neutral'): string {
  const slug = ATTRIBUTE_ILLUSTRATION_SLUG[attribute]
  return variant === 'neutral' ? `/ilustraciones/boss_${slug}.png` : `/ilustraciones/boss_${slug}_${variant}.png`
}

/** Personaje jugable elegido por la cuenta (backend/022_player_character.sql). null = aún no ha elegido. */
export type PlayerCharacter = 'chico' | 'chica'

/** Ilustración del jugador por personaje elegido y variante, mismo mecanismo que bossIllustration:
 * 'neutral' para la Batalla contra Boss antes de resolver, 'victoria'/'derrota' para el resultado
 * (a diferencia del Boss, aquí la variante es directa: gana el jugador -> _victoria, pierde -> _derrota,
 * porque la imagen es del propio jugador, no del rival). */
export function playerIllustration(character: PlayerCharacter, variant: 'neutral' | 'victoria' | 'derrota' = 'neutral'): string {
  return variant === 'neutral' ? `/ilustraciones/player_${character}.png` : `/ilustraciones/player_${character}_${variant}.png`
}

/** Color de identidad por atributo (zona de la tarjeta + selector del formulario). Los 6 tienen
 * ahora su propio tono dedicado y más suave — ninguno reutiliza --color-accent/--color-rarity-epic/
 * --color-accent-gold como en la iteración anterior, para que no se solapen con el significado de
 * esos colores en otras pantallas (HP, rareza de objetos, XP). */
export const ATTRIBUTE_COLORS: Record<Attribute, string> = {
  vitality: 'var(--color-attr-vitality)',
  intellect: 'var(--color-attr-intellect)',
  discipline: 'var(--color-attr-discipline)',
  relations: 'var(--color-attr-relations)',
  adventure: 'var(--color-attr-adventure)',
  fortune: 'var(--color-attr-fortune)',
}

/** Color de texto sobre el fondo sólido de ATTRIBUTE_COLORS: crema donde el contraste con texto
 * claro es suficiente (Vitalidad, Disciplina), texto principal oscuro donde el tono es demasiado
 * claro/apagado para leerse bien en blanco (Intelecto, Relaciones, Aventura, Fortuna — los 4 con
 * menor contraste calculado contra blanco de los 6). Mismo criterio que .market-theme .btn--primary
 * en index.css. */
export const ATTRIBUTE_RIBBON_TEXT: Record<Attribute, string> = {
  vitality: 'var(--color-surface)',
  intellect: 'var(--color-text)',
  discipline: 'var(--color-surface)',
  relations: 'var(--color-text)',
  adventure: 'var(--color-text)',
  fortune: 'var(--color-text)',
}

/** Overlay casi imperceptible del color de atributo sobre --color-surface, para el degradado del
 * cuerpo de la tarjeta de misión (complementa la zona grande, ya no es el único guiño de color).
 * Mismo hex que ATTRIBUTE_COLORS pero como rgba de opacidad fija (igual que .badge--gold etc.) en
 * vez de color-mix(), por consistencia con el resto de la hoja de estilos. */
export const ATTRIBUTE_TINTS: Record<Attribute, string> = {
  vitality: 'rgba(201, 123, 107, 0.12)',
  intellect: 'rgba(122, 155, 174, 0.12)',
  discipline: 'rgba(125, 122, 138, 0.12)',
  relations: 'rgba(201, 154, 165, 0.12)',
  adventure: 'rgba(138, 155, 110, 0.12)',
  fortune: 'rgba(201, 168, 96, 0.12)',
}

/** Dificultades de Tarea/Rutina (las tres de Boss se seleccionan aparte, ver BOSS_DIFFICULTIES). */
export const MISSION_DIFFICULTIES: Difficulty[] = ['trivial', 'easy', 'medium', 'hard', 'epic']

/** Las tres dificultades de Boss, en el orden en que se muestran en su selector. */
export const BOSS_DIFFICULTIES: BossType[] = ['boss_minor', 'boss_major', 'boss_legendary']

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  trivial: 'Trivial',
  easy: 'Fácil',
  medium: 'Media',
  hard: 'Difícil',
  epic: 'Épica',
  boss_minor: 'Boss menor',
  boss_major: 'Boss importante',
  boss_legendary: 'Boss legendario',
}

/** Etiquetas cortas para el selector de dificultad de Boss (el tipo "Boss" ya da el contexto). */
export const BOSS_DIFFICULTY_LABELS: Record<BossType, string> = {
  boss_minor: 'Menor',
  boss_major: 'Importante',
  boss_legendary: 'Legendario',
}

/** Anillo extra alrededor del hexágono del Boss en la Batalla (nivel de amenaza visual, ver
 * BattleHex en ui/): Menor no lleva ninguno, Importante uno intermedio, Legendario el más
 * elaborado (dos anillos). */
export const BOSS_DIFFICULTY_RING: Record<BossType, 'none' | 'major' | 'legendary'> = {
  boss_minor: 'none',
  boss_major: 'major',
  boss_legendary: 'legendary',
}

/** Color por dificultad para Misiones (marcador lateral + insignia): trivial/fácil/media/épica
 * reutilizan --color-text-secondary/--color-accent/--color-accent-gold/--color-danger ya
 * existentes; difícil (y su equivalente de Boss, importante) usa la única variable nueva,
 * --color-difficulty-hard, como puente entre el dorado y el terracota. Los tres tipos de Boss
 * comparten la mitad más intensa de la misma escala, ya que un Boss siempre implica más en juego
 * que una tarea/rutina equivalente. */
export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  trivial: 'var(--color-text-secondary)',
  easy: 'var(--color-accent)',
  medium: 'var(--color-accent-gold)',
  hard: 'var(--color-difficulty-hard)',
  epic: 'var(--color-danger)',
  boss_minor: 'var(--color-accent-gold)',
  boss_major: 'var(--color-difficulty-hard)',
  boss_legendary: 'var(--color-danger)',
}

/** Nº de estrellas rellenas (1-5) para representar la dificultad de Tarea/Rutina en la tarjeta
 * de misión y en el selector del formulario. Las 3 dificultades de Boss no se muestran en
 * estrellas — su escala de 3 niveles no encaja en 1-5, así que Boss sigue usando el badge de
 * texto de DIFFICULTY_COLORS/BOSS_DIFFICULTY_LABELS. Se define para las 8 claves de todas formas
 * (Record<Difficulty, ...> lo exige); las 3 de Boss quedan sin usar por ahora. */
export const DIFFICULTY_STAR_COUNT: Record<Difficulty, number> = {
  trivial: 1,
  easy: 2,
  medium: 3,
  hard: 4,
  epic: 5,
  boss_minor: 3,
  boss_major: 4,
  boss_legendary: 5,
}

/** Etiqueta de tipo de misión (selector del formulario, insignia de la tarjeta). Antes vivía
 * duplicada como const local en MissionList.tsx y en DesignSystemPreview.tsx; ahora MissionForm.tsx
 * también la necesita para el selector de tipo, así que se promovió aquí como fuente única. */
export const MISSION_TYPE_LABELS: Record<MissionType, string> = {
  task: 'Tarea',
  routine: 'Rutina',
  boss: 'Boss',
}

export type DueUrgency = { label: string; variant: 'danger' | 'neutral' }

/** Deriva la insignia de urgencia de vencimiento a partir de due_date ya calculado (no cambia
 * cómo se calcula due_date/due_time, solo cómo se muestra): terracota si vence hoy o ya venció,
 * neutro si vence pronto (hasta 3 días), sin insignia si queda más margen. Fechas en formato
 * YYYY-MM-DD, comparadas como texto igual que el resto de la app (ver Dashboard.tsx). */
export function dueUrgencyBadge(dueDate: string | null, today: string): DueUrgency | null {
  if (dueDate === null) return null
  if (dueDate < today) return { label: 'Venció', variant: 'danger' }
  if (dueDate === today) return { label: 'Vence hoy', variant: 'danger' }

  const daysUntil = Math.round(
    (Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  )
  if (daysUntil > 3) return null
  return { label: `Vence en ${daysUntil} día${daysUntil === 1 ? '' : 's'}`, variant: 'neutral' }
}

/** Los 8 objetos del mercado, en el orden fijo del documento (sección 8.2). */
export const ITEM_IDS: ItemId[] = [
  'potion',
  'super_potion',
  'hyper_potion',
  'small_shield',
  'large_shield',
  'escape_rope',
  'celestial_hand',
  'immortality_totem',
]

export const RARITY_LABELS: Record<ItemDefinition['rarity'], string> = {
  common: 'Común',
  rare: 'Rara',
  epic: 'Épica',
  legendary: 'Legendaria',
}

/** Color por rareza para la Mochila (documento de diseño): común/legendaria reutilizan
 * --color-text-secondary/--color-accent-gold ya existentes, rara/épica usan las dos
 * variables nuevas --color-rarity-rare/--color-rarity-epic (solo para esto, ver index.css). */
export const RARITY_COLORS: Record<ItemDefinition['rarity'], string> = {
  common: 'var(--color-text-secondary)',
  rare: 'var(--color-rarity-rare)',
  epic: 'var(--color-rarity-epic)',
  legendary: 'var(--color-accent-gold)',
}

/** Ilustración de cada objeto del Mercado/Mochila (public/ilustraciones/<archivo>.png), mismo
 * mecanismo que ATTRIBUTE_ICONS. Sustituye al emoji placeholder de la iteración anterior. */
export const ITEM_ICONS: Record<ItemId, string> = {
  potion: '/ilustraciones/pocion.png',
  super_potion: '/ilustraciones/superpocion.png',
  hyper_potion: '/ilustraciones/hiperpocion.png',
  small_shield: '/ilustraciones/miniescudo.png',
  large_shield: '/ilustraciones/escudo.png',
  escape_rope: '/ilustraciones/cuerda_huida.png',
  celestial_hand: '/ilustraciones/mano_celestial.png',
  immortality_totem: '/ilustraciones/totem_inmortalidad.png',
}

/** Agrupa item_id repetidos en un texto legible ("Tótem de la Inmortalidad ×2, Mano Celestial")
 * para el aviso discreto de recompensas pendientes de la Mochila. */
export function summarizePendingRewardNames(itemIds: ItemId[]): string {
  const counts = new Map<ItemId, number>()
  for (const itemId of itemIds) {
    counts.set(itemId, (counts.get(itemId) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([itemId, count]) =>
      count > 1 ? `${ITEM_CATALOG[itemId].displayName} ×${count}` : ITEM_CATALOG[itemId].displayName,
    )
    .join(', ')
}

/** Texto exacto del efecto de cada objeto (documento, sección 8.2), para el "?" de Mercado/Mochila. */
export const ITEM_EFFECT_DESCRIPTIONS: Record<ItemId, string> = {
  potion: 'Recupera 5 HP.',
  super_potion: 'Recupera 10 HP.',
  hyper_potion: 'Recupera 20 HP.',
  small_shield: 'Reduce en 3 HP el daño de la próxima misión fallada.',
  large_shield: 'Reduce en 10 HP el daño de la próxima misión fallada.',
  escape_rope: 'Evita una rutina o tarea sin XP ni daño.',
  celestial_hand:
    'Actívala antes de declarar el resultado de un Boss: si lo pierdes, reduce el daño de 20 a 10 HP. Se consume también si ganas.',
  immortality_totem: 'Evita una muerte y deja al personaje con 1 HP.',
}

export type MissionType = 'routine' | 'task' | 'boss'
export type MissionStatus = 'active' | 'completed' | 'failed' | 'deleted' | 'evaded' | 'boss_won' | 'boss_lost'

export interface AdventureRunRow {
  id: string
  user_id: string
  started_at: string
  ended_at: string | null
  ended_reason: 'death' | null
}

/** Fila de cuenta (backend/020_tutorial.sql), no de partida: a diferencia de AdventureRunRow y todo lo demás, sobrevive intacta a die_and_restart_adventure. */
export interface UserProfileRow {
  user_id: string
  tutorial_reward_claimed: boolean
  /** null = aún no ha elegido personaje (backend/022_player_character.sql); dispara el selector. */
  player_character: PlayerCharacter | null
  created_at: string
}

export interface CharacterRow {
  id: string
  adventure_run_id: string
  level: number
  current_xp: number
  current_hp: number
  coins: number
  tutorial_completed_at: string | null
  /** Contadores acumulados para los logros de contador (Tanda 2, backend/015_achievement_counters.sql): solo suben, nunca bajan al gastar/perder. */
  missions_completed_count: number
  bosses_won_count: number
  potions_used_count: number
  market_purchases_count: number
  coins_earned_total: number
  /** Estado incremental para los logros de Constancia, Supervivencia y Fallos/Recuperación (Tanda 3, backend/018_achievement_streaks.sql). */
  completion_streak_days: number
  last_completion_date: string | null
  last_damage_date: string | null
  flawless_streak: number
  min_hp_reached_this_run: number
  attribute_last_completed: Partial<Record<Attribute, string>>
  /** true si esta partida ya tuvo algún mission_failed (Tarea/Rutina) con daño real, exclusivo de 'mission_after_damage' (backend/019_mission_damage_taken.sql): a diferencia de min_hp_reached_this_run, Derrotas de Boss nunca lo tocan. */
  mission_damage_taken: boolean
}

export interface AttributeProgressRow {
  id: string
  adventure_run_id: string
  attribute: Attribute
  level: number
  current_xp: number
}

export interface MissionRow {
  id: string
  adventure_run_id: string
  type: MissionType
  name: string
  description: string | null
  difficulty: Difficulty
  primary_attribute: Attribute
  secondary_attribute: Attribute | null
  due_date: string | null
  due_time: string | null
  recurrence_rule: { frequency: 'daily' } | null
  /** Días ISO (1=Lunes..7=Domingo) en que la rutina genera ocurrencia. null = todos los días (default, y lo que valen automáticamente todas las rutinas creadas antes de este campo). Solo se usa si type = 'routine'. */
  days_of_week: number[] | null
  /** Último día (inclusive) en que la rutina genera/revisa ocurrencia. null = sin fecha de fin. Solo se usa si type = 'routine'. */
  end_date: string | null
  status: MissionStatus
  created_at: string
  resolved_at: string | null
}

/** "Vitalidad" o "Vitalidad + Disciplina" — el mismo texto que ya usaban BossMissionCard (lista de
 * Misiones) y ahora también la pantalla de Batalla contra Boss; antes vivía duplicado como const
 * local en MissionList.tsx. */
export function attributeSummaryText(mission: MissionRow): string {
  const primary = ATTRIBUTE_LABELS[mission.primary_attribute]
  return mission.secondary_attribute ? `${primary} + ${ATTRIBUTE_LABELS[mission.secondary_attribute]}` : primary
}

export interface MissionOccurrenceRow {
  id: string
  mission_id: string
  occurrence_date: string
  status: MissionStatus
  resolved_at: string | null
}

export interface InventoryItemRow {
  id: string
  adventure_run_id: string
  item_id: ItemId
  quantity: number
}

export type ShieldItemId = 'small_shield' | 'large_shield'

export interface ActiveShieldRow {
  id: string
  adventure_run_id: string
  item_id: ShieldItemId
  activated_at: string
}

/** Solo existe un tipo de Mano Celestial, así que a diferencia de ActiveShieldRow no hace falta item_id. */
export interface ActiveCelestialHandRow {
  id: string
  adventure_run_id: string
  activated_at: string
}

/** Recompensa de rango (documento 12.4) sin reclamar porque el objeto estaba a su límite de stock. */
export interface PendingRewardRow {
  id: string
  adventure_run_id: string
  item_id: ItemId
  created_at: string
}

export interface AchievementProgressRow {
  id: string
  adventure_run_id: string
  achievement_id: string
  unlocked_at: string
}

/** Nombres de categoría en español para la pantalla de logros (documento, sección 14.12). */
export const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  missions: 'Misiones',
  consistency: 'Constancia',
  bosses: 'Bosses',
  level_rank: 'Nivel y Rangos',
  attributes: 'Atributos',
  survival: 'Supervivencia',
  items_market: 'Objetos y Mercado',
  coins: 'Monedas',
  failure_recovery: 'Fallos y Recuperación',
}

/** Icono (placeholder de emoji, a sustituir por ilustraciones propias en una fase de pulido
 * posterior) por logro del catálogo (ACHIEVEMENT_CATALOG, 70 IDs), elegido por el hito concreto de
 * cada uno en vez de repetir un icono genérico — revisado y aprobado en /design-system con la
 * muestra de Misiones/Bosses antes de completar el resto. 5 casos reutilizan a propósito el mismo
 * emoji que ya usa otro icono de la app porque el logro trata literalmente de ese elemento:
 * boss_first_win (👑), totem_activated/escape_rope_used/
 * celestial_hand_used_first/perfect_shield_defense (🗿/🪢/🖐️/🛡️ = su ITEM_ICONS correspondiente). */
export const ACHIEVEMENT_ICONS: Record<string, string> = {
  // 14.3. Misiones — progresión de "primer paso" a "maestro".
  mission_first: '👣',
  mission_10: '🎒',
  mission_50: '🏹',
  mission_100: '🎖️',
  mission_250: '🦸',
  mission_500: '⏳',
  mission_1000: '🏆',

  // 14.4. Constancia — escala de racha de días, de la chispa inicial al aniversario.
  streak_3: '🔥',
  streak_7: '📅',
  streak_14: '📈',
  streak_30: '🗓️',
  streak_60: '🚀',
  streak_100: '🌟',
  streak_365: '🎆',

  // 14.5. Bosses — escala de intensidad hasta "conquistador".
  boss_first_win: '👑',
  boss_5_wins: '🗡️',
  boss_10_wins: '💥',
  boss_25_wins: '🌋',
  boss_no_celestial_hand: '🦁',
  boss_50_wins: '🏅',

  // 14.6. Nivel y rangos — de la semilla del nivel 5 al infinito del nivel 100.
  level_5: '🌱',
  rank_adventurer: '🥾',
  rank_warrior: '🪖',
  rank_elite: '💠',
  rank_master: '🧙',
  rank_legend: '🐉',
  rank_hero: '🥇',
  level_100: '♾️',

  // 14.7. Atributos — 3 hitos (10/25/50) por atributo + el maestro de los 6.
  attribute_vitality_10: '💪',
  attribute_vitality_25: '🫀',
  attribute_vitality_50: '🏰',
  attribute_intellect_10: '💡',
  attribute_intellect_25: '🧠',
  attribute_intellect_50: '🦉',
  attribute_discipline_10: '🧘',
  attribute_discipline_25: '⛓️',
  attribute_discipline_50: '🥋',
  attribute_relations_10: '🐶',
  attribute_relations_25: '🎉',
  attribute_relations_50: '🫂',
  attribute_adventure_10: '🔦',
  attribute_adventure_25: '⛰️',
  attribute_adventure_50: '🌍',
  attribute_fortune_10: '🎲',
  attribute_fortune_25: '🌈',
  attribute_fortune_50: '⭐',
  all_attributes_50: '🔯',

  // 14.8. Supervivencia.
  hp_below_25_first: '🤕',
  survive_1_hp: '🕯️',
  totem_activated: '🗿',
  level_50_no_death: '🎗️',
  no_damage_30_days: '🧿',
  flawless_25_missions: '💎',

  // 14.9. Objetos y mercado — los 3 ligados a un objeto concreto reutilizan su ITEM_ICONS.
  first_purchase: '🛍️',
  backpack_5_items: '📦',
  potions_used_10: '⚗️',
  perfect_shield_defense: '🛡️',
  escape_rope_used: '🪢',
  celestial_hand_used_first: '🖐️',
  item_collector_all_types: '🧰',
  market_25_purchases: '🧾',

  // 14.10. Monedas.
  coins_earned_50_total: '🪙',
  coins_held_100: '💰',
  coins_held_250: '👛',
  coins_earned_500_total: '💵',

  // 14.11. Fallos, recuperación y variedad.
  first_mission_failed: '🩹',
  mission_after_damage: '🚶',
  hp_recovery_10_to_50: '🔋',
  recovery_10_missions_after_below_25: '🎊',
  versatile_master_6_attributes_7_days: '🎭',
}

// --- Fase 8: Historial y estadísticas (documento, secciones 15 y 16.7) -----

/**
 * 13 valores de event_type (backend/016_history.sql) que cubren, a veces
 * fusionados en un mismo evento, los 15 tipos que lista el documento en
 * 15.2: "daño recibido" viaja como campo `damage` de mission_failed/
 * boss_lost, y "vida recuperada" como campo `heal_amount` de item_used, en
 * vez de ser eventos aparte.
 */
export type HistoryEventType =
  | 'mission_completed'
  | 'mission_failed'
  | 'mission_deleted'
  | 'mission_evaded'
  | 'boss_won'
  | 'boss_lost'
  | 'item_used'
  | 'shield_activated'
  | 'item_purchased'
  | 'achievement_unlocked'
  | 'level_up'
  | 'rank_changed'
  | 'totem_activated'

export interface MissionCompletedPayload {
  mission_id: string
  mission_name: string
  mission_type: 'task' | 'routine'
  difficulty: Difficulty
  primary_attribute: Attribute
  secondary_attribute: Attribute | null
  xp_general: number
  xp_primary: number
  /** null si la misión no tiene atributo secundario. */
  xp_secondary: number | null
  /** null para tareas; fecha (YYYY-MM-DD) de la ocurrencia para rutinas. */
  occurrence_date: string | null
}

export interface MissionFailedPayload {
  mission_id: string
  mission_name: string
  mission_type: 'task' | 'routine'
  difficulty: Difficulty
  occurrence_date: string | null
  /** Daño exacto causado por este fallo concreto (ya con escudo aplicado, si lo había). */
  damage: number
}

export interface MissionDeletedPayload {
  mission_id: string
  mission_name: string
  mission_type: MissionType
  difficulty: Difficulty
}

export interface MissionEvadedPayload {
  mission_id: string
  mission_name: string
  mission_type: 'task' | 'routine'
  difficulty: Difficulty
  occurrence_date: string | null
}

export interface BossWonPayload {
  mission_id: string
  boss_name: string
  difficulty: BossType
  coins_gained: number
  xp_general: number
  xp_primary: number
  xp_secondary: number | null
  primary_attribute: Attribute
  secondary_attribute: Attribute | null
  celestial_hand_consumed: boolean
}

export interface BossLostPayload {
  mission_id: string
  boss_name: string
  difficulty: BossType
  damage: number
  celestial_hand_consumed: boolean
}

export interface ItemUsedPayload {
  item_id: ItemId
  item_name: string
  /** null para objetos que no curan (p.ej. Mano Celestial). */
  heal_amount: number | null
}

export interface ShieldActivatedPayload {
  item_id: ShieldItemId
  item_name: string
  shield_type: ShieldType
}

export interface ItemPurchasedPayload {
  item_id: ItemId
  item_name: string
  price: number
  coins_after: number
}

export interface AchievementUnlockedPayload {
  achievement_id: string
  achievement_name: string
  category: AchievementCategory
}

export interface LevelUpPayload {
  from_level: number
  to_level: number
  levels_gained: number
}

export interface RankChangedPayload {
  from_rank: string
  to_rank: string
}

export interface TotemActivatedPayload {
  context: 'mission_failure' | 'boss_defeat'
  /** Nombre de la misión/Boss cuyo fallo consumió el Tótem; null si no se pudo determinar cuál en concreto. */
  source_name: string | null
}

export interface HistoryEventRow {
  id: string
  adventure_run_id: string
  event_type: HistoryEventType
  /** Forma exacta según event_type — ver los Payload de arriba (p.ej. MissionCompletedPayload para 'mission_completed'). */
  payload: Record<string, unknown>
  occurred_at: string
}
