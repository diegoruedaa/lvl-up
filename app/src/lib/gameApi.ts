import {
  ACHIEVEMENT_CATALOG,
  applyDamageSequence,
  applyHealing,
  canAddItemToInventory,
  coinsForBossVictory,
  coinsForLevelsGained,
  damageForBossDefeat,
  damageForMissionFailure,
  healingAmountForItem,
  ITEM_CATALOG,
  rankForLevel,
  rankRewardIfCrossed,
  SECONDARY_ATTRIBUTE_XP_SHARE,
  xpForMissionCompletion,
} from 'rules-engine'
import type { Attribute, BossType, Difficulty, ItemId, ShieldType } from 'rules-engine'
import { supabase } from './supabase'
import { ATTRIBUTES } from '../types/database'
import type {
  ActiveCelestialHandRow,
  ActiveShieldRow,
  AchievementProgressRow,
  AdventureRunRow,
  AttributeProgressRow,
  CharacterRow,
  HistoryEventRow,
  HistoryEventType,
  InventoryItemRow,
  MissionOccurrenceRow,
  MissionRow,
  MissionType,
  PendingRewardRow,
  PlayerCharacter,
  ShieldItemId,
  UserProfileRow,
} from '../types/database'

const UNIQUE_VIOLATION = '23505'

/** SQLSTATE que 006_die_and_restart.sql asigna vía `using errcode` a la excepción de "adventure_run ya ha finalizado". Las otras dos excepciones de esa función (adventure_run inexistente o de otro usuario) no tienen SQLSTATE propio y siguen cayendo en el genérico P0001. */
const ADVENTURE_RUN_ALREADY_ENDED_ERRCODE = 'LV001'

/**
 * Comprueba primero el SQLSTATE propio de la excepción (ver
 * ADVENTURE_RUN_ALREADY_ENDED_ERRCODE); si el error no trae `code` (por
 * ejemplo, en un test que construye el error a mano) cae al texto del
 * mensaje, que es estable porque está hardcodeado en la función SQL.
 */
export function isAdventureRunAlreadyEndedError(error: { code?: string | null; message?: string | null }): boolean {
  if (error.code === ADVENTURE_RUN_ALREADY_ENDED_ERRCODE) return true
  return typeof error.message === 'string' && error.message.includes('ya ha finalizado')
}

/** SQLSTATE que 023_resolve_boss_battle.sql asigna a la excepción de "esta batalla ya se resolvió" (mission.status ya no es 'active' cuando resolve_boss_victory/resolve_boss_defeat_alive intentan aplicarla). Mismo patrón que ADVENTURE_RUN_ALREADY_ENDED_ERRCODE. */
const BOSS_ALREADY_RESOLVED_ERRCODE = 'LV002'

/** Igual que isAdventureRunAlreadyEndedError, pero para el guard de resolve_boss_victory/resolve_boss_defeat_alive: detecta el reintento de confirmar Victoria/Derrota sobre un Boss cuya resolución anterior ya se aplicó (p.ej. tras reabrir una pantalla de batalla stale). */
export function isBossAlreadyResolvedError(error: { code?: string | null; message?: string | null }): boolean {
  if (error.code === BOSS_ALREADY_RESOLVED_ERRCODE) return true
  return typeof error.message === 'string' && error.message.includes('ya se resolvió')
}

// --- Fase 8: Historial ------------------------------------------------------

const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENT_CATALOG.map((achievement) => [achievement.id, achievement]))

/** Inserta un history_event (backend/016_history.sql). El payload exacto de cada event_type está documentado en types/database.ts (MissionCompletedPayload, BossWonPayload, etc). */
async function logHistoryEvent(
  adventureRunId: string,
  eventType: HistoryEventType,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('history_event')
    .insert({ adventure_run_id: adventureRunId, event_type: eventType, payload })

  if (error) throw error
}

/** Historial completo de la partida activa, más reciente primero (documento 15.2), sin paginación (15.4: el historial se acota solo a la aventura actual). */
export async function fetchHistoryEvents(adventureRunId: string): Promise<HistoryEventRow[]> {
  const { data, error } = await supabase
    .from('history_event')
    .select()
    .eq('adventure_run_id', adventureRunId)
    .order('occurred_at', { ascending: false })
    .order('seq', { ascending: false })

  if (error) throw error
  return data as HistoryEventRow[]
}

/**
 * Desbloquea directamente, en el instante exacto de la acción, uno de los 4
 * logros de "evento único" de la Tanda 2 (Sin miedo, Defensa perfecta, Huida
 * estratégica, La parada celestial — documento 14.5/14.9): a diferencia de
 * evaluateStateBasedAchievements (rules-engine), estos no se derivan de un
 * contador ni de una foto del estado, así que quien decide si se cumplen es
 * el propio punto de la acción (resolveBossVictory, processExpiredMissions,
 * applyEscapeRopeToTask/Routine, activateCelestialHand), no una función pura
 * aparte. Upsert con ignoreDuplicates: repetir la acción tras ya estar
 * desbloqueado no falla, simplemente no inserta nada de nuevo (devuelve
 * null). Devuelve la fila insertada (con su unlocked_at real) solo cuando de
 * verdad se acaba de desbloquear, para que la capa de UI pueda reflejarlo al
 * instante sin tener que releer toda achievement_progress.
 */
async function unlockAchievementDirect(
  adventureRunId: string,
  achievementId: string,
): Promise<AchievementProgressRow | null> {
  const { data, error } = await supabase
    .from('achievement_progress')
    .upsert(
      { adventure_run_id: adventureRunId, achievement_id: achievementId },
      { onConflict: 'adventure_run_id,achievement_id', ignoreDuplicates: true },
    )
    .select()

  if (error) throw error

  const rows = data as AchievementProgressRow[]
  if (rows.length === 0) return null

  const achievement = ACHIEVEMENT_BY_ID.get(achievementId)
  if (achievement) {
    await logHistoryEvent(adventureRunId, 'achievement_unlocked', {
      achievement_id: achievement.id,
      achievement_name: achievement.name,
      category: achievement.category,
    })
  }

  return rows[0]
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Fecha local (no UTC) en formato YYYY-MM-DD, para agrupar ocurrencias de rutina por "día del usuario". */
export function localDateString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function todayLocalDateString(): string {
  return localDateString(new Date())
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Instante local del límite de una fecha+hora de vencimiento. 23:59:59.999 si no hay hora (tareas sin hora, y todas las ocurrencias de rutina). */
function dueDateTimeLocal(dateStr: string, timeStr: string | null): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  if (timeStr) {
    const [hour, minute] = timeStr.split(':').map(Number)
    return new Date(year, month - 1, day, hour, minute, 0, 0)
  }
  return new Date(year, month - 1, day, 23, 59, 59, 999)
}

/** Fechas locales (YYYY-MM-DD) desde startDateStr hasta endDateStr, ambas inclusive. */
function localDateStringsBetween(startDateStr: string, endDateStr: string): string[] {
  const start = parseLocalDate(startDateStr)
  const end = parseLocalDate(endDateStr)
  const dates: string[] = []
  const cursor = new Date(start)
  while (cursor.getTime() <= end.getTime()) {
    dates.push(localDateString(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

/** Días locales completos entre dos fechas (0 si son el mismo día); reusa localDateStringsBetween para no reintroducir el problema de horario de verano de restar Date directamente. */
function localDaysBetween(startDateStr: string, endDateStr: string): number {
  return localDateStringsBetween(startDateStr, endDateStr).length - 1
}

/** Día ISO de la semana (1=Lunes..7=Domingo) de una fecha local YYYY-MM-DD. */
function isoWeekday(dateStr: string): number {
  const jsDay = parseLocalDate(dateStr).getDay() // 0=domingo..6=sábado
  return jsDay === 0 ? 7 : jsDay
}

/** true si una rutina genera/revisa ocurrencia el día dado. `days_of_week: null` = todos los días — incluye, sin distinción, tanto las rutinas creadas sin elegir días específicos como todas las creadas antes de que este campo existiera. */
export function isDayApplicable(mission: MissionRow, dateStr: string): boolean {
  if (mission.days_of_week === null) return true
  return mission.days_of_week.includes(isoWeekday(dateStr))
}

/**
 * Constancia (streak_3..streak_365, Tanda 3, backend/018_achievement_streaks.sql):
 * próxima racha de días consecutivos con al menos un mission_completed de
 * Tarea/Rutina, dado el estado ya persistido en "character" y el día local
 * de hoy. Mismo día que la última finalización => sin cambio (no cuenta dos
 * veces el mismo día); día siguiente => +1; cualquier otro caso (hueco de
 * uno o más días, o primera finalización de la partida) => vuelve a 1.
 */
function nextCompletionStreakDays(currentStreak: number, lastCompletionDate: string | null, today: string): number {
  if (lastCompletionDate === null) return 1
  if (lastCompletionDate === today) return currentStreak
  return localDaysBetween(lastCompletionDate, today) === 1 ? currentStreak + 1 : 1
}

/**
 * Intocable (no_damage_30_days, Tanda 3): días locales transcurridos desde
 * el último evento que restó HP (mission_failed/boss_lost con damage > 0),
 * o desde el inicio de la partida si todavía no ha recibido ningún daño. Se
 * recalcula en cada carga de estado (Dashboard), no solo al escribir un
 * evento, porque el umbral se puede cruzar por el simple paso del tiempo.
 */
export function daysSinceLastDamage(character: CharacterRow, adventureRun: AdventureRunRow, today: string): number {
  const anchor = character.last_damage_date ?? localDateString(new Date(adventureRun.started_at))
  return localDaysBetween(anchor, today)
}

export interface GameState {
  adventureRun: AdventureRunRow
  character: CharacterRow
  attributeProgress: AttributeProgressRow[]
}

/**
 * Garantiza que el usuario tiene una adventure_run activa con su character y
 * sus 6 attribute_progress. Si ya existe, la recupera tal cual. Tolera la
 * carrera de doble-montaje de React StrictMode: si otro insert gana la
 * carrera contra el índice único, simplemente relee la fila ganadora.
 */
export async function ensureActiveGameState(userId: string): Promise<GameState> {
  const adventureRun = await ensureActiveAdventureRun(userId)
  const character = await ensureCharacter(adventureRun.id)
  const attributeProgress = await ensureAttributeProgress(adventureRun.id)
  return { adventureRun, character, attributeProgress }
}

async function ensureActiveAdventureRun(userId: string): Promise<AdventureRunRow> {
  const existing = await selectActiveAdventureRun(userId)
  if (existing) return existing

  const { data, error } = await supabase
    .from('adventure_run')
    .insert({ user_id: userId })
    .select()
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      const winner = await selectActiveAdventureRun(userId)
      if (winner) return winner
    }
    throw error
  }

  return data as AdventureRunRow
}

async function selectActiveAdventureRun(userId: string): Promise<AdventureRunRow | null> {
  const { data, error } = await supabase
    .from('adventure_run')
    .select()
    .eq('user_id', userId)
    .is('ended_at', null)
    .maybeSingle()

  if (error) throw error
  return data as AdventureRunRow | null
}

async function ensureCharacter(adventureRunId: string): Promise<CharacterRow> {
  const existing = await selectCharacter(adventureRunId)
  if (existing) return existing

  const { data, error } = await supabase
    .from('character')
    .insert({ adventure_run_id: adventureRunId })
    .select()
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      const winner = await selectCharacter(adventureRunId)
      if (winner) return winner
    }
    throw error
  }

  return data as CharacterRow
}

async function selectCharacter(adventureRunId: string): Promise<CharacterRow | null> {
  const { data, error } = await supabase
    .from('character')
    .select()
    .eq('adventure_run_id', adventureRunId)
    .maybeSingle()

  if (error) throw error
  return data as CharacterRow | null
}

/** Relectura dirigida de attribute_progress tras una RPC que ya la escribió (resolve_boss_victory), igual que selectCharacter — a diferencia de ensureAttributeProgress, no hace ningún upsert: las 6 filas ya existen desde ensureActiveGameState. */
async function selectAttributeProgress(adventureRunId: string): Promise<AttributeProgressRow[]> {
  const { data, error } = await supabase
    .from('attribute_progress')
    .select()
    .eq('adventure_run_id', adventureRunId)

  if (error) throw error
  return data as AttributeProgressRow[]
}

/** Relectura dirigida de un logro concreto (para saber si ya estaba desbloqueado antes de una RPC, o si acaba de desbloquearse), mismo propósito que el `data.length === 0` de unlockAchievementDirect pero desde el lado del cliente cuando la escritura ocurre dentro de una RPC (resolve_boss_victory/resolve_boss_defeat_alive) en vez de un upsert directo aquí. */
async function fetchAchievementProgressRow(
  adventureRunId: string,
  achievementId: string,
): Promise<AchievementProgressRow | null> {
  const { data, error } = await supabase
    .from('achievement_progress')
    .select()
    .eq('adventure_run_id', adventureRunId)
    .eq('achievement_id', achievementId)
    .maybeSingle()

  if (error) throw error
  return data as AchievementProgressRow | null
}

/**
 * Relectura dirigida de las filas de pending_reward insertadas por ESTA
 * llamada a resolve_boss_victory, para poder devolver un RankRewardOutcome
 * completo sin que la RPC tenga que devolver más que void. pending_reward no
 * tiene `unique(adventure_run_id, item_id)` (012_rank_rewards.sql: pueden
 * acumularse varias pendientes del mismo objeto), así que no hay una key
 * natural para pedir "la fila que acabo de insertar" — se acota por
 * item_id + created_at >= sinceIso (capturado justo antes de invocar la
 * RPC). Dentro de una misma transacción, now() es constante para todos los
 * inserts de esa transacción, así que dos ocurrencias del mismo item_id
 * (cruzar el mismo rango dos veces) comparten created_at exacto: son
 * indistinguibles entre sí, y da igual en qué orden se les haga match, ya
 * que representan el mismo objeto.
 */
async function fetchNewPendingRewards(
  adventureRunId: string,
  itemIds: ItemId[],
  sinceIso: string,
): Promise<PendingRewardRow[]> {
  if (itemIds.length === 0) return []

  const { data, error } = await supabase
    .from('pending_reward')
    .select()
    .eq('adventure_run_id', adventureRunId)
    .in('item_id', itemIds)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data as PendingRewardRow[]).slice(0, itemIds.length)
}

