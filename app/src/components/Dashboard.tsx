import { useEffect, useRef, useState } from 'react'
import { evaluateStateBasedAchievements, ITEM_CATALOG, MAX_HP, rankForLevel, xpRequiredForLevel } from 'rules-engine'
import type { ItemId } from 'rules-engine'
import { supabase } from '../lib/supabase'
import { getErrorMessage } from '../lib/errors'
import {
  completeRoutineOccurrence,
  completeTaskMission,
  computeRoutineStreak,
  daysSinceLastDamage,
  deleteMission,
  ensureActiveGameState,
  ensureUserProfile,
  fetchAchievementProgress,
  fetchActiveCelestialHand,
  fetchActiveMissions,
  fetchActiveShield,
  fetchHistoryEvents,
  fetchInventory,
  fetchPendingRewards,
  fetchTodayOccurrences,
  processExpiredMissions,
  recoverMission,
  resolvePendingRewards,
  todayLocalDateString,
  unlockAchievements,
} from '../lib/gameApi'
import type {
  BossDefeatAliveOutcome,
  BossVictoryOutcome,
  ClaimTutorialRewardOutcome,
  GameState,
  RankRewardOutcome,
} from '../lib/gameApi'
import {
  BOSS_DIFFICULTIES,
  BOSS_DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  MISSION_TYPE_LABELS,
  attributeSummaryText,
  bossIllustration,
} from '../types/database'
import type {
  AchievementProgressRow,
  AdventureRunRow,
  AttributeProgressRow,
  CharacterRow,
  HistoryEventRow,
  InventoryItemRow,
  MissionRow,
  PendingRewardRow,
  PlayerCharacter,
  ShieldItemId,
  UserProfileRow,
} from '../types/database'
import type { BossType, Difficulty } from 'rules-engine'
import { AchievementsScreen } from './AchievementsScreen'
import { AttributesScreen } from './AttributesScreen'
import { BossBattleScreen } from './BossBattleScreen'
import { CharacterSelectOverlay } from './CharacterSelectOverlay'
import { HistoryScreen } from './HistoryScreen'
import { InventoryScreen } from './InventoryScreen'
import { MarketScreen } from './MarketScreen'
import { ChangePasswordForm } from './ChangePasswordForm'
import { MissionForm } from './MissionForm'
import { MissionList } from './MissionList'
import { RanksScreen } from './RanksScreen'
import { TutorialOverlay } from './TutorialOverlay'
import { BossMissionCard, Button, Card, LevelUpOverlay, Modal, ProgressBar, ScreenHeader } from './ui'

function isBossDifficulty(difficulty: Difficulty): difficulty is BossType {
  return (BOSS_DIFFICULTIES as Difficulty[]).includes(difficulty)
}

/** Mismo criterio que MissionList.tsx: etiqueta de nivel de amenaza (Menor/Importante/Legendario)
 * para Bosses, o la escala normal de estrellas-en-texto para Tarea/Rutina (aquí no aplica, pero
 * BossMissionCard es genérico). */
function difficultyLabel(difficulty: Difficulty): string {
  return isBossDifficulty(difficulty) ? BOSS_DIFFICULTY_LABELS[difficulty] : DIFFICULTY_LABELS[difficulty]
}

/** Cantidad por item_id (Tanda 2: Coleccionista/Preparado para el viaje dependen de la mochila entera, no solo del objeto que acaba de cambiar). */
function inventoryQuantities(inventory: InventoryItemRow[]): Partial<Record<ItemId, number>> {
  const quantities: Partial<Record<ItemId, number>> = {}
  for (const row of inventory) quantities[row.item_id] = row.quantity
  return quantities
}

/**
 * Extras que evaluateStateBasedAchievements necesita más allá de nivel/rango/
 * atributos: contadores acumulados, saldo de monedas y mochila (Tanda 2), y
 * racha de días, racha sin fallos, HP mínimo alcanzado, días sin daño y
 * fechas por atributo (Tanda 3). `today` viene del cierre del componente
 * (todayLocalDateString(), calculado una vez por render) para no recalcular
 * la fecha local dos veces en el mismo gesto.
 */
function buildAchievementExtras(
  character: CharacterRow,
  inventory: InventoryItemRow[],
  adventureRun: AdventureRunRow,
  today: string,
) {
  return {
    counters: {
      missionsCompletedCount: character.missions_completed_count,
      bossesWonCount: character.bosses_won_count,
      potionsUsedCount: character.potions_used_count,
      marketPurchasesCount: character.market_purchases_count,
      coinsEarnedTotal: character.coins_earned_total,
    },
    coinsHeld: character.coins,
    inventoryQuantities: inventoryQuantities(inventory),
    completionStreakDays: character.completion_streak_days,
    flawlessStreak: character.flawless_streak,
    minHpReachedThisRun: character.min_hp_reached_this_run,
    daysSinceLastDamage: daysSinceLastDamage(character, adventureRun, today),
    attributeLastCompletedDates: character.attribute_last_completed,
  }
}

/** Ids de achievement_progress ya conocidos localmente, sin duplicar si ya estaba (p.ej. tras recargar la pantalla de logros). */
function mergeAchievementRow(rows: AchievementProgressRow[], row: AchievementProgressRow): AchievementProgressRow[] {
  if (rows.some((r) => r.achievement_id === row.achievement_id)) return rows
  return [...rows, row]
}

interface DashboardProps {
  userId: string
}

type LoadState = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready' }

type ScreenTab = 'missions' | 'battles' | 'market' | 'inventory'

/** Subpestañas de la pantalla Misiones: filtro puramente visual sobre `nonBattleMissions`, los
 * Boss no participan (siguen solo en la pestaña Batallas). */
type MissionsSubTab = 'all' | 'task' | 'routine'

/** Margen de "Deshacer" tras pulsar Completar, antes de aplicar la XP de verdad. */
const UNDO_WINDOW_MS = 5000

/** Un ítem en cola para LevelUpOverlay: los datos que necesita para animar la subida (nivel/XP tal
 * como estaban justo antes de la acción) más el `finalize` que aplica el resultado real ya calculado
 * (mismo setGameState/applyRankRewards de siempre) en cuanto termina la animación. */
interface LevelUpQueueItem {
  id: number
  oldLevel: number
  oldXp: number
  xpGained: number
  rankRewards: RankRewardOutcome[]
  finalize: () => void
}

function upsertInventoryItem(prev: InventoryItemRow[], updated: InventoryItemRow): InventoryItemRow[] {
  const exists = prev.some((row) => row.id === updated.id)
  if (!exists) return [...prev, updated]
  return prev.map((row) => (row.id === updated.id ? updated : row))
}

/**
 * Un Boss pasa a "Batallas pendientes" en cuanto llega su fecha de resultado
 * (documento 7.6), sin componente de hora: a diferencia de una tarea, no hay
 * vencimiento automático que dependa de due_time, solo el día en que ya se
 * puede declarar el resultado.
 */