async function ensureAttributeProgress(adventureRunId: string): Promise<AttributeProgressRow[]> {
  const rows = ATTRIBUTES.map((attribute) => ({ adventure_run_id: adventureRunId, attribute }))

  const { error: upsertError } = await supabase
    .from('attribute_progress')
    .upsert(rows, { onConflict: 'adventure_run_id,attribute', ignoreDuplicates: true })

  if (upsertError) throw upsertError

  const { data, error } = await supabase
    .from('attribute_progress')
    .select()
    .eq('adventure_run_id', adventureRunId)

  if (error) throw error
  return data as AttributeProgressRow[]
}

export interface EnsureUserProfileResult {
  profile: UserProfileRow
  /**
   * true solo si ESTA llamada acaba de insertar la fila: es decir, la
   * primerísima vez que este usuario entra a la app en la vida de la
   * cuenta. No es un flag persistido en Supabase — se deduce en el momento
   * de si el insert tuvo éxito (fila nueva) o chocó con la PK ya existente
   * (fila de una carga anterior), así que no sobrevive más allá de esta
   * llamada ni hace falta que lo haga: Dashboard solo lo usa para decidir si
   * auto-abre el tutorial en ESTA carga.
   */
  justCreated: boolean
}

/**
 * Garantiza que el usuario tiene una fila en user_profile (backend/020_tutorial.sql):
 * a diferencia de adventure_run/character/attribute_progress, no cuelga de
 * ninguna partida y nunca la toca die_and_restart_adventure, así que
 * tutorial_reward_claimed sobrevive a la muerte del personaje (documento
 * 6.2). Mismo patrón get-or-create tolerante a la carrera de doble-montaje
 * de StrictMode que ensureActiveAdventureRun.
 */
export async function ensureUserProfile(userId: string): Promise<EnsureUserProfileResult> {
  const existing = await selectUserProfile(userId)
  if (existing) return { profile: existing, justCreated: false }

  const { data, error } = await supabase.from('user_profile').insert({ user_id: userId }).select().single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      const winner = await selectUserProfile(userId)
      if (winner) return { profile: winner, justCreated: false }
    }
    throw error
  }

  return { profile: data as UserProfileRow, justCreated: true }
}

async function selectUserProfile(userId: string): Promise<UserProfileRow | null> {
  const { data, error } = await supabase.from('user_profile').select().eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data as UserProfileRow | null
}

/**
 * Guarda el personaje jugable elegido (backend/022_player_character.sql). A diferencia de
 * claim_tutorial_reward, no hay recompensa ni estado que proteger contra doble-reclamo: es un
 * simple valor de preferencia, así que un update directo (mismo estilo que el resto de escrituras
 * de esta capa) basta, sin necesitar una función RPC dedicada.
 */
export async function setPlayerCharacter(userId: string, character: PlayerCharacter): Promise<UserProfileRow> {
  const { data, error } = await supabase
    .from('user_profile')
    .update({ player_character: character })
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return data as UserProfileRow
}

export interface ClaimTutorialRewardOutcome {
  /** false si tutorial_reward_claimed ya era true de antes: no se concedió nada de nuevo (idempotente). */
  claimed: boolean
  character: CharacterRow | null
  inventoryItem: InventoryItemRow | null
}

/**
 * Reclama, una única vez en la vida de la cuenta, la recompensa del tutorial
 * (1 Poción + 10 monedas, documento 6.2) sobre la adventure_run activa. La
 * atomicidad y la protección contra doble-reclamo viven en la función SQL
 * claim_tutorial_reward (backend/020_tutorial.sql, mismo "for update" que
 * die_and_restart_adventure): aquí solo releemos character/inventory_item
 * cuando de verdad se acaba de conceder, igual que unlockAchievementDirect
 * releyendo solo lo que cambió en vez de todo el estado.
 */
export async function claimTutorialReward(adventureRunId: string): Promise<ClaimTutorialRewardOutcome> {
  const { data, error } = await supabase.rpc('claim_tutorial_reward', { p_adventure_run_id: adventureRunId })
  if (error) throw error

  const claimed = data as boolean
  if (!claimed) return { claimed: false, character: null, inventoryItem: null }

  const [character, inventoryItem] = await Promise.all([
    selectCharacter(adventureRunId),
    fetchInventoryItem(adventureRunId, 'potion'),
  ])

  return { claimed: true, character, inventoryItem }
}

export async function fetchActiveMissions(adventureRunId: string): Promise<MissionRow[]> {
  const { data, error } = await supabase
    .from('mission')
    .select()
    .eq('adventure_run_id', adventureRunId)
    .eq('status', 'active')

  if (error) throw error
  return data as MissionRow[]
}

/** Ocurrencias de hoy para las misiones de tipo routine dadas (para saber cuáles ya se completaron hoy). */
export async function fetchTodayOccurrences(
  missionIds: string[],
  occurrenceDate: string,
): Promise<MissionOccurrenceRow[]> {
  if (missionIds.length === 0) return []

  const { data, error } = await supabase
    .from('mission_occurrence')
    .select()
    .in('mission_id', missionIds)
    .eq('occurrence_date', occurrenceDate)

  if (error) throw error
  return data as MissionOccurrenceRow[]
}

/** Todas las ocurrencias (cualquier fecha) de las misiones de rutina dadas, para saber qué días ya tienen fila (resueltos) y cuáles faltan por procesar. */
export async function fetchOccurrencesForMissions(missionIds: string[]): Promise<MissionOccurrenceRow[]> {
  if (missionIds.length === 0) return []

  const { data, error } = await supabase.from('mission_occurrence').select().in('mission_id', missionIds)

  if (error) throw error
  return data as MissionOccurrenceRow[]
}

/** Tope de filas a mirar hacia atrás en computeRoutineStreak (~13 meses de racha diaria): acota el
 * caso patológico de una rutina de meses sin fallar nunca, sin necesidad de un contador redundante. */
const ROUTINE_STREAK_LOOKBACK = 400

/**
 * Recorrido puro (sin I/O, como computeExpiredFailureEvents) del cálculo de
 * racha: `occurrences` en cualquier orden, más reciente primero tras
 * ordenar aquí, sumando 'completed'/'evaded' y cortando en el primer
 * 'failed'. mission_occurrence solo tiene fila para días aplicables — los
 * tres escritores (completeRoutineOccurrence, applyEscapeRopeToRoutine,
 * processExpiredMissions) ya filtran por isDayApplicable antes de escribir —
 * así que el orden de las filas ya es el de "días que tocaban" y no hace
 * falta volver a consultar days_of_week aquí. El día de hoy se salta
 * explícitamente por fecha (no por ausencia de fila): todavía no está
 * decidido, así que ni suma ni rompe la racha.
 */
export function routineStreakFromOccurrences(
  occurrences: Pick<MissionOccurrenceRow, 'occurrence_date' | 'status'>[],
  today: string,
): number {
  const sorted = [...occurrences].sort((a, b) => b.occurrence_date.localeCompare(a.occurrence_date))

  let streak = 0
  for (const occurrence of sorted) {
    if (occurrence.occurrence_date === today) continue
    if (occurrence.status === 'completed' || occurrence.status === 'evaded') {
      streak += 1
      continue
    }
    break
  }

  return streak
}

/**
 * Racha de días consecutivos sin fallar de una rutina (marcador de racha en
 * Misiones): trae, ya ordenadas descendente y acotadas a
 * ROUTINE_STREAK_LOOKBACK, las ocurrencias de esta misión, y delega el
 * recorrido a routineStreakFromOccurrences.
 */
export async function computeRoutineStreak(missionId: string): Promise<number> {
  const { data, error } = await supabase
    .from('mission_occurrence')
    .select('occurrence_date, status')
    .eq('mission_id', missionId)
    .order('occurrence_date', { ascending: false })
    .limit(ROUTINE_STREAK_LOOKBACK)

  if (error) throw error

  return routineStreakFromOccurrences(data as Pick<MissionOccurrenceRow, 'occurrence_date' | 'status'>[], todayLocalDateString())
}

/** Campos cuya relevancia depende del tipo de misión (due_date/due_time solo task/boss;
 * days_of_week/end_date/recurrence_rule solo routine) — mismo shape que aceptan createMission
 * y updateMission, para poder normalizarlos con una sola función. */
interface MissionTypeDependentFields {
  dueDate: string | null
  dueTime: string | null
  daysOfWeek: number[] | null
  endDate: string | null
}

/**
 * Anula los campos que no aplican al tipo de misión dado, para que nunca quede un due_date
 * colgado en una rutina o un days_of_week colgado en una tarea (mission_routine_fields_check,
 * backend/024_routine_days_and_end_date.sql). due_date/due_time se reutilizan tal cual como
 * "fecha de resultado" para un Boss (documento 7.7): no hay un campo distinto, solo se etiqueta
 * distinto en el formulario (ver MissionForm). Usado tanto por createMission como por
 * updateMission para no duplicar esta normalización.
 */
function normalizeMissionFieldsByType(type: MissionType, fields: MissionTypeDependentFields) {
  const usesDueDate = type === 'task' || type === 'boss'
  const isRoutine = type === 'routine'

  return {
    due_date: usesDueDate ? fields.dueDate : null,
    due_time: usesDueDate ? fields.dueTime : null,
    recurrence_rule: isRoutine ? ({ frequency: 'daily' } as const) : null,
    days_of_week: isRoutine ? fields.daysOfWeek : null,
    end_date: isRoutine ? fields.endDate : null,
  }
}

/** Mismo shape que rellena MissionForm para validar antes de crear/editar una misión. */
export interface MissionFieldsToValidate {
  type: MissionType
  dueDate: string | null
  daysMode: 'all' | 'specific'
  selectedDays: number[]
  hasEndDate: boolean
  endDate: string | null
}

/**
 * Valida los campos de un formulario de misión (creación o edición) antes de llamar a
 * createMission/updateMission. Devuelve el primer mensaje de error encontrado, o null si todo
 * es válido. Reutilizado por MissionForm en ambos modos para no duplicar estas comprobaciones.
 */
export function validateMissionFields(fields: MissionFieldsToValidate): string | null {
  const usesDueDate = fields.type === 'task' || fields.type === 'boss'

  if (usesDueDate && !fields.dueDate) {
    return fields.type === 'boss' ? 'Los Bosses necesitan una fecha de resultado.' : 'Las tareas necesitan una fecha límite.'
  }

  if (fields.type === 'routine' && fields.daysMode === 'specific' && fields.selectedDays.length === 0) {
    return 'Elige al menos un día para la rutina, o vuelve a "Todos los días".'
  }

  if (fields.type === 'routine' && fields.hasEndDate && !fields.endDate) {
    return 'Elige la fecha de fin, o desactiva esa opción.'
  }

  return null
}

export interface CreateMissionInput {
  adventureRunId: string
  type: MissionType
  name: string
  description: string | null
  difficulty: Difficulty
  primaryAttribute: Attribute
  secondaryAttribute: Attribute | null
  dueDate: string | null
  dueTime: string | null
  /** Días ISO (1=Lunes..7=Domingo), o null para "todos los días". Solo se persiste si type = 'routine' (mission_routine_fields_check, backend/024_routine_days_and_end_date.sql). */
  daysOfWeek: number[] | null
  /** Último día (inclusive) en que la rutina genera ocurrencia, o null para "sin fecha de fin". Solo se persiste si type = 'routine'. */
  endDate: string | null
}

export async function createMission(input: CreateMissionInput): Promise<MissionRow> {
  const { data, error } = await supabase
    .from('mission')
    .insert({
      adventure_run_id: input.adventureRunId,
      type: input.type,
      name: input.name,
      description: input.description,
      difficulty: input.difficulty,
      primary_attribute: input.primaryAttribute,
      secondary_attribute: input.secondaryAttribute,
      ...normalizeMissionFieldsByType(input.type, input),
    })
    .select()
    .single()

  if (error) throw error
  return data as MissionRow
}

export interface UpdateMissionInput {
  name: string
  description: string | null
  difficulty: Difficulty
  primaryAttribute: Attribute
  secondaryAttribute: Attribute | null
  dueDate: string | null
  dueTime: string | null
  daysOfWeek: number[] | null
  endDate: string | null
}

/** SQLSTATE que PostgREST asigna a "0 (o más de 1) fila devuelta" cuando se usa `.single()` — aquí
 * significa que el `.eq('status', 'active')` de updateMission no encontró la misión, típicamente
 * porque se resolvió (completó/falló/se borró) entre que se abrió el formulario de edición y que
 * se guardó. */
const NO_ROW_RETURNED_ERRCODE = 'PGRST116'

/**
 * Edita el nombre/descripción/dificultad/atributos de una Tarea o Rutina ya creada, y para
 * Tareas su due_date, o para Rutinas su days_of_week/end_date. El tipo NO es editable: se recibe
 * aquí solo para (a) normalizar los campos igual que createMission y (b) como guarda adicional
 * `.eq('type', type)` que impide que el update lo reescriba. Los Boss quedan fuera de este
 * alcance — se rechazan explícitamente en vez de solo ocultar el botón en la UI.
 *
 * Estos cambios son puramente prospectivos, sin recálculo retroactivo, por diseño ya existente
 * en el resto del sistema (no hace falta ninguna migración de datos al editar):
 * - mission_occurrence/history_event ya escritos son inmutables — ninguna función los reabre ni
 *   los regenera al cambiar la misión (ver completeRoutineOccurrence, processExpiredMissions).
 * - computeRoutineStreak (más arriba) solo lee mission_occurrence ya existentes; nunca vuelve a
 *   evaluar days_of_week/end_date contra el histórico, así que la racha no se ve afectada.
 * - isDayApplicable/MissionList evalúan siempre contra los valores ACTUALES de `mission`, en
 *   cada render — por eso un days_of_week/end_date nuevo aplica desde ya para "hoy en adelante"
 *   sin tocar ninguna fila pasada.
 *
 * `.eq('status', 'active')` evita editar una misión que dejó de estar activa entre que se abrió
 * el formulario y que se guardó (p.ej. processExpiredMissions la venció); si eso ocurre, `.single()`
 * no devuelve fila y se lanza un error legible en vez del genérico de PostgREST.
 */
export async function updateMission(
  missionId: string,
  type: Exclude<MissionType, 'boss'>,
  input: UpdateMissionInput,
): Promise<MissionRow> {
  const { data, error } = await supabase
    .from('mission')
    .update({
      name: input.name,
      description: input.description,
      difficulty: input.difficulty,
      primary_attribute: input.primaryAttribute,
      secondary_attribute: input.secondaryAttribute,
      ...normalizeMissionFieldsByType(type, input),
    })
    .eq('id', missionId)
    .eq('type', type)
    .eq('status', 'active')
    .select()
    .single()

  if (error) {
    if (error.code === NO_ROW_RETURNED_ERRCODE) {
      throw new Error('Esta misión ya no está activa, así que no se puede editar.')
    }
    throw error
  }

  return data as MissionRow
}

export interface CompletionOutcome {
  character: CharacterRow
  attributeProgress: AttributeProgressRow[]
  /** Recompensas de rango (documento 12.3) concedidas al cruzar de rango con esta subida de nivel, en orden. Vacío si no se ha cruzado ningún rango. */
  rankRewards: RankRewardOutcome[]
  /** Desglose de XP concedida (documento 15.2), para que cada caller construya su propio history_event ('mission_completed'/'boss_won') sin recalcular xpForMissionCompletion. */
  xpGained: MissionXpBreakdown
  /** No nulo si esta finalización acaba de desbloquear 'mission_after_damage' (De vuelta al camino, documento 14.11, Tanda 3). Siempre null para Bosses (resolveBossVictory): ver comentario en applyMissionCompletionXp. */
  achievementUnlocked: AchievementProgressRow | null
}

export interface MissionXpBreakdown {
  general: number
  primary: number
  /** null si la misión no tenía atributo secundario. */
  secondary: number | null
}

export interface RankRewardOutcome {
  itemId: ItemId
  /** No nulo si había espacio y se entregó directamente a inventory_item. */
  inventoryItem: InventoryItemRow | null
  /** No nulo si no había espacio (documento 12.4) y se guardó en pending_reward. */
  pendingReward: PendingRewardRow | null
}

function mergeInventoryRow(rows: InventoryItemRow[], updated: InventoryItemRow): InventoryItemRow[] {
  const exists = rows.some((row) => row.id === updated.id)
  return exists ? rows.map((row) => (row.id === updated.id ? updated : row)) : [...rows, updated]
}

/**
 * Concede, en orden, las recompensas de todos los rangos cruzados entre
 * oldLevel y newLevel (rankRewardIfCrossed, rules-engine). Para cada una,
 * comprueba el stock actual de ese objeto (canAddItemToInventory): si cabe,
 * la entrega directamente en inventory_item; si no, la guarda en
 * pending_reward (documento 12.4). Secuencial (no Promise.all) porque cada
 * comprobación de stock depende de la cantidad ya persistida, y en teoría
 * rankRewardIfCrossed podría devolver el mismo item_id más de una vez si se
 * cruzan varios rangos de golpe.
 */
async function grantRankRewards(
  adventureRunId: string,
  oldLevel: number,
  newLevel: number,
): Promise<RankRewardOutcome[]> {
  const itemIds = rankRewardIfCrossed(oldLevel, newLevel) as ItemId[]
  const results: RankRewardOutcome[] = []

  for (const itemId of itemIds) {
    const existing = await fetchInventoryItem(adventureRunId, itemId)
    const currentQuantity = existing?.quantity ?? 0

    if (canAddItemToInventory(itemId, currentQuantity)) {
      const { data, error } = await supabase
        .from('inventory_item')
        .upsert(
          { adventure_run_id: adventureRunId, item_id: itemId, quantity: currentQuantity + 1 },
          { onConflict: 'adventure_run_id,item_id' },
        )
        .select()
        .single()

      if (error) throw error
      results.push({ itemId, inventoryItem: data as InventoryItemRow, pendingReward: null })
    } else {
      const { data, error } = await supabase
        .from('pending_reward')
        .insert({ adventure_run_id: adventureRunId, item_id: itemId })
        .select()
        .single()

      if (error) throw error
      results.push({ itemId, inventoryItem: null, pendingReward: data as PendingRewardRow })
    }
  }

  return results
}