function isPendingBossBattle(mission: MissionRow, today: string): boolean {
  return mission.type === 'boss' && mission.due_date !== null && mission.due_date <= today
}

/** Color de la barra de HP del panel de estado: verde por encima del 50%, dorado entre 50% y
 * 25%, rojo por debajo del 25% (three-tier, no solo "bajo/normal" como antes). */
function hpBarColor(currentHp: number): string {
  const ratio = currentHp / MAX_HP
  if (ratio > 0.5) return 'var(--color-accent)'
  if (ratio > 0.25) return 'var(--color-accent-gold)'
  return 'var(--color-danger)'
}

export function Dashboard({ userId }: DashboardProps) {
  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' })
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [missions, setMissions] = useState<MissionRow[]>([])
  const [inventory, setInventory] = useState<InventoryItemRow[]>([])
  const [activeShieldItemId, setActiveShieldItemId] = useState<ShieldItemId | null>(null)
  const [celestialHandActive, setCelestialHandActive] = useState(false)
  const [pendingRewards, setPendingRewards] = useState<PendingRewardRow[]>([])
  const [achievementProgress, setAchievementProgress] = useState<AchievementProgressRow[]>([])
  const [completedTodayMissionIds, setCompletedTodayMissionIds] = useState<Set<string>>(new Set())
  // Racha por rutina (mission_id -> días consecutivos sin fallar), calculada una vez por carga junto
  // con el resto del estado — no se recalcula al completar/deshacer porque computeRoutineStreak
  // siempre salta el día de hoy, así que completar la ocurrencia de hoy no cambia el valor hasta la
  // próxima carga (mañana).
  const [routineStreaks, setRoutineStreaks] = useState<Record<string, number>>({})
  const [deathNotice, setDeathNotice] = useState(false)
  const [busyMissionId, setBusyMissionId] = useState<string | null>(null)
  const [screen, setScreen] = useState<ScreenTab>('missions')
  const [missionsSubTab, setMissionsSubTab] = useState<MissionsSubTab>('all')
  const [userProfile, setUserProfile] = useState<UserProfileRow | null>(null)
  const [activeOverlay, setActiveOverlay] = useState<
    'ranks' | 'achievements' | 'history' | 'tutorial' | 'attributes' | 'characterSelect' | null
  >(null)
  // No persistido (igual que EnsureUserProfileResult.justCreated en sí): solo hace falta recordarlo
  // entre el momento de cargar el perfil y el momento (asíncrono, tras elegir personaje) en que hay
  // que decidir si encadenar al Tutorial.
  const justCreatedProfileRef = useRef(false)
  const [historyEvents, setHistoryEvents] = useState<HistoryEventRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [battlingMission, setBattlingMission] = useState<MissionRow | null>(null)
  // Misión (Tarea/Rutina) que se está editando en el modal de MissionForm; null = modal cerrado.
  const [editingMission, setEditingMission] = useState<MissionRow | null>(null)
  // Controla el modal de Ajustes (cabecera): null = cerrado, 'menu' = opciones, 'changePassword' = formulario.
  const [settingsView, setSettingsView] = useState<'menu' | 'changePassword' | null>(null)
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false)
  // Misión id -> instante (epoch ms) en el que expira el margen de deshacer; solo para pintar la cuenta atrás.
  const [pendingCompletions, setPendingCompletions] = useState<Record<string, number>>({})
  // Los timeout ids viven en un ref (no en estado) porque son solo para poder cancelarlos, no para renderizar.
  const pendingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  // Subidas de nivel pendientes de animar en LevelUpOverlay: mientras haya una en cola, su
  // `finalize` (el setGameState/applyRankRewards que antes se aplicaba al instante) queda retenido
  // para que el HUD de fondo no muestre el nivel nuevo antes de que termine su animación. En cola
  // (no un solo valor) porque dos misiones pueden resolverse casi a la vez y ambas subir de nivel.
  const [levelUpQueue, setLevelUpQueue] = useState<LevelUpQueueItem[]>([])
  const levelUpIdRef = useRef(0)
  const today = todayLocalDateString()

  function enqueueLevelUp(item: Omit<LevelUpQueueItem, 'id'>) {
    levelUpIdRef.current += 1
    setLevelUpQueue((prev) => [...prev, { ...item, id: levelUpIdRef.current }])
  }

  // Si el Dashboard se desmonta (p.ej. cierre de sesión) durante el margen, cancelamos las
  // confirmaciones pendientes en vez de dejarlas disparar sobre un componente ya desmontado.
  useEffect(() => {
    return () => {
      Object.values(pendingTimeoutsRef.current).forEach(clearTimeout)
      pendingTimeoutsRef.current = {}
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [state, profileResult] = await Promise.all([ensureActiveGameState(userId), ensureUserProfile(userId)])
        const activeMissions = await fetchActiveMissions(state.adventureRun.id)

        // Antes de mostrar nada, resolvemos misiones/ocurrencias vencidas sin
        // resolver (posiblemente acumuladas de varios días) y aplicamos su
        // daño. Si eso mata al personaje, se dispara el reinicio atómico y
        // partimos de la nueva adventure_run en vez de la vieja.
        const expiredOutcome = await processExpiredMissions(userId, state, activeMissions)

        let finalState = state
        let finalMissions = activeMissions
        const failedTodayMissionIds = new Set<string>()

        if (expiredOutcome?.type === 'dead') {
          finalState = expiredOutcome.newGameState
          finalMissions = []
          if (!cancelled) setDeathNotice(true)
        } else if (expiredOutcome?.type === 'alive') {
          finalState = { ...state, character: expiredOutcome.character }
          finalMissions = activeMissions.filter((m) => !expiredOutcome.failedTaskMissionIds.has(m.id))
          for (const occurrence of expiredOutcome.failedRoutineOccurrences) {
            if (occurrence.occurrenceDate === today) failedTodayMissionIds.add(occurrence.missionId)
          }
        }

        const routineMissionIds = finalMissions.filter((m) => m.type === 'routine').map((m) => m.id)
        const occurrences = await fetchTodayOccurrences(routineMissionIds, today)
        const completedIds = new Set(occurrences.filter((o) => o.status === 'completed').map((o) => o.mission_id))
        failedTodayMissionIds.forEach((id) => completedIds.add(id))

        // Una consulta por rutina en paralelo (mismo patrón que ya usa esta carga para
        // por-item/por-mission), no una sola consulta acotada por adventure_run: cada racha corta
        // en su propio primer 'failed', así que no hay una forma de pedir "todas de golpe" sin
        // sobrepedir para las rutinas más longevas.
        const streakEntries = await Promise.all(
          routineMissionIds.map(async (id) => [id, await computeRoutineStreak(id)] as const),
        )
        const finalRoutineStreaks = Object.fromEntries(streakEntries)

        const finalInventory = await fetchInventory(finalState.adventureRun.id)
        const finalActiveShield = await fetchActiveShield(finalState.adventureRun.id)
        const finalActiveCelestialHand = await fetchActiveCelestialHand(finalState.adventureRun.id)

        // Reclama, si hay espacio, las recompensas de rango que quedaron
        // pendientes (documento 12.4) antes de mostrar la mochila.
        const finalPendingRewards = await fetchPendingRewards(finalState.adventureRun.id)
        const resolved = await resolvePendingRewards(finalState.adventureRun.id, finalPendingRewards, finalInventory)

        // Logros de estado (nivel, rango, atributos — Fase 7, tanda 1):
        // evaluateStateBasedAchievements es pura y solo dice qué se cumple
        // ahora mismo; unlockAchievements compara contra lo ya guardado y
        // solo inserta lo nuevo.
        const existingAchievements = await fetchAchievementProgress(finalState.adventureRun.id)
        const unlockedIds = evaluateStateBasedAchievements(
          {
            level: finalState.character.level,
            currentXp: finalState.character.current_xp,
            currentHp: finalState.character.current_hp,
          },
          finalState.attributeProgress.map((row) => ({ attribute: row.attribute, level: row.level })),
          buildAchievementExtras(finalState.character, resolved.inventory, finalState.adventureRun, today),
        )
        const finalAchievements = await unlockAchievements(finalState.adventureRun.id, unlockedIds, existingAchievements)

        if (cancelled) return
        setGameState(finalState)
        setMissions(finalMissions)
        setInventory(resolved.inventory)
        setActiveShieldItemId(finalActiveShield?.item_id ?? null)
        setCelestialHandActive(finalActiveCelestialHand !== null)
        setPendingRewards(resolved.pendingRewards)
        setAchievementProgress(finalAchievements)
        setCompletedTodayMissionIds(completedIds)
        setRoutineStreaks(finalRoutineStreaks)
        setUserProfile(profileResult.profile)
        justCreatedProfileRef.current = profileResult.justCreated
        // Selector de personaje y Tutorial se auto-lanzan como mucho una vez cada uno, nunca los
        // dos superpuestos (activeOverlay solo admite un valor). player_character === null es su
        // propio sentinel de "aún no ha elegido" (backend/022_player_character.sql) — a diferencia
        // de justCreated, no se resetea nunca solo, así que cubre tanto a cuentas nuevas como a
        // cuentas ya existentes que todavía no han elegido personaje. El Tutorial, si le toca
        // auto-lanzarse (justCreated), se pospone hasta después de handleCharacterSelected para no
        // superponer los dos overlays.
        if (profileResult.profile.player_character === null) {
          setActiveOverlay('characterSelect')
        } else if (profileResult.justCreated) {
          // Se auto-lanza SOLO la primerísima vez que se crea la fila de
          // user_profile (justCreated), no en cada carga mientras siga sin
          // reclamar: si el usuario lo cierra/salta sin completarlo, no vuelve
          // a aparecer solo — queda accesible solo a través del botón "Ver
          // tutorial". justCreated no es un flag persistido en Supabase: se
          // deduce en el momento (ensureUserProfile) de si el insert de esta
          // llamada tuvo éxito o la fila ya existía de una carga anterior.
          setActiveOverlay('tutorial')
        }
        setLoadState({ state: 'ready' })
      } catch (err) {
        if (cancelled) return
        setLoadState({ state: 'error', message: getErrorMessage(err) })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [userId, today])

  function handleComplete(mission: MissionRow) {
    // Ya está pendiente de confirmar (o en vuelo): ignoramos el doble click.
    if (pendingTimeoutsRef.current[mission.id]) return

    pendingTimeoutsRef.current[mission.id] = setTimeout(() => {
      delete pendingTimeoutsRef.current[mission.id]
      setPendingCompletions((prev) => {
        const next = { ...prev }
        delete next[mission.id]
        return next
      })
      void commitCompletion(mission)
    }, UNDO_WINDOW_MS)

    setPendingCompletions((prev) => ({
      ...prev,
      [mission.id]: Date.now() + UNDO_WINDOW_MS,
    }))
  }

  function handleUndo(mission: MissionRow) {
    const timeoutId = pendingTimeoutsRef.current[mission.id]
    if (!timeoutId) return

    clearTimeout(timeoutId)
    delete pendingTimeoutsRef.current[mission.id]
    setPendingCompletions((prev) => {
      const next = { ...prev }
      delete next[mission.id]
      return next
    })
  }

  /** Mochila resultante de aplicar las recompensas de rango (documento 12.3/12.4) de una subida de nivel; pura, para poder reusarla tanto al persistir el estado como al reevaluar logros con la mochila ya al día. */
  function inventoryAfterRankRewards(prev: InventoryItemRow[], rankRewards: RankRewardOutcome[]): InventoryItemRow[] {
    let next = prev
    for (const reward of rankRewards) {
      if (reward.inventoryItem) next = upsertInventoryItem(next, reward.inventoryItem)
    }
    return next
  }

  /** Refleja en el estado local las recompensas de rango (documento 12.3/12.4) concedidas por una subida de nivel. */
  function applyRankRewards(rankRewards: RankRewardOutcome[]) {
    if (rankRewards.length === 0) return

    setInventory((prev) => inventoryAfterRankRewards(prev, rankRewards))

    const newlyPending = rankRewards
      .map((reward) => reward.pendingReward)
      .filter((reward): reward is PendingRewardRow => reward !== null)
    if (newlyPending.length > 0) {
      setPendingRewards((prev) => [...prev, ...newlyPending])
    }
  }

  /**
   * Reevalúa contra el character/attributeProgress/inventory recién
   * actualizados los logros de estado y contador de las Tandas 1, 2 y 3
   * (evaluateStateBasedAchievements: nivel, rango, atributos, misiones,
   * Bosses, pociones, compras, monedas, mochila, constancia, y los de
   * supervivencia/fallos-recuperación derivables de un valor de estado ya
   * persistido) y desbloquea los que falten. Además de la carga inicial del
   * Dashboard, se llama tras cualquier acción que pueda cambiar alguno de
   * esos contadores o el estado actual (completar misión, Victoria/Derrota
   * de Boss, comprar, curarse, activar/usar un objeto de mochila), para que
   * la medalla aparezca al instante en vez de esperar al siguiente montaje.
   * También cubre 'no_damage_30_days' (Intocable), que se puede cruzar solo
   * por el paso del tiempo: se reevalúa aquí y en la carga inicial, ambas
   * veces con el `today` real del momento en que se llama.
   *
   * `inventory` y `existingAchievements` se reciben como parámetros (no se
   * leen del estado de React) porque en el momento de esta llamada pueden
   * haber cambiado ya en el mismo gesto (una recompensa de rango sobre la
   * mochila, o uno de los unlocks directos de evento único sobre
   * achievement_progress) antes de que el re-render que aplicaría
   * setInventory/setAchievementProgress se haya reflejado: el estado de
   * React (`inventory`, `achievementProgress`) que ve esta función mientras
   * no se ha vuelto a renderizar seguiría siendo el de antes del gesto. Pasar
   * ambos explícitamente evita que esta llamada pise, con un valor
   * desactualizado, el merge que un handler ya hizo dentro del mismo gesto.
   */
  async function applyStateBasedAchievementUnlocks(
    adventureRun: AdventureRunRow,
    character: CharacterRow,
    attributeProgress: AttributeProgressRow[],
    inventory: InventoryItemRow[],
    existingAchievements: AchievementProgressRow[],
  ) {
    const unlockedIds = evaluateStateBasedAchievements(
      { level: character.level, currentXp: character.current_xp, currentHp: character.current_hp },
      attributeProgress.map((row) => ({ attribute: row.attribute, level: row.level })),
      buildAchievementExtras(character, inventory, adventureRun, today),
    )
    const updated = await unlockAchievements(adventureRun.id, unlockedIds, existingAchievements)
    setAchievementProgress(updated)
  }

  /** Llamada real a Supabase (XP + estado definitivo), disparada solo tras agotarse el margen de deshacer. */
  async function commitCompletion(mission: MissionRow) {
    if (!gameState) return
    setBusyMissionId(mission.id)
    try {
      const outcome =
        mission.type === 'task'
          ? await completeTaskMission(mission, gameState.character, gameState.attributeProgress)
          : await completeRoutineOccurrence(mission, gameState.character, gameState.attributeProgress, today)

      // Nivel/XP tal como estaban justo antes de esta finalización: si esto sube de nivel, es lo
      // que LevelUpOverlay necesita como punto de partida de la animación.
      const oldCharacter = gameState.character
      // Aplica al HUD el resultado ya calculado (setGameState/applyRankRewards/lista de misiones);
      // se llama al instante si no hubo subida de nivel, o se retiene hasta que LevelUpOverlay
      // termine su animación si sí la hubo (ver enqueueLevelUp más abajo).
      const finalizeCompletion = () => {
        setGameState({
          ...gameState,
          character: outcome.character,
          attributeProgress: outcome.attributeProgress,
        })
        applyRankRewards(outcome.rankRewards)
        if (mission.type === 'task') {
          setMissions((prev) => prev.filter((m) => m.id !== mission.id))
        } else {
          setCompletedTodayMissionIds((prev) => new Set(prev).add(mission.id))
        }
      }

      const inventoryAfter = inventoryAfterRankRewards(inventory, outcome.rankRewards)
      // achievementUnlocked ('mission_after_damage', Tanda 3) ya está en la
      // base de datos; se incorpora a la lista base (ver comentario en
      // handleCelestialHandActivated) en vez de con un setAchievementProgress
      // aparte, para que applyStateBasedAchievementUnlocks no lo pise más abajo.
      const achievementsBase = outcome.achievementUnlocked
        ? mergeAchievementRow(achievementProgress, outcome.achievementUnlocked)
        : achievementProgress
      // Completar una misión sube XP general, de atributo, y el contador
      // missions_completed_count: puede cruzar un umbral de nivel, rango,
      // atributo, número de misiones completadas, racha de constancia,
      // racha sin fallos o fecha por atributo (Tanda 3). Esto se evalúa ya mismo (no se retiene
      // como el HUD) porque no es visible detrás del overlay de subida de nivel.
      await applyStateBasedAchievementUnlocks(
        gameState.adventureRun,
        outcome.character,
        outcome.attributeProgress,
        inventoryAfter,
        achievementsBase,
      )

      if (outcome.character.level > oldCharacter.level) {
        enqueueLevelUp({
          oldLevel: oldCharacter.level,
          oldXp: oldCharacter.current_xp,
          xpGained: outcome.xpGained.general,
          rankRewards: outcome.rankRewards,
          finalize: finalizeCompletion,
        })
      } else {
        finalizeCompletion()
      }
    } catch (err) {
      setLoadState({ state: 'error', message: getErrorMessage(err) })
    } finally {
      setBusyMissionId(null)
    }
  }

  async function handleDelete(mission: MissionRow) {
    // Defensa además del botón deshabilitado en la UI: no se puede borrar una misión pendiente de confirmar.
    if (pendingCompletions[mission.id] !== undefined) return

    setBusyMissionId(mission.id)
    try {
      await deleteMission(mission)
      setMissions((prev) => prev.filter((m) => m.id !== mission.id))
    } catch (err) {
      setLoadState({ state: 'error', message: getErrorMessage(err) })
    } finally {
      setBusyMissionId(null)
    }
  }

  /** Compartido por el formulario de creación y el de edición: si el id ya existe en el estado
   * local lo reemplaza (edición), si no lo añade (creación) — sin refetch, para que un cambio de
   * days_of_week/end_date que saque a la misión de "activas hoy" se refleje ya en este mismo render. */
  function handleMissionSaved(mission: MissionRow) {
    setMissions((prev) => {
      const index = prev.findIndex((m) => m.id === mission.id)
      if (index === -1) return [...prev, mission]
      const next = [...prev]
      next[index] = mission
      return next
    })
    setEditingMission(null)
  }

  /** Deshace un `handleDelete` desde el Historial (HistoryScreen). A diferencia de handleDelete,
   * no usa `setLoadState` en el catch: un fallo aquí (p.ej. otra pestaña ya la recuperó) se
   * muestra inline junto al botón "Recuperar" en vez de tumbar toda la pantalla, así que se
   * relanza el error para que HistoryScreen lo capture y lo pinte donde ocurrió.
   *
   * Si es una Rutina, `routineStreaks` (calculado una sola vez al cargar, línea ~281) no tiene
   * entrada para esta misión porque no existía como activa en esa carga — sin este paso, el badge
   * de racha caería a 0 (MissionList.tsx: `routineStreaks[mission.id] ?? 0`) aunque
   * mission_occurrence siga con los días completados intactos. Se recalcula igual que en la carga
   * inicial, con el mismo computeRoutineStreak, para que el badge muestre la racha real sin
   * necesidad de recargar la página. */
  async function handleRecoverMission(missionId: string): Promise<void> {
    const recovered = await recoverMission(missionId)
    setMissions((prev) => (prev.some((m) => m.id === recovered.id) ? prev : [...prev, recovered]))

    if (recovered.type === 'routine') {
      const streak = await computeRoutineStreak(recovered.id)
      setRoutineStreaks((prev) => ({ ...prev, [recovered.id]: streak }))
    }
  }

  function handleEdit(mission: MissionRow) {
    // Igual que handleDelete: no se edita una misión con una confirmación de hoy todavía en el
    // margen de deshacer (MissionCard ya oculta el botón mientras tanto, esto es la defensa extra).
    if (pendingCompletions[mission.id] !== undefined) return
    setEditingMission(mission)
  }

  /**
   * Aplica al estado local la recompensa del tutorial (1 Poción + 10
   * monedas, documento 6.2) recién concedida por TutorialOverlay. Si
   * outcome.claimed es false (ya estaba reclamada de antes, p.ej. el usuario
   * volvió a abrir el tutorial solo para consultarlo tras completarlo en el
   * pasado), no hay nada que aplicar: character/inventory ya reflejan la
   * recompensa desde que se concedió.
   */
  function handleTutorialRewardClaimed(outcome: ClaimTutorialRewardOutcome) {
    setUserProfile((prev) => (prev ? { ...prev, tutorial_reward_claimed: true } : prev))
    if (!outcome.claimed || !gameState) return
    const { character: updatedCharacter, inventoryItem } = outcome
    if (updatedCharacter) setGameState({ ...gameState, character: updatedCharacter })
    if (inventoryItem) setInventory((prev) => upsertInventoryItem(prev, inventoryItem))
  }

  /**
   * setPlayerCharacter (gameApi.ts) ya guardó el valor en Supabase; aquí solo se sincroniza el
   * estado local y se decide el siguiente overlay: si esta era la primerísima carga de la cuenta
   * (justCreatedProfileRef), encadena al Tutorial justo después de cerrar el selector, tal como
   * hacía antes directamente el load effect. En cualquier otro caso (cuenta ya existente, o cambio
   * voluntario posterior vía "Cambiar personaje"), simplemente se cierra.
   */
  function handleCharacterSelected(character: PlayerCharacter) {
    setUserProfile((prev) => (prev ? { ...prev, player_character: character } : prev))
    setActiveOverlay(justCreatedProfileRef.current ? 'tutorial' : null)
  }

  /** Recarga el historial al vuelo al abrir la pantalla (documento 15.1: sección secundaria, no merece mantenerse sincronizada tras cada acción del Dashboard). */
  async function openHistory() {
    if (!gameState) return
    setHistoryLoading(true)
    try {
      const events = await fetchHistoryEvents(gameState.adventureRun.id)
      setHistoryEvents(events)
      setActiveOverlay('history')
    } catch (err) {
      setLoadState({ state: 'error', message: getErrorMessage(err) })
    } finally {
      setHistoryLoading(false)
    }
  }

  /** Compra un objeto: sube market_purchases_count y cambia el saldo/mochila, así que puede desbloquear logros de contador o de estado (coins_held_*, backpack_5_items, item_collector_all_types, first_purchase, market_25_purchases). */
  async function handlePurchase(updatedCharacter: CharacterRow, inventoryItem: InventoryItemRow) {
    if (!gameState) return
    setGameState({ ...gameState, character: updatedCharacter })
    const inventoryAfter = upsertInventoryItem(inventory, inventoryItem)
    setInventory(inventoryAfter)
    await applyStateBasedAchievementUnlocks(
      gameState.adventureRun,
      updatedCharacter,
      gameState.attributeProgress,
      inventoryAfter,
      achievementProgress,
    )
  }

  /** Usar una poción sube potions_used_count y decrementa la mochila: puede desbloquear potions_used_10, cambiar si sigue cumpliéndose backpack_5_items/item_collector_all_types, o 'hp_recovery_10_to_50' (Nunca te rindas, Tanda 3) si el HP sube por encima de 50 tras haber bajado de 10 en algún momento de la partida. */
  async function handleHeal(updatedCharacter: CharacterRow, inventoryItem: InventoryItemRow) {
    if (!gameState) return
    setGameState({ ...gameState, character: updatedCharacter })
    const inventoryAfter = upsertInventoryItem(inventory, inventoryItem)
    setInventory(inventoryAfter)
    await applyStateBasedAchievementUnlocks(
      gameState.adventureRun,
      updatedCharacter,
      gameState.attributeProgress,
      inventoryAfter,
      achievementProgress,
    )
  }

  async function handleShieldActivated(inventoryItem: InventoryItemRow) {
    if (!gameState) return
    const inventoryAfter = upsertInventoryItem(inventory, inventoryItem)
    setInventory(inventoryAfter)
    setActiveShieldItemId(inventoryItem.item_id as ShieldItemId)
    await applyStateBasedAchievementUnlocks(
      gameState.adventureRun,
      gameState.character,
      gameState.attributeProgress,
      inventoryAfter,
      achievementProgress,
    )
  }

  async function handleCelestialHandActivated(
    inventoryItem: InventoryItemRow,
    achievementUnlocked: AchievementProgressRow | null,
  ) {
    if (!gameState) return
    const inventoryAfter = upsertInventoryItem(inventory, inventoryItem)
    setInventory(inventoryAfter)
    setCelestialHandActive(true)
    // achievementUnlocked ('celestial_hand_used_first') ya está en la base de
    // datos (gameApi lo insertó en el momento de la acción); se incorpora
    // aquí a la lista base en vez de con un setAchievementProgress aparte,
    // para que applyStateBasedAchievementUnlocks no lo pise más abajo con un
    // valor de achievementProgress desactualizado.
    const achievementsBase = achievementUnlocked
      ? mergeAchievementRow(achievementProgress, achievementUnlocked)
      : achievementProgress
    await applyStateBasedAchievementUnlocks(
      gameState.adventureRun,
      gameState.character,
      gameState.attributeProgress,
      inventoryAfter,
      achievementsBase,
    )
  }

  async function handleEscapeRopeUsed(
    mission: MissionRow,
    inventoryItem: InventoryItemRow,
    achievementUnlocked: AchievementProgressRow | null,
  ) {
    if (!gameState) return
    const inventoryAfter = upsertInventoryItem(inventory, inventoryItem)
    setInventory(inventoryAfter)
    if (mission.type === 'task') {
      setMissions((prev) => prev.filter((m) => m.id !== mission.id))
    } else {
      setCompletedTodayMissionIds((prev) => new Set(prev).add(mission.id))
    }
    // Ver comentario equivalente en handleCelestialHandActivated.
    const achievementsBase = achievementUnlocked
      ? mergeAchievementRow(achievementProgress, achievementUnlocked)
      : achievementProgress
    await applyStateBasedAchievementUnlocks(
      gameState.adventureRun,
      gameState.character,
      gameState.attributeProgress,
      inventoryAfter,
      achievementsBase,
    )
  }

  /**
   * Se llama desde BossBattleScreen justo tras "Confirmar" (no tras
   * "Continuar"): resolveBossVictory ya dejó mission.status y las
   * consecuencias escritas atómicamente en BD (resolve_boss_victory,
   * backend/023_resolve_boss_battle.sql), así que el estado local debe
   * reflejarlo ya mismo — en particular `setMissions` de aquí abajo, que es
   * lo que saca el Boss de "Batallas pendientes". Si esto siguiera
   * ocurriendo solo al pulsar "Continuar", abandonar la pantalla de
   * resultado sin pulsarlo (cambiar de pestaña) dejaba el Boss visible como
   * pendiente pese a estar ya resuelto en BD — ese era el bug.
   * `battlingMission` YA NO se limpia aquí: sigue abierto para que el
   * usuario vea la pantalla de resultado ("Continuar"), que ahora es pura
   * UI (onClose) sin lógica de negocio pendiente.
   */
  async function handleBossVictory(outcome: BossVictoryOutcome) {
    if (!gameState || !battlingMission) return
    const oldCharacter = gameState.character
    const battlingMissionId = battlingMission.id
    // Mismo patrón que finalizeCompletion en commitCompletion: aplica el resultado ya calculado al
    // HUD, al instante si no hubo subida de nivel, o retenido hasta que LevelUpOverlay termine.
    const finalizeVictory = () => {
      setGameState({
        ...gameState,
        character: outcome.character,
        attributeProgress: outcome.attributeProgress,
      })
      applyRankRewards(outcome.rankRewards)
      setMissions((prev) => prev.filter((m) => m.id !== battlingMissionId))
      if (outcome.celestialHandConsumed) setCelestialHandActive(false)
    }

    const inventoryAfter = inventoryAfterRankRewards(inventory, outcome.rankRewards)
    // achievementUnlocked ('boss_no_celestial_hand') ya está en la base de
    // datos; se incorpora a la lista base (ver comentario en
    // handleCelestialHandActivated) en vez de con un setAchievementProgress
    // aparte, para que applyStateBasedAchievementUnlocks no lo pise más abajo.
    const achievementsBase = outcome.achievementUnlocked
      ? mergeAchievementRow(achievementProgress, outcome.achievementUnlocked)
      : achievementProgress
    // Ganar un Boss concede XP general y de atributo, sube bosses_won_count
    // y coins_earned_total: puede cruzar un umbral de nivel, rango,
    // atributo, Bosses vencidos o monedas ganadas en total. Se evalúa ya mismo (no se retiene como
    // el HUD) porque no es visible detrás del overlay de subida de nivel.
    await applyStateBasedAchievementUnlocks(
      gameState.adventureRun,
      outcome.character,
      outcome.attributeProgress,
      inventoryAfter,
      achievementsBase,
    )

    if (outcome.character.level > oldCharacter.level) {
      enqueueLevelUp({
        oldLevel: oldCharacter.level,
        oldXp: oldCharacter.current_xp,
        xpGained: outcome.xpGained.general,
        rankRewards: outcome.rankRewards,
        finalize: finalizeVictory,
      })
    } else {
      finalizeVictory()
    }
  }

  /** Misma razón que handleBossVictory: se llama tras "Confirmar", no tras "Continuar", y ya no limpia `battlingMission`. */
  async function handleBossDefeatAlive(outcome: BossDefeatAliveOutcome) {
    if (!gameState || !battlingMission) return
    setGameState({ ...gameState, character: outcome.character })
    setMissions((prev) => prev.filter((m) => m.id !== battlingMission.id))
    if (outcome.celestialHandConsumed) setCelestialHandActive(false)
    const inventoryAfter = outcome.totemItem ? upsertInventoryItem(inventory, outcome.totemItem) : inventory
    if (outcome.totemItem) {
      setInventory(inventoryAfter)
    }
    // achievementsUnlocked ('totem_activated', Tanda 3 — Bosses no cuentan
    // para 'first_mission_failed', ver resolveBossDefeat) ya está en la base
    // de datos; se incorpora a la lista base (ver comentario en
    // handleCelestialHandActivated) en vez de con un setAchievementProgress
    // aparte, para que applyStateBasedAchievementUnlocks no lo pise más
    // abajo. Perder un Boss también puede cruzar 'hp_below_25_first'/
    // 'survive_1_hp'/'no_damage_30_days' (min_hp_reached_this_run/
    // last_damage_date, Tanda 3), de ahí que ahora sí haga falta reevaluar el
    // estado (antes de Tanda 3 no cambiaba nada aquí).
    const achievementsBase = outcome.achievementsUnlocked.reduce(
      (acc, row) => mergeAchievementRow(acc, row),
      achievementProgress,
    )
    await applyStateBasedAchievementUnlocks(
      gameState.adventureRun,
      outcome.character,
      gameState.attributeProgress,
      inventoryAfter,
      achievementsBase,
    )
  }

  /**
   * Se llama cuando el servidor rechaza "Confirmar" con LV002
   * (isBossAlreadyResolvedError): esta batalla ya se había resuelto en un
   * intento anterior (p.ej. se confirmó, se cambió de pestaña sin pulsar
   * "Continuar", y se reabrió esta pantalla stale). No hay ningún outcome
   * que aplicar — la resolución real ya se aplicó la primera vez — así que
   * esto solo corrige el estado local que quedó desincronizado: saca la
   * misión de "Batallas pendientes". No cierra la pantalla de batalla (a
   * diferencia de handleBossVictory/handleBossDefeatAlive, que tampoco lo
   * hacen ya): BossBattleScreen deja el mensaje de error visible y es el
   * propio usuario quien sale con "Volver"/"Cancelar" (onClose), cuando
   * quiera.
   */
  function handleBossAlreadyResolved() {
    if (!battlingMission) return
    setMissions((prev) => prev.filter((m) => m.id !== battlingMission.id))
  }

  /** Misma consecuencia que morir por vencimiento de misión (die_and_restart_adventure ya limpió todo el estado viejo, incluida active_celestial_hand y las recompensas pendientes). */
  function handleBossDefeatDead(newGameState: GameState) {
    setGameState(newGameState)
    setMissions([])
    setInventory([])
    setActiveShieldItemId(null)
    setCelestialHandActive(false)
    setPendingRewards([])
    setAchievementProgress([])
    setCompletedTodayMissionIds(new Set())
    setBattlingMission(null)
    setDeathNotice(true)
  }

  if (loadState.state === 'loading') {
    return (
      <main className="app-shell">
        <p>Cargando personaje...</p>
      </main>
    )
  }

  if (loadState.state === 'error' || !gameState) {
    return (
      <main className="app-shell">
        <p style={{ color: 'var(--color-danger)' }}>
          {loadState.state === 'error' ? loadState.message : 'Error desconocido cargando el personaje.'}
        </p>
        <button onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
      </main>
    )
  }

  const { character } = gameState

  // Rutinas ya resueltas hoy (completadas, falladas o evadidas) no son un
  // objetivo válido para la Cuerda Huida: no queda nada que evadir. Los
  // Bosses tampoco lo son nunca (documento 8.10: "No funciona con Bosses").
  const escapeRopeEligibleMissions = missions.filter(
    (mission) => mission.type !== 'boss' && (mission.type === 'task' || !completedTodayMissionIds.has(mission.id)),
  )

  const pendingBossBattles = missions.filter((mission) => isPendingBossBattle(mission, today))
  const nonBattleMissions = missions.filter((mission) => !isPendingBossBattle(mission, today))
  // Mismo criterio que MissionList: Tareas y Rutinas activas sin resolver, sin contar Bosses
  // (esos ya tienen su propio contador en la pestaña "Batallas").
  const activeMissionsCount = missions.filter(
    (mission) => mission.type === 'task' || (mission.type === 'routine' && !completedTodayMissionIds.has(mission.id)),
  ).length

  return (
    <>
      {levelUpQueue.length > 0 && (
        <LevelUpOverlay
          key={levelUpQueue[0].id}
          oldLevel={levelUpQueue[0].oldLevel}
          oldXp={levelUpQueue[0].oldXp}
          xpGained={levelUpQueue[0].xpGained}
          rankRewards={levelUpQueue[0].rankRewards}
          onComplete={() => {
            levelUpQueue[0].finalize()
            setLevelUpQueue((prev) => prev.slice(1))
          }}
        />
      )}
      <main className="app-shell dashboard-shell" style={{ width: '100%', textAlign: 'left' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          width: '100%',
        }}
      >
        <h1>Lvl UP</h1>
        <Button variant="secondary" className="dashboard-header__logout" onClick={() => setSettingsView('menu')}>
          <img src="/ilustraciones/ajustes.png" alt="" className="dashboard-header__logout-icon" />
          Ajustes
        </Button>
      </div>

      {settingsView && (
        <Modal
          title={settingsView === 'changePassword' ? 'Cambiar contraseña' : 'Ajustes'}
          onClose={() => setSettingsView(null)}
        >
          {settingsView === 'menu' ? (
            <div className="settings-menu">
              <Button variant="secondary" className="settings-menu__action" onClick={() => setSettingsView('changePassword')}>
                Cambiar contraseña
              </Button>
              <div className="settings-menu__danger-zone">
                <Button variant="danger" className="settings-menu__action" onClick={() => supabase.auth.signOut()}>
                  Cerrar sesión
                </Button>
              </div>
            </div>
          ) : (
            <ChangePasswordForm
              onSuccess={() => {
                setSettingsView(null)
                setPasswordChangeSuccess(true)
              }}
              onCancel={() => setSettingsView('menu')}
            />
          )}
        </Modal>
      )}

      {passwordChangeSuccess && (
        <div
          style={{
            border: '2px solid var(--color-accent)',
            borderRadius: '8px',
            padding: '0.75rem',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>Contraseña actualizada correctamente.</strong>
          </p>
          <button onClick={() => setPasswordChangeSuccess(false)}>Entendido</button>
        </div>
      )}

      {deathNotice && (
        <div
          style={{
            border: '2px solid var(--color-danger)',
            borderRadius: '8px',
            padding: '0.75rem',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>Has muerto.</strong> Nueva partida iniciada.
          </p>
          <button onClick={() => setDeathNotice(false)}>Entendido</button>
        </div>
      )}

      <Card className="status-panel">
        <div className="status-panel__top">
          <div className="status-panel__identity">
            <span className="status-panel__medal">{character.level}</span>
            <div className="status-panel__title">
              <span className="status-panel__level">NIVEL {character.level}</span>
              <span className="status-panel__rank">Rango: {rankForLevel(character.level).name}</span>
            </div>
          </div>
          <span className="status-panel__coins">
            <img className="coin-icon" src="/ilustraciones/moneda.png" alt="" /> {character.coins}
          </span>
        </div>

        <div className="status-panel__bars">
          <div className="status-panel__bar-row">
            <span className="status-panel__bar-label">XP</span>
            <div className="status-panel__bar-track">
              <ProgressBar
                current={character.current_xp}
                max={xpRequiredForLevel(character.level)}
                color="var(--color-xp)"
              />
            </div>
            <span className="status-panel__bar-value">
              {character.current_xp} / {xpRequiredForLevel(character.level)}
            </span>
          </div>
          <div className="status-panel__bar-row">
            <span className="status-panel__bar-label">HP</span>
            <div className="status-panel__bar-track">
              <ProgressBar
                current={character.current_hp}
                max={MAX_HP}
                color={hpBarColor(character.current_hp)}
              />
            </div>
            <span className="status-panel__bar-value">
              {character.current_hp} / {MAX_HP}
            </span>
          </div>
        </div>

        {activeShieldItemId && (
          <p className="status-panel__shield">
            🛡️ Escudo activo: {ITEM_CATALOG[activeShieldItemId].displayName} (-
            {ITEM_CATALOG[activeShieldItemId].effectValue} HP)
          </p>
        )}
      </Card>

      {activeOverlay === 'ranks' && (
        <section className="overlay-section">
          <RanksScreen character={character} onClose={() => setActiveOverlay(null)} />
        </section>
      )}

      {activeOverlay === 'achievements' && (
        <section className="overlay-section">
          <AchievementsScreen
            achievementProgress={achievementProgress}
            onClose={() => setActiveOverlay(null)}
          />
        </section>
      )}

      {activeOverlay === 'history' && (
        <section className="overlay-section">
          <HistoryScreen
            historyEvents={historyEvents}
            character={character}
            attributeProgress={gameState.attributeProgress}
            activeMissions={missions}
            onRecoverMission={handleRecoverMission}
            onClose={() => setActiveOverlay(null)}
          />
        </section>
      )}

      {activeOverlay === 'tutorial' && (
        <section className="overlay-section">
          <TutorialOverlay
            character={character}
            attributeProgress={gameState.attributeProgress}
            inventory={inventory}
            adventureRunId={gameState.adventureRun.id}
            playerCharacter={userProfile?.player_character ?? null}
            alreadyClaimed={userProfile?.tutorial_reward_claimed ?? true}
            onRewardClaimed={handleTutorialRewardClaimed}
            onClose={() => setActiveOverlay(null)}
          />
        </section>
      )}

      {activeOverlay === 'attributes' && (
        <section className="overlay-section">
          <ScreenHeader title="Atributos" onBack={() => setActiveOverlay(null)} />
          <AttributesScreen attributeProgress={gameState.attributeProgress} />
        </section>
      )}

      {activeOverlay === 'characterSelect' && (
        <section className="overlay-section">
          <CharacterSelectOverlay
            userId={userId}
            mode={userProfile?.player_character == null ? 'onboarding' : 'change'}
            onSelected={handleCharacterSelected}
            onClose={() => setActiveOverlay(null)}
          />
        </section>
      )}

      {activeOverlay === null && (
        <>
          <nav className="main-nav">
            <button
              className={`main-nav__tab${screen === 'missions' ? ' main-nav__tab--active' : ''}`}
              onClick={() => setScreen('missions')}
            >
              <span className="main-nav__tab-icon">
                <img src="/ilustraciones/misiones.png" alt="" className="main-nav__tab-icon-img" />
              </span>
              Misiones
              {activeMissionsCount > 0 && <span className="main-nav__badge">{activeMissionsCount}</span>}
            </button>
            <button
              className={`main-nav__tab${screen === 'battles' ? ' main-nav__tab--active' : ''}`}
              onClick={() => setScreen('battles')}
            >
              <span className="main-nav__tab-icon">
                <img src="/ilustraciones/batalla.png" alt="" className="main-nav__tab-icon-img" />
              </span>
              Batallas
              {pendingBossBattles.length > 0 && (
                <span className="main-nav__badge">{pendingBossBattles.length}</span>
              )}
            </button>
            <button
              className={`main-nav__tab${screen === 'market' ? ' main-nav__tab--active' : ''}`}
              onClick={() => setScreen('market')}
            >
              <span className="main-nav__tab-icon">
                <img src="/ilustraciones/mercado.png" alt="" className="main-nav__tab-icon-img" />
              </span>
              Mercado
            </button>
            <button
              className={`main-nav__tab${screen === 'inventory' ? ' main-nav__tab--active' : ''}`}
              onClick={() => setScreen('inventory')}
            >
              <span className="main-nav__tab-icon">
                <img src="/ilustraciones/mochila.png" alt="" className="main-nav__tab-icon-img" />
              </span>
              Mochila
            </button>
          </nav>

          <div className="secondary-links">
            <button className="secondary-links__link" onClick={() => setActiveOverlay('ranks')}>
              <img src="/ilustraciones/rangos.png" alt="" className="secondary-links__icon" />
              Rangos
            </button>
            <button className="secondary-links__link" onClick={() => setActiveOverlay('achievements')}>
              <img src="/ilustraciones/logros.png" alt="" className="secondary-links__icon" />
              Logros
            </button>
            <button className="secondary-links__link" onClick={openHistory} disabled={historyLoading}>
              <img src="/ilustraciones/historial.png" alt="" className="secondary-links__icon" />
              Historial
            </button>
            <button className="secondary-links__link" onClick={() => setActiveOverlay('attributes')}>
              <img src="/ilustraciones/atributos.png" alt="" className="secondary-links__icon" />
              Atributos
            </button>
            <button className="secondary-links__link" onClick={() => setActiveOverlay('tutorial')}>
              <img src="/ilustraciones/tutorial.png" alt="" className="secondary-links__icon" />
              Tutorial
            </button>
            <button className="secondary-links__link" onClick={() => setActiveOverlay('characterSelect')}>
              <img src="/ilustraciones/personaje.png" alt="" className="secondary-links__icon" />
              Personaje
            </button>
          </div>

          {screen === 'missions' && (
            <>
              <section className="item-browser" style={{ marginBottom: '1.5rem' }}>
                <h2>Misiones activas</h2>
                <div className="tab-row" style={{ margin: '0 0 0.75rem' }}>
                  <Button
                    variant={missionsSubTab === 'all' ? 'primary' : 'secondary'}
                    onClick={() => setMissionsSubTab('all')}
                  >
                    Todas
                  </Button>
                  <Button
                    variant={missionsSubTab === 'task' ? 'primary' : 'secondary'}
                    onClick={() => setMissionsSubTab('task')}
                  >
                    Tareas
                  </Button>
                  <Button
                    variant={missionsSubTab === 'routine' ? 'primary' : 'secondary'}
                    onClick={() => setMissionsSubTab('routine')}
                  >
                    Rutinas
                  </Button>
                </div>
                <MissionList
                  missions={
                    missionsSubTab === 'all'
                      ? nonBattleMissions
                      : nonBattleMissions.filter((mission) => mission.type === missionsSubTab)
                  }
                  today={today}
                  completedTodayMissionIds={completedTodayMissionIds}
                  routineStreaks={routineStreaks}
                  busyMissionId={busyMissionId}
                  pendingCompletions={pendingCompletions}
                  onComplete={handleComplete}
                  onUndo={handleUndo}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
              </section>

              <section>
                <MissionForm adventureRunId={gameState.adventureRun.id} onSubmitted={handleMissionSaved} />
              </section>
            </>
          )}

          {editingMission && (
            <Modal title={`Editar ${MISSION_TYPE_LABELS[editingMission.type].toLowerCase()}`} onClose={() => setEditingMission(null)}>
              <MissionForm
                adventureRunId={gameState.adventureRun.id}
                mode="edit"
                initialMission={editingMission}
                onSubmitted={handleMissionSaved}
                onCancel={() => setEditingMission(null)}
              />
            </Modal>
          )}

          {screen === 'battles' && (
            <section className="boss-battle-page">
              <h2 className="boss-battle-page__title">
                <img src="/ilustraciones/batalla.png" alt="" className="boss-battle-page__title-icon" />
                Batallas pendientes
              </h2>

              {battlingMission ? (
                <BossBattleScreen
                  mission={battlingMission}
                  userId={userId}
                  gameState={gameState}
                  celestialHandActive={celestialHandActive}
                  playerCharacter={userProfile?.player_character ?? null}
                  onVictory={handleBossVictory}
                  onDefeatAlive={handleBossDefeatAlive}
                  onDefeatDead={handleBossDefeatDead}
                  onAlreadyResolved={handleBossAlreadyResolved}
                  onClose={() => setBattlingMission(null)}
                />
              ) : pendingBossBattles.length > 0 ? (
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                  }}
                >
                  {pendingBossBattles.map((mission) => (
                    <BossMissionCard
                      key={mission.id}
                      name={mission.name}
                      description={mission.description}
                      attributeIcon={bossIllustration(mission.primary_attribute)}
                      difficultyLabel={difficultyLabel(mission.difficulty)}
                      difficultyColor={DIFFICULTY_COLORS[mission.difficulty]}
                      attributeText={attributeSummaryText(mission)}
                      resultDate={mission.due_date}
                      onBossAction={() => setBattlingMission(mission)}
                    />
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0 }}>No hay batallas pendientes por ahora.</p>
              )}
            </section>
          )}

          {screen === 'market' && (
            <section className="item-browser">
              <MarketScreen
                adventureRunId={gameState.adventureRun.id}
                character={character}
                inventory={inventory}
                onPurchase={handlePurchase}
              />
            </section>
          )}

          {screen === 'inventory' && (
            <section className="item-browser">
              <InventoryScreen
                adventureRunId={gameState.adventureRun.id}
                character={character}
                inventory={inventory}
                pendingRewards={pendingRewards}
                missions={escapeRopeEligibleMissions}
                today={today}
                celestialHandActive={celestialHandActive}
                onHeal={handleHeal}
                onShieldActivated={handleShieldActivated}
                onCelestialHandActivated={handleCelestialHandActivated}
                onEscapeRopeUsed={handleEscapeRopeUsed}
              />
            </section>
          )}
        </>
      )}
    </main>
    </>
  )
}