/** Contadores acumulados a incrementar en la misma actualización de "character" que aplica la XP (Tanda 2 de logros). */
interface CounterIncrements {
  missionsCompletedCount?: number
  bossesWonCount?: number
}

/**
 * Aplica la XP de completar una misión (rules-engine) y persiste el
 * character/attribute_progress resultante. Común a tareas, ocurrencias de
 * rutina y victorias de Boss, que solo difieren en qué fila marcan como
 * resuelta, en las monedas fijas que se suman además de las de subir de
 * nivel (`bonusCoins`, 0 para tareas/rutinas) y en qué contador acumulado de
 * logros incrementan (`counterIncrements`: misiones para tareas/rutinas,
 * Bosses vencidos para Boss — son categorías de logro separadas, documento
 * 14.3 y 14.5). coins_earned_total sube siempre que coinsGained > 0, tanto
 * por subir de nivel como por bonusCoins de Boss (documento 14.10).
 *
 * `counterIncrements.missionsCompletedCount` también distingue, para la
 * Tanda 3, si esto es una misión "de verdad" (Tarea/Rutina) o una Victoria
 * de Boss: completion_streak_days, flawless_streak y
 * attribute_last_completed (Constancia, Camino impecable, Regreso triunfal,
 * Maestro versátil) están confirmados como exclusivos de Tarea/Rutina, así
 * que solo se actualizan cuando ese contador sube (isRealMission); una
 * Victoria de Boss dejará estas 3 columnas intactas.
 */
async function applyMissionCompletionXp(
  mission: MissionRow,
  character: CharacterRow,
  attributeProgress: AttributeProgressRow[],
  bonusCoins = 0,
  counterIncrements: CounterIncrements = {},
): Promise<CompletionOutcome> {
  const byAttribute = new Map(attributeProgress.map((row) => [row.attribute, row]))
  const primaryRow = byAttribute.get(mission.primary_attribute)
  const secondaryRow = mission.secondary_attribute ? byAttribute.get(mission.secondary_attribute) : undefined

  if (!primaryRow) {
    throw new Error(`No hay attribute_progress para ${mission.primary_attribute}`)
  }
  if (mission.secondary_attribute && !secondaryRow) {
    throw new Error(`No hay attribute_progress para ${mission.secondary_attribute}`)
  }

  const result = xpForMissionCompletion({
    difficulty: mission.difficulty,
    primaryAttribute: mission.primary_attribute,
    secondaryAttribute: mission.secondary_attribute,
    generalState: { level: character.level, currentXp: character.current_xp },
    primaryAttributeState: { level: primaryRow.level, currentXp: primaryRow.current_xp },
    secondaryAttributeState: secondaryRow
      ? { level: secondaryRow.level, currentXp: secondaryRow.current_xp }
      : null,
  })

  const coinsGained =
    (result.general.levelsGained > 0 ? coinsForLevelsGained(character.level, result.general.level) : 0) + bonusCoins

  const isRealMission = (counterIncrements.missionsCompletedCount ?? 0) > 0
  const today = todayLocalDateString()

  const { data: updatedCharacter, error: characterError } = await supabase
    .from('character')
    .update({
      level: result.general.level,
      current_xp: result.general.currentXp,
      coins: character.coins + coinsGained,
      coins_earned_total: character.coins_earned_total + coinsGained,
      missions_completed_count: character.missions_completed_count + (counterIncrements.missionsCompletedCount ?? 0),
      bosses_won_count: character.bosses_won_count + (counterIncrements.bossesWonCount ?? 0),
      ...(isRealMission
        ? {
            completion_streak_days: nextCompletionStreakDays(
              character.completion_streak_days,
              character.last_completion_date,
              today,
            ),
            last_completion_date: today,
            flawless_streak: character.flawless_streak + 1,
            attribute_last_completed: { ...character.attribute_last_completed, [mission.primary_attribute]: today },
          }
        : {}),
    })
    .eq('id', character.id)
    .select()
    .single()

  if (characterError) throw characterError

  // De vuelta al camino (mission_after_damage, documento 14.11, Tanda 3):
  // exclusivo de Tarea/Rutina (misma exclusión de Bosses que arriba) — por
  // eso se comprueba mission_damage_taken (solo lo pone en true
  // processExpiredMissions) y no min_hp_reached_this_run, que también baja
  // con una Derrota de Boss (backend/019_mission_damage_taken.sql).
  // mission_damage_taken no cambia con una finalización de misión, así que
  // el valor de `character` (previo a este update) ya refleja correctamente
  // si hubo un fallo de misión real antes de este momento.
  const achievementUnlocked =
    isRealMission && character.mission_damage_taken
      ? await unlockAchievementDirect(character.adventure_run_id, 'mission_after_damage')
      : null

  const updatedAttributeRows: AttributeProgressRow[] = []

  const { data: updatedPrimary, error: primaryError } = await supabase
    .from('attribute_progress')
    .update({
      level: result.primaryAttributeResult.level,
      current_xp: result.primaryAttributeResult.currentXp,
    })
    .eq('id', primaryRow.id)
    .select()
    .single()

  if (primaryError) throw primaryError
  updatedAttributeRows.push(updatedPrimary as AttributeProgressRow)

  if (secondaryRow && result.secondaryAttributeResult) {
    const { data: updatedSecondary, error: secondaryError } = await supabase
      .from('attribute_progress')
      .update({
        level: result.secondaryAttributeResult.level,
        current_xp: result.secondaryAttributeResult.currentXp,
      })
      .eq('id', secondaryRow.id)
      .select()
      .single()

    if (secondaryError) throw secondaryError
    updatedAttributeRows.push(updatedSecondary as AttributeProgressRow)
  }

  const attributeProgressAfter = attributeProgress.map(
    (row) => updatedAttributeRows.find((updated) => updated.id === row.id) ?? row,
  )

  const rankRewards =
    result.general.levelsGained > 0
      ? await grantRankRewards(character.adventure_run_id, character.level, result.general.level)
      : []

  // 'level_up'/'rank_changed' (documento 15.2) son comunes a las tres formas
  // de completar una misión (tarea, ocurrencia de rutina, Victoria de Boss),
  // así que se registran aquí una sola vez en vez de en cada caller.
  if (result.general.levelsGained > 0) {
    await logHistoryEvent(character.adventure_run_id, 'level_up', {
      from_level: character.level,
      to_level: result.general.level,
      levels_gained: result.general.levelsGained,
    })

    const oldRank = rankForLevel(character.level).name
    const newRank = rankForLevel(result.general.level).name
    if (oldRank !== newRank) {
      await logHistoryEvent(character.adventure_run_id, 'rank_changed', {
        from_rank: oldRank,
        to_rank: newRank,
      })
    }
  }

  // Math.floor: mismo redondeo hacia abajo que aplica xpForMissionCompletion
  // (rules-engine/xp.ts) al XP secundario real (cambio de diseño confirmado,
  // ya no es la fracción exacta del documento original) — este valor es solo
  // para el desglose de display/history_event, así que tiene que coincidir
  // con el que de verdad se sumó a attribute_progress.current_xp.
  const xpGained: MissionXpBreakdown = {
    general: result.xpGained,
    primary: result.xpGained,
    secondary: result.secondaryAttributeResult ? Math.floor(result.xpGained * SECONDARY_ATTRIBUTE_XP_SHARE) : null,
  }

  return {
    character: updatedCharacter as CharacterRow,
    attributeProgress: attributeProgressAfter,
    rankRewards,
    xpGained,
    achievementUnlocked,
  }
}

// --- Fase 6: Rangos --------------------------------------------------------

export async function fetchPendingRewards(adventureRunId: string): Promise<PendingRewardRow[]> {
  const { data, error } = await supabase
    .from('pending_reward')
    .select()
    .eq('adventure_run_id', adventureRunId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as PendingRewardRow[]
}

export interface ResolvedPendingRewards {
  inventory: InventoryItemRow[]
  pendingRewards: PendingRewardRow[]
}

/**
 * Reclama, en orden de creación, las recompensas pendientes que ya caben en
 * la mochila (documento 12.4: "puede reclamarse cuando exista espacio").
 * Se llama al cargar el Dashboard; no hace falta que sea instantáneo, así
 * que no hay ningún mecanismo en tiempo real ni trigger en base de datos.
 */
export async function resolvePendingRewards(
  adventureRunId: string,
  pendingRewards: PendingRewardRow[],
  inventory: InventoryItemRow[],
): Promise<ResolvedPendingRewards> {
  const quantityByItemId = new Map(inventory.map((row) => [row.item_id, row.quantity]))
  let updatedInventory = inventory
  const stillPending: PendingRewardRow[] = []

  for (const reward of pendingRewards) {
    const currentQuantity = quantityByItemId.get(reward.item_id) ?? 0

    if (!canAddItemToInventory(reward.item_id, currentQuantity)) {
      stillPending.push(reward)
      continue
    }

    const { data, error } = await supabase
      .from('inventory_item')
      .upsert(
        { adventure_run_id: adventureRunId, item_id: reward.item_id, quantity: currentQuantity + 1 },
        { onConflict: 'adventure_run_id,item_id' },
      )
      .select()
      .single()

    if (error) throw error

    const { error: deleteError } = await supabase.from('pending_reward').delete().eq('id', reward.id)
    if (deleteError) throw deleteError

    const updatedRow = data as InventoryItemRow
    quantityByItemId.set(reward.item_id, updatedRow.quantity)
    updatedInventory = mergeInventoryRow(updatedInventory, updatedRow)
  }

  return { inventory: updatedInventory, pendingRewards: stillPending }
}

/** Payload común de 'mission_completed' para tarea y ocurrencia de rutina (documento 15.2, ejemplo de 24 de julio). */
function missionCompletedPayload(
  mission: MissionRow,
  missionType: 'task' | 'routine',
  occurrenceDate: string | null,
  xpGained: MissionXpBreakdown,
): Record<string, unknown> {
  return {
    mission_id: mission.id,
    mission_name: mission.name,
    mission_type: missionType,
    difficulty: mission.difficulty,
    primary_attribute: mission.primary_attribute,
    secondary_attribute: mission.secondary_attribute,
    xp_general: xpGained.general,
    xp_primary: xpGained.primary,
    xp_secondary: xpGained.secondary,
    occurrence_date: occurrenceDate,
  }
}

export async function completeTaskMission(
  mission: MissionRow,
  character: CharacterRow,
  attributeProgress: AttributeProgressRow[],
): Promise<CompletionOutcome> {
  const outcome = await applyMissionCompletionXp(mission, character, attributeProgress, 0, {
    missionsCompletedCount: 1,
  })

  const { error } = await supabase
    .from('mission')
    .update({ status: 'completed', resolved_at: new Date().toISOString() })
    .eq('id', mission.id)

  if (error) throw error

  await logHistoryEvent(
    mission.adventure_run_id,
    'mission_completed',
    missionCompletedPayload(mission, 'task', null, outcome.xpGained),
  )

  return outcome
}

export async function completeRoutineOccurrence(
  mission: MissionRow,
  character: CharacterRow,
  attributeProgress: AttributeProgressRow[],
  occurrenceDate: string,
): Promise<CompletionOutcome> {
  // Defensa en profundidad: MissionList ya oculta el botón de completar en
  // días no aplicables o tras end_date, pero esta función es la que
  // realmente escribe en mission_occurrence, así que repite la validación
  // aquí por si se llega a llamar desde otro sitio con datos obsoletos.
  if (!isDayApplicable(mission, occurrenceDate)) {
    throw new Error(`${occurrenceDate} no es un día aplicable para la rutina ${mission.id}`)
  }
  if (mission.end_date !== null && occurrenceDate > mission.end_date) {
    throw new Error(`La rutina ${mission.id} ya finalizó el ${mission.end_date}`)
  }

  const outcome = await applyMissionCompletionXp(mission, character, attributeProgress, 0, {
    missionsCompletedCount: 1,
  })

  const { error } = await supabase.from('mission_occurrence').upsert(
    {
      mission_id: mission.id,
      occurrence_date: occurrenceDate,
      status: 'completed',
      resolved_at: new Date().toISOString(),
    },
    { onConflict: 'mission_id,occurrence_date' },
  )

  if (error) throw error

  await logHistoryEvent(
    mission.adventure_run_id,
    'mission_completed',
    missionCompletedPayload(mission, 'routine', occurrenceDate, outcome.xpGained),
  )

  return outcome
}

// --- Fase 5: Bosses ------------------------------------------------------

export async function fetchActiveCelestialHand(adventureRunId: string): Promise<ActiveCelestialHandRow | null> {
  const { data, error } = await supabase
    .from('active_celestial_hand')
    .select()
    .eq('adventure_run_id', adventureRunId)
    .maybeSingle()

  if (error) throw error
  return data as ActiveCelestialHandRow | null
}


export interface ItemActionOutcome {
  inventoryItem: InventoryItemRow
  /** No nulo la primera vez que se desbloquea el logro de evento único asociado a esta acción. */
  achievementUnlocked: AchievementProgressRow | null
}

/**
 * Activa la Mano Celestial (documento 8.11: "debe activarse antes de
 * conocer o registrar el resultado" — no basta con tenerla en la mochila).
 * Upsert sobre active_celestial_hand (unique por adventure_run_id) igual
 * que activateShield, y decrementa la mochila en 1. Desbloquea también
 * 'celestial_hand_used_first' (La parada celestial, documento 14.9) la
 * primera vez que se usa.
 */
export async function activateCelestialHand(
  adventureRunId: string,
  inventoryItem: InventoryItemRow,
): Promise<ItemActionOutcome> {
  const { error } = await supabase
    .from('active_celestial_hand')
    .upsert({ adventure_run_id: adventureRunId, activated_at: new Date().toISOString() }, { onConflict: 'adventure_run_id' })

  if (error) throw error

  const [updatedInventoryItem, achievementUnlocked] = await Promise.all([
    decrementInventoryItem(inventoryItem),
    unlockAchievementDirect(adventureRunId, 'celestial_hand_used_first'),
  ])

  // Mano Celestial no tiene su propio event_type: el documento (15.2) solo
  // lista "Objetos utilizados" como categoría genérica, así que se registra
  // como 'item_used' igual que una poción, sin heal_amount.
  await logHistoryEvent(adventureRunId, 'item_used', {
    item_id: inventoryItem.item_id,
    item_name: ITEM_CATALOG[inventoryItem.item_id].displayName,
    heal_amount: null,
  })

  return { inventoryItem: updatedInventoryItem, achievementUnlocked }
}

export interface BossVictoryOutcome extends CompletionOutcome {
  /** true si había una Mano Celestial activa y se ha consumido al resolver esta Victoria. */
  celestialHandConsumed: boolean
  /** No nulo si esta Victoria acaba de desbloquear 'boss_no_celestial_hand' (Sin miedo, documento 14.5). */
  achievementUnlocked: AchievementProgressRow | null
}

/**
 * Resuelve la Victoria de un Boss: concede toda la XP y, además de las
 * monedas por subir de nivel, las fijas de coinsForBossVictory (documento
 * 7.5). No causa daño. Si hay una Mano Celestial activa (active_celestial_hand,
 * no solo unidades sin activar en la mochila) se consume también al ganar
 * (documento 8.11, línea 1310: "Si se gana el Boss, también se consume").
 * Si NO había Mano Celestial activa, desbloquea 'boss_no_celestial_hand'
 * (Sin miedo, documento 14.5): es un evento único, no un contador.
 *
 * A diferencia de una Tarea/Rutina (applyMissionCompletionXp), la
 * persistencia no es una secuencia de updates/inserts sueltos: el cálculo
 * (xpForMissionCompletion, coinsForBossVictory/coinsForLevelsGained,
 * rankRewardIfCrossed + canAddItemToInventory) se sigue haciendo aquí con
 * rules-engine, pero la escritura se delega entera a resolve_boss_victory
 * (backend/023_resolve_boss_battle.sql), que aplica mission.status junto con
 * todas las consecuencias en una única transacción atómica con guard
 * (LV002 si la misión ya no está 'active' — ver isBossAlreadyResolvedError).
 * Esto es lo que cierra el bug de doble-aplicación: antes, mission.status y
 * las consecuencias se escribían en pasos sueltos sin guard, así que
 * reabrir una pantalla de batalla stale y volver a confirmar las aplicaba
 * dos veces.
 */
export async function resolveBossVictory(
  mission: MissionRow,
  character: CharacterRow,
  attributeProgress: AttributeProgressRow[],
  adventureRunId: string,
): Promise<BossVictoryOutcome> {
  const byAttribute = new Map(attributeProgress.map((row) => [row.attribute, row]))
  const primaryRow = byAttribute.get(mission.primary_attribute)
  const secondaryRow = mission.secondary_attribute ? byAttribute.get(mission.secondary_attribute) : undefined

  if (!primaryRow) {
    throw new Error(`No hay attribute_progress para ${mission.primary_attribute}`)
  }
  if (mission.secondary_attribute && !secondaryRow) {
    throw new Error(`No hay attribute_progress para ${mission.secondary_attribute}`)
  }

  const result = xpForMissionCompletion({
    difficulty: mission.difficulty,
    primaryAttribute: mission.primary_attribute,
    secondaryAttribute: mission.secondary_attribute,
    generalState: { level: character.level, currentXp: character.current_xp },
    primaryAttributeState: { level: primaryRow.level, currentXp: primaryRow.current_xp },
    secondaryAttributeState: secondaryRow
      ? { level: secondaryRow.level, currentXp: secondaryRow.current_xp }
      : null,
  })

  const bossCoins = coinsForBossVictory(mission.difficulty as BossType)
  const coinsGained =
    (result.general.levelsGained > 0 ? coinsForLevelsGained(character.level, result.general.level) : 0) + bossCoins

  // Reparto de recompensas de rango: mismo algoritmo secuencial que
  // grantRankRewards (comprobación de stock dependiente de lo ya repartido
  // en esta misma tanda), pero sin escribir todavía — el reparto solo se
  // aplica de verdad dentro de resolve_boss_victory.
  const rankRewardItemIds =
    result.general.levelsGained > 0 ? (rankRewardIfCrossed(character.level, result.general.level) as ItemId[]) : []
  const runningQuantities = new Map<ItemId, number>()
  const rankRewardDestinations: Array<{ itemId: ItemId; destination: 'inventory' | 'pending' }> = []
  for (const itemId of rankRewardItemIds) {
    if (!runningQuantities.has(itemId)) {
      const existing = await fetchInventoryItem(adventureRunId, itemId)
      runningQuantities.set(itemId, existing?.quantity ?? 0)
    }
    const currentQuantity = runningQuantities.get(itemId) as number
    if (canAddItemToInventory(itemId, currentQuantity)) {
      runningQuantities.set(itemId, currentQuantity + 1)
      rankRewardDestinations.push({ itemId, destination: 'inventory' })
    } else {
      rankRewardDestinations.push({ itemId, destination: 'pending' })
    }
  }
  const rankRewardInventoryItemIds = rankRewardDestinations
    .filter((d) => d.destination === 'inventory')
    .map((d) => d.itemId)
  const rankRewardPendingItemIds = rankRewardDestinations
    .filter((d) => d.destination === 'pending')
    .map((d) => d.itemId)

  const activeCelestialHandBefore = await fetchActiveCelestialHand(adventureRunId)
  const canUnlockNoCelestialHand = activeCelestialHandBefore === null
  const hadNoCelestialHandAchievementBefore = canUnlockNoCelestialHand
    ? await fetchAchievementProgressRow(adventureRunId, 'boss_no_celestial_hand')
    : null
  const noCelestialHandAchievement = canUnlockNoCelestialHand ? ACHIEVEMENT_BY_ID.get('boss_no_celestial_hand') : undefined

  const oldRank = result.general.levelsGained > 0 ? rankForLevel(character.level) : null
  const newRank = result.general.levelsGained > 0 ? rankForLevel(result.general.level) : null

  const xpSecondary = result.secondaryAttributeResult
    ? Math.floor(result.xpGained * SECONDARY_ATTRIBUTE_XP_SHARE)
    : null

  const rewardsRequestedAt = new Date().toISOString()

  const { error } = await supabase.rpc('resolve_boss_victory', {
    p_mission_id: mission.id,
    p_new_character_level: result.general.level,
    p_new_character_current_xp: result.general.currentXp,
    p_coins_gained: coinsGained,
    p_new_primary_attribute_level: result.primaryAttributeResult.level,
    p_new_primary_attribute_current_xp: result.primaryAttributeResult.currentXp,
    p_new_secondary_attribute_level: result.secondaryAttributeResult?.level ?? null,
    p_new_secondary_attribute_current_xp: result.secondaryAttributeResult?.currentXp ?? null,
    p_xp_general: result.xpGained,
    p_xp_primary: result.xpGained,
    p_xp_secondary: xpSecondary,
    p_rank_reward_inventory_item_ids: rankRewardInventoryItemIds,
    p_rank_reward_pending_item_ids: rankRewardPendingItemIds,
    p_old_rank_name: oldRank?.name ?? null,
    p_new_rank_name: newRank?.name ?? null,
    p_boss_no_celestial_hand_achievement_name: noCelestialHandAchievement?.name ?? null,
  })

  if (error) throw error

  const [updatedCharacter, updatedAttributeRows, achievementUnlocked, newPendingRewards] = await Promise.all([
    selectCharacter(adventureRunId),
    selectAttributeProgress(adventureRunId),
    canUnlockNoCelestialHand && !hadNoCelestialHandAchievementBefore
      ? fetchAchievementProgressRow(adventureRunId, 'boss_no_celestial_hand')
      : Promise.resolve(null),
    fetchNewPendingRewards(adventureRunId, rankRewardPendingItemIds, rewardsRequestedAt),
  ])

  if (!updatedCharacter) throw new Error(`character de ${adventureRunId} no existe tras resolve_boss_victory`)

  const inventoryRowsById = new Map<ItemId, InventoryItemRow>()
  for (const itemId of new Set(rankRewardInventoryItemIds)) {
    const row = await fetchInventoryItem(adventureRunId, itemId)
    if (row) inventoryRowsById.set(itemId, row)
  }

  let pendingIndex = 0
  const rankRewards: RankRewardOutcome[] = rankRewardDestinations.map(({ itemId, destination }) => {
    if (destination === 'inventory') {
      return { itemId, inventoryItem: inventoryRowsById.get(itemId) ?? null, pendingReward: null }
    }
    const pendingReward = newPendingRewards[pendingIndex] ?? null
    pendingIndex += 1
    return { itemId, inventoryItem: null, pendingReward }
  })

  return {
    character: updatedCharacter,
    attributeProgress: updatedAttributeRows,
    rankRewards,
    xpGained: { general: result.xpGained, primary: result.xpGained, secondary: xpSecondary },
    achievementUnlocked,
    celestialHandConsumed: activeCelestialHandBefore !== null,
  }
}

export interface BossDefeatAliveOutcome {
  type: 'alive'
  character: CharacterRow
  /** true si había una Mano Celestial activa y se ha consumido al resolver esta Derrota. */
  celestialHandConsumed: boolean
  totemItem: InventoryItemRow | null
  /** Logros de Tanda 3 desbloqueados por esta Derrota. Hoy solo puede traer 'totem_activated' (Bosses no cuentan para 'first_mission_failed', ver comentario en resolveBossDefeat); es un array, no un solo nullable, para no tener que cambiar la forma si una tanda futura añade otro unlock directo aquí. Vacío si ninguno era nuevo. */
  achievementsUnlocked: AchievementProgressRow[]
}

export interface BossDefeatDeadOutcome {
  type: 'dead'
  newGameState: GameState
}

export type BossDefeatOutcome = BossDefeatAliveOutcome | BossDefeatDeadOutcome

/**
 * Resuelve la Derrota de un Boss: no concede XP ni monedas. Aplica
 * damageForBossDefeat (rules-engine) según si hay una Mano Celestial activa
 * en active_celestial_hand (no basta con tener unidades sin activar en la
 * mochila) y el Tótem de la Inmortalidad (mismo mecanismo que
 * processExpiredMissions, vía applyDamageSequence). Si no había ninguna
 * Mano Celestial activa, no hay ningún efecto sobre daño ni inventario. Si
 * el daño mata al personaje, dispara el mismo reinicio atómico que un
 * vencimiento normal (die_and_restart_adventure, ya atómica y ya guardada
 * por su propio LV001 — esa rama no cambia).
 *
 * La rama en la que el personaje sobrevive sí cambia: en vez de una
 * secuencia de updates/inserts sueltos, delega la escritura entera a
 * resolve_boss_defeat_alive (backend/023_resolve_boss_battle.sql), que
 * aplica mission.status junto con el daño/consumo de Tótem en una única
 * transacción atómica con el mismo guard LV002 que resolveBossVictory (ver
 * isBossAlreadyResolvedError).
 */
export async function resolveBossDefeat(
  userId: string,
  gameState: GameState,
  mission: MissionRow,
): Promise<BossDefeatOutcome> {
  const adventureRunId = gameState.adventureRun.id
  const [activeCelestialHand, totemRow] = await Promise.all([
    fetchActiveCelestialHand(adventureRunId),
    fetchInventoryItem(adventureRunId, 'immortality_totem'),
  ])
  const hasCelestialHand = activeCelestialHand !== null
  const totemQuantity = totemRow?.quantity ?? 0
  const hasTotem = totemQuantity > 0

  const damage = damageForBossDefeat(hasCelestialHand)
  const { character } = gameState
  const result = applyDamageSequence(
    { level: character.level, currentXp: character.current_xp, currentHp: character.current_hp },
    [{ amount: damage }],
    hasTotem,
  )

  if (result.isDead) {
    const { error } = await supabase.rpc('die_and_restart_adventure', {
      p_adventure_run_id: adventureRunId,
    })

    // Misma tolerancia a la carrera de doble-montaje que en processExpiredMissions.
    if (error && !isAdventureRunAlreadyEndedError(error)) throw error

    const newGameState = await ensureActiveGameState(userId)
    return { type: 'dead', newGameState }
  }

  const totemAchievement = result.totemConsumed ? ACHIEVEMENT_BY_ID.get('totem_activated') : undefined
  const hadTotemAchievementBefore = result.totemConsumed
    ? await fetchAchievementProgressRow(adventureRunId, 'totem_activated')
    : null

  const { error } = await supabase.rpc('resolve_boss_defeat_alive', {
    p_mission_id: mission.id,
    p_new_current_hp: result.finalState.currentHp,
    p_damage_taken: damage,
    p_totem_consumed: result.totemConsumed,
    p_last_damage_date: todayLocalDateString(),
    p_totem_activated_achievement_name: totemAchievement?.name ?? null,
  })

  if (error) throw error

  const [updatedCharacter, updatedTotemItem, newTotemAchievement] = await Promise.all([
    selectCharacter(adventureRunId),
    result.totemConsumed ? fetchInventoryItem(adventureRunId, 'immortality_totem') : Promise.resolve(null),
    result.totemConsumed && !hadTotemAchievementBefore
      ? fetchAchievementProgressRow(adventureRunId, 'totem_activated')
      : Promise.resolve(null),
  ])

  if (!updatedCharacter) throw new Error(`character de ${adventureRunId} no existe tras resolve_boss_defeat_alive`)

  // 'first_mission_failed' (Una lección aprendida) NO se desbloquea aquí:
  // "misión" y "Boss" son categorías separadas en todo el proyecto
  // (missions_completed_count vs bosses_won_count, documento 14.3 vs 14.5) y
  // el propio nombre del logro es "fallar la PRIMERA MISIÓN", no "el primer
  // desafío" — perder un Boss no cuenta. Ese unlock vive solo en
  // processExpiredMissions (fallo real de Tarea/Rutina).
  return {
    type: 'alive',
    character: updatedCharacter,
    celestialHandConsumed: hasCelestialHand,
    totemItem: updatedTotemItem,
    achievementsUnlocked: newTotemAchievement ? [newTotemAchievement] : [],
  }
}

export async function deleteMission(mission: MissionRow): Promise<void> {
  const { error } = await supabase
    .from('mission')
    .update({ status: 'deleted', resolved_at: new Date().toISOString() })
    .eq('id', mission.id)

  if (error) throw error

  await logHistoryEvent(mission.adventure_run_id, 'mission_deleted', {
    mission_id: mission.id,
    mission_name: mission.name,
    mission_type: mission.type,
    difficulty: mission.difficulty,
  })
}

// --- Fase 4: monedas, mercado y mochila ---------------------------------

export async function fetchInventory(adventureRunId: string): Promise<InventoryItemRow[]> {
  const { data, error } = await supabase
    .from('inventory_item')
    .select()
    .eq('adventure_run_id', adventureRunId)
    .gt('quantity', 0)

  if (error) throw error
  return data as InventoryItemRow[]
}

async function fetchInventoryItem(adventureRunId: string, itemId: ItemId): Promise<InventoryItemRow | null> {
  const { data, error } = await supabase
    .from('inventory_item')
    .select()
    .eq('adventure_run_id', adventureRunId)
    .eq('item_id', itemId)
    .maybeSingle()

  if (error) throw error
  return data as InventoryItemRow | null
}

export async function fetchActiveShield(adventureRunId: string): Promise<ActiveShieldRow | null> {
  const { data, error } = await supabase
    .from('active_shield')
    .select()
    .eq('adventure_run_id', adventureRunId)
    .maybeSingle()

  if (error) throw error
  return data as ActiveShieldRow | null
}

async function deleteActiveShield(adventureRunId: string): Promise<void> {
  const { error } = await supabase.from('active_shield').delete().eq('adventure_run_id', adventureRunId)
  if (error) throw error
}

const SHIELD_TYPE_BY_ITEM_ID: Record<ShieldItemId, ShieldType> = {
  small_shield: 'small',
  large_shield: 'large',
}

export interface PurchaseOutcome {
  character: CharacterRow
  inventoryItem: InventoryItemRow
}

/**
 * Compra un objeto: descuenta su precio en monedas e incrementa (upsert) su
 * fila en inventory_item. `currentQuantity` es la cantidad que ya hay en
 * mochila de ese objeto, usada para comprobar el límite de stock
 * (canAddItemToInventory) antes de comprar.
 */
export async function purchaseItem(
  adventureRunId: string,
  character: CharacterRow,
  itemId: ItemId,
  currentQuantity: number,
): Promise<PurchaseOutcome> {
  const item = ITEM_CATALOG[itemId]

  if (character.coins < item.price) {
    throw new Error(`No hay monedas suficientes para comprar ${item.displayName}`)
  }
  if (!canAddItemToInventory(itemId, currentQuantity)) {
    throw new Error(`Se ha alcanzado el límite de mochila para ${item.displayName}`)
  }

  const { data: updatedCharacter, error: characterError } = await supabase
    .from('character')
    .update({
      coins: character.coins - item.price,
      market_purchases_count: character.market_purchases_count + 1,
    })
    .eq('id', character.id)
    .select()
    .single()

  if (characterError) throw characterError

  const { data: inventoryItem, error: inventoryError } = await supabase
    .from('inventory_item')
    .upsert(
      { adventure_run_id: adventureRunId, item_id: itemId, quantity: currentQuantity + 1 },
      { onConflict: 'adventure_run_id,item_id' },
    )
    .select()
    .single()

  if (inventoryError) throw inventoryError

  const updatedCharacterRow = updatedCharacter as CharacterRow
  await logHistoryEvent(adventureRunId, 'item_purchased', {
    item_id: itemId,
    item_name: item.displayName,
    price: item.price,
    coins_after: updatedCharacterRow.coins,
  })

  return { character: updatedCharacterRow, inventoryItem: inventoryItem as InventoryItemRow }
}

async function decrementInventoryItem(inventoryItem: InventoryItemRow): Promise<InventoryItemRow> {
  const { data, error } = await supabase
    .from('inventory_item')
    .update({ quantity: inventoryItem.quantity - 1 })
    .eq('id', inventoryItem.id)
    .select()
    .single()

  if (error) throw error
  return data as InventoryItemRow
}

export interface UsePotionOutcome {
  character: CharacterRow
  inventoryItem: InventoryItemRow
}

/** Usa una poción (potion/super_potion/hyper_potion): cura y decrementa la mochila en 1. */
export async function consumePotion(
  character: CharacterRow,
  itemId: ItemId,
  inventoryItem: InventoryItemRow,
): Promise<UsePotionOutcome> {
  const healAmount = healingAmountForItem(itemId)
  const healed = applyHealing(
    { level: character.level, currentXp: character.current_xp, currentHp: character.current_hp },
    healAmount,
  )

  const { data: updatedCharacter, error: characterError } = await supabase
    .from('character')
    .update({ current_hp: healed.currentHp, potions_used_count: character.potions_used_count + 1 })
    .eq('id', character.id)
    .select()
    .single()

  if (characterError) throw characterError

  const updatedInventoryItem = await decrementInventoryItem(inventoryItem)

  await logHistoryEvent(character.adventure_run_id, 'item_used', {
    item_id: itemId,
    item_name: ITEM_CATALOG[itemId].displayName,
    // Curación real (puede ser menor que healAmount si el HP estaba cerca del tope de 100, documento 8.6).
    heal_amount: healed.currentHp - character.current_hp,
  })

  return { character: updatedCharacter as CharacterRow, inventoryItem: updatedInventoryItem }
}

/**
 * Activa un escudo (small_shield/large_shield): upsert sobre active_shield
 * (unique por adventure_run_id) sustituye cualquier escudo activo anterior, y
 * decrementa la mochila en 1.
 */
export async function activateShield(
  adventureRunId: string,
  itemId: ShieldItemId,
  inventoryItem: InventoryItemRow,
): Promise<InventoryItemRow> {
  const { error: shieldError } = await supabase.from('active_shield').upsert(
    { adventure_run_id: adventureRunId, item_id: itemId, activated_at: new Date().toISOString() },
    { onConflict: 'adventure_run_id' },
  )

  if (shieldError) throw shieldError

  const updatedInventoryItem = await decrementInventoryItem(inventoryItem)

  await logHistoryEvent(adventureRunId, 'shield_activated', {
    item_id: itemId,
    item_name: ITEM_CATALOG[itemId].displayName,
    shield_type: SHIELD_TYPE_BY_ITEM_ID[itemId],
  })

  return updatedInventoryItem
}

/**
 * Usa la Cuerda Huida sobre una tarea: la marca 'evaded' (sin XP ni daño),
 * decrementa la mochila en 1 y desbloquea 'escape_rope_used' (Huida
 * estratégica, documento 14.9) la primera vez que se usa.
 */
/** Payload común de 'mission_evaded' para tarea y ocurrencia de rutina. */
function missionEvadedPayload(
  mission: MissionRow,
  missionType: 'task' | 'routine',
  occurrenceDate: string | null,
): Record<string, unknown> {
  return {
    mission_id: mission.id,
    mission_name: mission.name,
    mission_type: missionType,
    difficulty: mission.difficulty,
    occurrence_date: occurrenceDate,
  }
}

export async function applyEscapeRopeToTask(
  mission: MissionRow,
  inventoryItem: InventoryItemRow,
): Promise<ItemActionOutcome> {
  const { error } = await supabase
    .from('mission')
    .update({ status: 'evaded', resolved_at: new Date().toISOString() })
    .eq('id', mission.id)

  if (error) throw error

  const [updatedInventoryItem, achievementUnlocked] = await Promise.all([
    decrementInventoryItem(inventoryItem),
    unlockAchievementDirect(mission.adventure_run_id, 'escape_rope_used'),
  ])

  await logHistoryEvent(mission.adventure_run_id, 'mission_evaded', missionEvadedPayload(mission, 'task', null))

  return { inventoryItem: updatedInventoryItem, achievementUnlocked }
}

/** Usa la Cuerda Huida sobre la ocurrencia de hoy de una rutina: misma lógica que sobre una tarea. */
export async function applyEscapeRopeToRoutine(
  mission: MissionRow,
  occurrenceDate: string,
  inventoryItem: InventoryItemRow,
): Promise<ItemActionOutcome> {
  const { error } = await supabase.from('mission_occurrence').upsert(
    {
      mission_id: mission.id,
      occurrence_date: occurrenceDate,
      status: 'evaded',
      resolved_at: new Date().toISOString(),
    },
    { onConflict: 'mission_id,occurrence_date' },
  )

  if (error) throw error

  const [updatedInventoryItem, achievementUnlocked] = await Promise.all([
    decrementInventoryItem(inventoryItem),
    unlockAchievementDirect(mission.adventure_run_id, 'escape_rope_used'),
  ])

  await logHistoryEvent(
    mission.adventure_run_id,
    'mission_evaded',
    missionEvadedPayload(mission, 'routine', occurrenceDate),
  )

  return { inventoryItem: updatedInventoryItem, achievementUnlocked }
}

// --- Fase 3: vencimiento y muerte ---------------------------------------

interface ExpiredFailureEvent {
  dueAt: Date
  missionCreatedAtMs: number
  difficulty: Difficulty
  mission: MissionRow
  /** null para tareas; fecha (YYYY-MM-DD) de la ocurrencia para rutinas. */
  occurrenceDate: string | null
}

/**
 * Localiza misiones vencidas sin resolver entre las misiones activas dadas:
 * - Task: due_date (+due_time, o 23:59 si es null) ya pasado.
 * - Routine: cada día desde la creación de la misión hasta hoy (inclusive)
 *   que no tenga ya una fila en mission_occurrence y cuyo límite (23:59 de
 *   ese día) ya haya pasado.
 * Devuelve los eventos en orden cronológico de vencimiento, desempatando por
 * fecha de creación de la misión.
 */
export function computeExpiredFailureEvents(
  missions: MissionRow[],
  routineOccurrences: MissionOccurrenceRow[],
  now: Date,
): ExpiredFailureEvent[] {
  const today = localDateString(now)
  const resolvedOccurrenceDays = new Set(routineOccurrences.map((o) => `${o.mission_id}:${o.occurrence_date}`))
  const events: ExpiredFailureEvent[] = []

  for (const mission of missions) {
    // Un Boss nunca vence automáticamente (documento 7.6): sin esta guarda
    // explícita, caería en la rama de rutina de abajo (que asume "si no es
    // task, es routine") y generaría un evento de fallo por cada día
    // acumulado, aplicando daño automático que la regla prohíbe.
    if (mission.type === 'boss') continue

    const missionCreatedAtMs = new Date(mission.created_at).getTime()

    if (mission.type === 'task') {
      if (!mission.due_date) continue
      const dueAt = dueDateTimeLocal(mission.due_date, mission.due_time)
      if (dueAt.getTime() <= now.getTime()) {
        events.push({ dueAt, missionCreatedAtMs, difficulty: mission.difficulty, mission, occurrenceDate: null })
      }
      continue
    }

    const createdDate = localDateString(new Date(mission.created_at))
    // Acota el backfill a end_date si ya quedó atrás, para no generar ni
    // revisar ocurrencias más allá del cierre de la rutina. Si en cambio se
    // excluyera la misión entera de fetchActiveMissions una vez pasado
    // end_date, cualquier día sin resolver *anterior* al cierre (p. ej. el
    // usuario no abrió la app entre esa fecha y hoy) dejaría de evaluarse
    // para siempre — por eso el corte se hace aquí, no en la consulta.
    const rangeEnd = mission.end_date !== null && mission.end_date < today ? mission.end_date : today

    for (const day of localDateStringsBetween(createdDate, rangeEnd)) {
      if (!isDayApplicable(mission, day)) continue
      if (resolvedOccurrenceDays.has(`${mission.id}:${day}`)) continue

      const dueAt = dueDateTimeLocal(day, null)
      if (dueAt.getTime() <= now.getTime()) {
        events.push({ dueAt, missionCreatedAtMs, difficulty: mission.difficulty, mission, occurrenceDate: day })
      }
    }
  }

  events.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime() || a.missionCreatedAtMs - b.missionCreatedAtMs)
  return events
}

export interface ExpiredMissionsAliveOutcome {
  type: 'alive'
  character: CharacterRow
  failedTaskMissionIds: Set<string>
  failedRoutineOccurrences: { missionId: string; occurrenceDate: string }[]
  /** No nulo si alguno de los fallos resueltos acaba de desbloquear 'perfect_shield_defense' (Defensa perfecta, documento 14.9). */
  achievementUnlocked: AchievementProgressRow | null
}

export interface ExpiredMissionsDeadOutcome {
  type: 'dead'
  newGameState: GameState
}

export type ExpiredMissionsOutcome = ExpiredMissionsAliveOutcome | ExpiredMissionsDeadOutcome

/**
 * Replica el bucle de applyDamageSequence (rules-engine, mission-resolution.ts)
 * para encontrar qué evento concreto de la secuencia consumió el Tótem, ya
 * que esa función solo devuelve el booleano agregado `totemConsumed`, no el
 * índice. Determinista: mismo cálculo, misma entrada, mismo resultado.
 */
function findTotemConsumingEventIndex(startingHp: number, damageAmounts: number[], hasTotem: boolean): number | null {
  if (!hasTotem) return null

  let currentHp = startingHp
  for (let i = 0; i < damageAmounts.length; i++) {
    if (currentHp <= 0) break
    currentHp -= damageAmounts[i]
    if (currentHp <= 0) return i
  }
  return null
}

/**
 * Procesa las misiones vencidas sin resolver entre las misiones activas
 * dadas: calcula el daño acumulado (rules-engine), lo aplica en orden
 * cronológico y persiste el resultado. Consulta el escudo activo (si lo hay)
 * y si hay al menos un Tótem de la Inmortalidad en la mochila, y se los pasa
 * a damageForMissionFailure/applyDamageSequence tal cual.
 *
 * Si el personaje muere, dispara el reinicio atómico en Postgres
 * (die_and_restart_adventure) y devuelve el estado de la nueva
 * adventure_run ya lista para usar. Devuelve null si no había nada vencido.
 */
export async function processExpiredMissions(
  userId: string,
  gameState: GameState,
  missions: MissionRow[],
  now: Date = new Date(),
): Promise<ExpiredMissionsOutcome | null> {
  const routineMissionIds = missions.filter((m) => m.type === 'routine').map((m) => m.id)
  const routineOccurrences = await fetchOccurrencesForMissions(routineMissionIds)
  const events = computeExpiredFailureEvents(missions, routineOccurrences, now)

  if (events.length === 0) return null

  const [activeShieldRow, totemRow] = await Promise.all([
    fetchActiveShield(gameState.adventureRun.id),
    fetchInventoryItem(gameState.adventureRun.id, 'immortality_totem'),
  ])
  const activeShieldType: ShieldType | null = activeShieldRow
    ? SHIELD_TYPE_BY_ITEM_ID[activeShieldRow.item_id]
    : null
  const totemQuantity = totemRow?.quantity ?? 0
  const hasTotem = totemQuantity > 0

  // El escudo se aplica como mucho una vez: en cuanto el primer fallo
  // compatible lo consume (damageForMissionFailure no lo consume contra
  // Boss, pero Boss no existe todavía en esta fase), los eventos siguientes
  // ya no tienen escudo disponible.
  let shieldConsumed = false
  // 'perfect_shield_defense' (Defensa perfecta, documento 14.9): el escudo
  // dejó el daño de ese fallo en exactamente 0, no solo lo redujo.
  let perfectShieldDefense = false
  // Daño exacto de cada evento individual, en el mismo orden que `events`
  // (applyDamageSequence solo devuelve el HP final agregado, no el desglose
  // por evento): necesario para que cada 'mission_failed' (documento 15.2)
  // registre su propio daño, no solo el HP final del personaje.
  const damageAmounts: number[] = []
  const damageEvents = events.map((event) => {
    const failure = damageForMissionFailure(event.difficulty, shieldConsumed ? null : activeShieldType)
    if (failure.shieldConsumed) shieldConsumed = true
    if (failure.shieldConsumed && failure.damage === 0) perfectShieldDefense = true
    damageAmounts.push(failure.damage)
    return { amount: failure.damage }
  })

  const { character } = gameState
  const result = applyDamageSequence(
    { level: character.level, currentXp: character.current_xp, currentHp: character.current_hp },
    damageEvents,
    hasTotem,
  )

  if (result.isDead) {
    const { error } = await supabase.rpc('die_and_restart_adventure', {
      p_adventure_run_id: gameState.adventureRun.id,
    })

    // Tolera la carrera de doble-montaje de React StrictMode: si otra
    // invocación de processExpiredMissions ganó la carrera y ya reinició la
    // adventure_run, esta llamada llega tarde sobre una fila ya cerrada
    // (SQLSTATE LV001, "ya ha finalizado") y no es un fallo real, solo hay
    // que recoger el estado que la otra ya dejó listo.
    if (error && !isAdventureRunAlreadyEndedError(error)) throw error

    // La RPC ya dejó creada la nueva adventure_run activa (con su character
    // y sus 6 attribute_progress); ensureActiveGameState simplemente la
    // encuentra y la devuelve tal cual, sin insertar nada de nuevo.
    const newGameState = await ensureActiveGameState(userId)
    return { type: 'dead', newGameState }
  }

  const taskEvents = events.filter((e) => e.occurrenceDate === null)
  const routineEvents = events.filter((e) => e.occurrenceDate !== null)

  await Promise.all([
    ...taskEvents.map(async (event) => {
      const { error } = await supabase
        .from('mission')
        .update({ status: 'failed', resolved_at: now.toISOString() })
        .eq('id', event.mission.id)
      if (error) throw error
    }),
    ...routineEvents.map(async (event) => {
      const { error } = await supabase.from('mission_occurrence').upsert(
        {
          mission_id: event.mission.id,
          occurrence_date: event.occurrenceDate as string,
          status: 'failed',
          resolved_at: now.toISOString(),
        },
        { onConflict: 'mission_id,occurrence_date' },
      )
      if (error) throw error
    }),
  ])

  // Tanda 3: min_hp_reached_this_run baja con el HP final de la secuencia
  // (nunca sube); last_damage_date y mission_damage_taken solo se tocan si
  // algún evento de esta tanda dejó daño real (un escudo puede haber
  // llevado alguno a 0, y ese no cuenta como "recibir daño" para Intocable
  // ni para De vuelta al camino); flawless_streak siempre se resetea aquí
  // porque esta función solo produce mission_failed de Tarea/Rutina (los
  // Boss nunca vencen automáticamente, ver más arriba). mission_damage_taken
  // es exclusivo de esta función (nunca de resolveBossDefeat,
  // backend/019_mission_damage_taken.sql): a diferencia de
  // min_hp_reached_this_run, que ambas tocan, este solo debe reflejar daño
  // de una misión de verdad.
  const anyDamageDealt = damageAmounts.some((amount) => amount > 0)
  const { data: updatedCharacter, error: characterError } = await supabase
    .from('character')
    .update({
      current_hp: result.finalState.currentHp,
      min_hp_reached_this_run: Math.min(character.min_hp_reached_this_run, result.finalState.currentHp),
      ...(anyDamageDealt ? { last_damage_date: todayLocalDateString(), mission_damage_taken: true } : {}),
      flawless_streak: 0,
    })
    .eq('id', character.id)
    .select()
    .single()

  if (characterError) throw characterError

  // El personaje sigue vivo: si el escudo se consumió, ya no hay escudo
  // activo; si el Tótem se consumió, se gasta una unidad de la mochila (si
  // hubiera muerto del todo, die_and_restart_adventure ya habría borrado
  // inventory_item y active_shield enteros, así que no hace falta tocar nada).
  if (shieldConsumed) {
    await deleteActiveShield(gameState.adventureRun.id)
  }

  if (result.totemConsumed) {
    const { error: totemError } = await supabase
      .from('inventory_item')
      .update({ quantity: totemQuantity - 1 })
      .eq('adventure_run_id', gameState.adventureRun.id)
      .eq('item_id', 'immortality_totem')
    if (totemError) throw totemError

    const totemIndex = findTotemConsumingEventIndex(character.current_hp, damageAmounts, hasTotem)
    await logHistoryEvent(gameState.adventureRun.id, 'totem_activated', {
      context: 'mission_failure',
      source_name: totemIndex !== null ? events[totemIndex].mission.name : null,
    })

    await unlockAchievementDirect(gameState.adventureRun.id, 'totem_activated')
  }

  // Solo se registra en el historial si el personaje sigue vivo: si hubiera
  // muerto, die_and_restart_adventure ya habría borrado (o va a borrar, en
  // el propio commit atómico de la RPC) el history_event entero de esta
  // partida, así que insertar aquí (rama 'dead', más arriba) sería insertar
  // solo para acto seguido perderlo.
  await Promise.all(
    events.map((event, index) =>
      logHistoryEvent(gameState.adventureRun.id, 'mission_failed', {
        mission_id: event.mission.id,
        mission_name: event.mission.name,
        mission_type: event.mission.type as 'task' | 'routine',
        difficulty: event.difficulty,
        occurrence_date: event.occurrenceDate,
        damage: damageAmounts[index],
      }),
    ),
  )

  // Solo se intenta desbloquear si el personaje sigue vivo: si hubiera
  // muerto, die_and_restart_adventure ya habría borrado achievement_progress
  // entero más arriba, así que insertar aquí sería insertar solo para acto
  // seguido perderlo.
  const achievementUnlocked = perfectShieldDefense
    ? await unlockAchievementDirect(gameState.adventureRun.id, 'perfect_shield_defense')
    : null

  // Una lección aprendida (first_mission_failed, documento 14.11, Tanda 3):
  // idempotente vía unlockAchievementDirect, así que basta con llamarlo en
  // cada tanda de vencimientos; solo la primera vez de la partida inserta.
  // No se plumbea al tipo de retorno porque el único caller (Dashboard,
  // carga inicial) ya vuelve a leer achievement_progress fresco de la base
  // de datos justo después (fetchAchievementProgress), así que lo recoge
  // solo con este insert, sin necesitar el valor de vuelta aquí.
  await unlockAchievementDirect(gameState.adventureRun.id, 'first_mission_failed')

  return {
    type: 'alive',
    character: updatedCharacter as CharacterRow,
    failedTaskMissionIds: new Set(taskEvents.map((e) => e.mission.id)),
    failedRoutineOccurrences: routineEvents.map((e) => ({
      missionId: e.mission.id,
      occurrenceDate: e.occurrenceDate as string,
    })),
    achievementUnlocked,
  }
}

// --- Fase 7: Logros --------------------------------------------------------

export async function fetchAchievementProgress(adventureRunId: string): Promise<AchievementProgressRow[]> {
  const { data, error } = await supabase.from('achievement_progress').select().eq('adventure_run_id', adventureRunId)

  if (error) throw error
  return data as AchievementProgressRow[]
}

/**
 * Inserta una fila de achievement_progress por cada id de
 * newlyUnlockedIds (evaluateStateBasedAchievements, rules-engine) que no
 * esté ya en `existing`: esa función es pura y no sabe qué logros ya
 * estaban desbloqueados, así que esta es la capa que lo decide. Se llama al
 * cargar el Dashboard, igual que resolvePendingRewards. ignoreDuplicates
 * tolera la misma carrera de doble-montaje de React StrictMode que
 * ensureAttributeProgress.
 */
export async function unlockAchievements(
  adventureRunId: string,
  newlyUnlockedIds: string[],
  existing: AchievementProgressRow[],
): Promise<AchievementProgressRow[]> {
  const existingIds = new Set(existing.map((row) => row.achievement_id))
  const toInsert = newlyUnlockedIds.filter((id) => !existingIds.has(id))

  if (toInsert.length === 0) return existing

  const { error } = await supabase.from('achievement_progress').upsert(
    toInsert.map((achievementId) => ({ adventure_run_id: adventureRunId, achievement_id: achievementId })),
    { onConflict: 'adventure_run_id,achievement_id', ignoreDuplicates: true },
  )

  if (error) throw error

  // Un history_event por cada id realmente insertado (no uno agregado por
  // lote), aunque evaluateStateBasedAchievements pueda haber desbloqueado
  // varios a la vez (p.ej. varios logros de atributo de golpe).
  await Promise.all(
    toInsert.map(async (achievementId) => {
      const achievement = ACHIEVEMENT_BY_ID.get(achievementId)
      if (!achievement) return
      await logHistoryEvent(adventureRunId, 'achievement_unlocked', {
        achievement_id: achievement.id,
        achievement_name: achievement.name,
        category: achievement.category,
      })
    }),
  )

  return fetchAchievementProgress(adventureRunId)
}
