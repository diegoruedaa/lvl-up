import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ACHIEVEMENT_CATALOG,
  ITEM_CATALOG,
  MAX_ATTRIBUTE_LEVEL,
  MAX_CHARACTER_LEVEL,
  attributeXpRequiredForLevel,
  coinsForBossVictory,
  damageForBossDefeat,
} from 'rules-engine'
import type { Attribute, BossType, Difficulty, ItemId } from 'rules-engine'
import {
  ACHIEVEMENT_CATEGORY_LABELS,
  ACHIEVEMENT_ICONS,
  ATTRIBUTE_COLORS,
  ATTRIBUTE_ICONS,
  ATTRIBUTE_LABELS,
  ATTRIBUTE_RIBBON_TEXT,
  ATTRIBUTE_TINTS,
  ATTRIBUTES,
  BOSS_DIFFICULTIES,
  BOSS_DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  DIFFICULTY_STAR_COUNT,
  ITEM_EFFECT_DESCRIPTIONS,
  ITEM_ICONS,
  MISSION_DIFFICULTIES,
  MISSION_TYPE_LABELS,
  RARITY_COLORS,
  RARITY_LABELS,
  bossIllustration,
  dueUrgencyBadge,
  summarizePendingRewardNames,
} from '../types/database'
import { todayLocalDateString } from '../lib/gameApi'
import type {
  AttributeProgressRow,
  CharacterRow,
  HistoryEventRow as HistoryEventRowData,
  InventoryItemRow,
  MissionType,
} from '../types/database'
import { TutorialOverlay } from './TutorialOverlay'
import {
  AchievementRow,
  AttributeCard,
  Badge,
  BattleHex,
  BossMissionCard,
  Button,
  Card,
  DefeatedFace,
  HistoryEventRow,
  ItemDetailPanel,
  ItemRow,
  MerchantDialogueBox,
  MissionCard,
  PersonSilhouette,
  ProgressBar,
  RankPath,
  ScreenHeader,
  StarPicker,
} from './ui'
import {
  EVENT_ICON_COLORS,
  EVENT_ICONS,
  deltaColor,
  formatHistoryEventLines,
  groupEventsByDay,
  renderLineWithBoldQuotes,
  splitEventLines,
} from '../lib/historyEvents'
import { StatRow, StatSectionHeader } from './HistoryScreen'

/** Mochila mock (solo para esta vista previa): cubre las 4 rarezas, un objeto en 0
 * unidades (para confirmar que no aparece) y una recompensa pendiente por límite
 * de stock (Tótem, stackLimit 1) — casos reales, no inventados para la ocasión. */
const MOCK_INVENTORY: { itemId: ItemId; quantity: number }[] = [
  { itemId: 'potion', quantity: 6 },
  { itemId: 'small_shield', quantity: 0 },
  { itemId: 'super_potion', quantity: 2 },
  { itemId: 'large_shield', quantity: 1 },
  { itemId: 'escape_rope', quantity: 3 },
  { itemId: 'hyper_potion', quantity: 1 },
  { itemId: 'celestial_hand', quantity: 1 },
  { itemId: 'immortality_totem', quantity: 1 },
]

/** Dos recompensas distintas en espera, para probar tanto el plural ("recompensas...
 * se entregarán") como el listado con coma en el aviso. */
const MOCK_PENDING_REWARDS: { id: string; itemId: ItemId }[] = [
  { id: 'pending-1', itemId: 'immortality_totem' },
  { id: 'pending-2', itemId: 'celestial_hand' },
]

type MochilaCategoryId = 'healing' | 'defense' | 'special'

const MOCHILA_CATEGORIES: { id: MochilaCategoryId; label: string }[] = [
  { id: 'healing', label: 'Curación' },
  { id: 'defense', label: 'Defensa' },
  { id: 'special', label: 'Especiales' },
]

/** Agrupación de los 8 objetos en 3 categorías con sentido temático. Las recompensas
 * pendientes NO son una categoría más: viven en el aviso de arriba (ver PendingRewardBanner). */
const CATEGORY_ITEM_IDS: Record<MochilaCategoryId, ItemId[]> = {
  healing: ['potion', 'super_potion', 'hyper_potion'],
  defense: ['small_shield', 'large_shield', 'celestial_hand'],
  special: ['escape_rope', 'immortality_totem'],
}

interface MochilaRow {
  itemId: ItemId
  quantity: number
}

const MOCHILA_ROWS_BY_CATEGORY: Record<MochilaCategoryId, MochilaRow[]> = {
  healing: MOCK_INVENTORY.filter((row) => row.quantity > 0 && CATEGORY_ITEM_IDS.healing.includes(row.itemId)),
  defense: MOCK_INVENTORY.filter((row) => row.quantity > 0 && CATEGORY_ITEM_IDS.defense.includes(row.itemId)),
  special: MOCK_INVENTORY.filter((row) => row.quantity > 0 && CATEGORY_ITEM_IDS.special.includes(row.itemId)),
}

/** Lista + panel de detalle de la Mochila (patrón GBA/DS): la selección de fila vive aquí como
 * estado local, igual que tendrá que vivir en InventoryScreen.tsx cuando se aplique este patrón. */
function MochilaPreview() {
  const [selectedCategory, setSelectedCategory] = useState<MochilaCategoryId>('healing')
  const firstRow = MOCHILA_ROWS_BY_CATEGORY.healing[0]
  const [selectedItemId, setSelectedItemId] = useState<ItemId | null>(firstRow ? firstRow.itemId : null)

  const rows = MOCHILA_ROWS_BY_CATEGORY[selectedCategory]
  const selectedRow = rows.find((row) => row.itemId === selectedItemId) ?? null
  const selectedItem = selectedRow ? ITEM_CATALOG[selectedRow.itemId] : null

  function selectCategory(categoryId: MochilaCategoryId) {
    setSelectedCategory(categoryId)
    const nextRows = MOCHILA_ROWS_BY_CATEGORY[categoryId]
    setSelectedItemId(nextRows[0] ? nextRows[0].itemId : null)
  }

  return (
    <>
      {MOCK_PENDING_REWARDS.length > 0 && (
        <p className="pending-reward-banner">
          <span aria-hidden="true">🎁</span>
          <span>
            Tienes {MOCK_PENDING_REWARDS.length} recompensa{MOCK_PENDING_REWARDS.length === 1 ? '' : 's'} en espera:{' '}
            {summarizePendingRewardNames(MOCK_PENDING_REWARDS.map((r) => r.itemId))} — se entregará
            {MOCK_PENDING_REWARDS.length === 1 ? '' : 'n'} cuando haya espacio en la mochila.
          </span>
        </p>
      )}

      <div className="tab-row">
        {MOCHILA_CATEGORIES.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? 'primary' : 'secondary'}
            onClick={() => selectCategory(category.id)}
          >
            {category.label}
          </Button>
        ))}
      </div>

      <div className="item-list" style={{ margin: '0.75rem 0' }}>
        {rows.length === 0 && (
          <p style={{ margin: 0, padding: '0.6rem', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
            No tienes objetos en esta categoría.
          </p>
        )}
        {rows.map((row) => {
          const item = ITEM_CATALOG[row.itemId]
          return (
            <ItemRow
              key={row.itemId}
              icon={ITEM_ICONS[row.itemId]}
              name={item.displayName}
              rarityColor={RARITY_COLORS[item.rarity]}
              quantity={row.quantity}
              selected={row.itemId === selectedItemId}
              onSelect={() => setSelectedItemId(row.itemId)}
            />
          )
        })}
      </div>

      {selectedRow && selectedItem ? (
        <ItemDetailPanel
          icon={ITEM_ICONS[selectedRow.itemId]}
          name={selectedItem.displayName}
          rarityColor={RARITY_COLORS[selectedItem.rarity]}
          rarityLabel={RARITY_LABELS[selectedItem.rarity]}
          description={ITEM_EFFECT_DESCRIPTIONS[selectedRow.itemId]}
        >
          {selectedItem.effectType === 'heal' && <Button variant="primary">Usar</Button>}
          {selectedItem.effectType === 'shield' && <Button variant="primary">Activar</Button>}
          {selectedItem.effectType === 'escape' && (
            <>
              <select defaultValue="">
                <option value="" disabled>
                  Elige misión...
                </option>
                <option value="mock-1">Ordenar el escritorio (Tarea)</option>
              </select>
              <Button variant="primary">Usar sobre misión</Button>
            </>
          )}
          {selectedItem.effectType === 'boss_defense' && (
            <>
              <p
                style={{
                  margin: '0 0 0.4rem',
                  fontSize: 'var(--text-xs)',
                  fontStyle: 'italic',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Debe activarse antes de declarar el resultado de un Boss.
              </p>
              <Button variant="primary">Activar</Button>
            </>
          )}
          {selectedItem.effectType === 'revive' && (
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
              Se activa automáticamente ante un daño mortal.
            </p>
          )}
        </ItemDetailPanel>
      ) : (
        <Card variant="dimmed">
          <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>Selecciona un objeto para ver sus detalles.</p>
        </Card>
      )}
    </>
  )
}

/** Mock de tienda (solo para esta vista previa): mismos 8 objetos que MOCK_INVENTORY pero con
 * precio (documento 8.2) y monedas de partida deliberadamente bajas (150) para poder demostrar,
 * con la selección real de fila, tanto la frase de bienvenida (objeto asequible) como la de "no te
 * llegan las monedas" (Mano Celestial 180, Tótem 400) sin tener que fingir el estado. */
const MOCK_MARKET_COINS_START = 150
const MOCK_MARKET_OWNED_START: Partial<Record<ItemId, number>> = { potion: 3, escape_rope: 2 }

/** Réplica local de MarketScreen.tsx: mismas categorías/estado/temporizador de agradecimiento,
 * pero la "compra" solo muta estado de este preview — no llama a purchaseItem ni a gameApi.ts. */
function MercadoPreview() {
  const [coins, setCoins] = useState(MOCK_MARKET_COINS_START)
  const [owned, setOwned] = useState<Partial<Record<ItemId, number>>>(MOCK_MARKET_OWNED_START)
  const [selectedCategory, setSelectedCategory] = useState<MochilaCategoryId>('healing')
  const [selectedItemId, setSelectedItemId] = useState<ItemId | null>(CATEGORY_ITEM_IDS.healing[0] ?? null)
  const [justPurchased, setJustPurchased] = useState(false)
  const thanksTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (thanksTimeoutRef.current !== null) window.clearTimeout(thanksTimeoutRef.current)
    }
  }, [])

  function selectCategory(categoryId: MochilaCategoryId) {
    setSelectedCategory(categoryId)
    setSelectedItemId(CATEGORY_ITEM_IDS[categoryId][0] ?? null)
  }

  const rowItemIds = CATEGORY_ITEM_IDS[selectedCategory]
  const selectedItem = selectedItemId ? ITEM_CATALOG[selectedItemId] : null
  const selectedOwned = selectedItemId ? (owned[selectedItemId] ?? 0) : 0
  const atLimit = selectedItem !== null && selectedItem.stackLimit !== null && selectedOwned >= selectedItem.stackLimit
  const canAfford = selectedItem !== null && coins >= selectedItem.price
  const disabled = atLimit || !canAfford

  const merchantLine = justPurchased
    ? '¡Buena elección! Que te sea útil.'
    : selectedItem && !canAfford
      ? 'Vuelve cuando tengas más monedas...'
      : '¡Bienvenido, aventurero! Echa un vistazo, tómate tu tiempo.'

  function handleMockBuy() {
    if (!selectedItemId || !selectedItem || disabled) return
    setCoins((c) => c - selectedItem.price)
    setOwned((prev) => ({ ...prev, [selectedItemId]: (prev[selectedItemId] ?? 0) + 1 }))
    if (thanksTimeoutRef.current !== null) window.clearTimeout(thanksTimeoutRef.current)
    setJustPurchased(true)
    thanksTimeoutRef.current = window.setTimeout(() => setJustPurchased(false), 1800)
  }

  return (
    <div className="market-theme">
      <p style={{ margin: '0 0 0.5rem' }}>
        Monedas: {coins} <img className="coin-icon" src="/ilustraciones/moneda.png" alt="" />
      </p>

      <MerchantDialogueBox line={merchantLine} />

      <div className="tab-row">
        {MOCHILA_CATEGORIES.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? 'primary' : 'secondary'}
            onClick={() => selectCategory(category.id)}
          >
            {category.label}
          </Button>
        ))}
      </div>

      <div className="item-list" style={{ margin: '0.75rem 0' }}>
        {rowItemIds.map((itemId) => {
          const item = ITEM_CATALOG[itemId]
          const itemOwned = owned[itemId] ?? 0
          return (
            <ItemRow
              key={itemId}
              icon={ITEM_ICONS[itemId]}
              name={item.displayName}
              rarityColor={RARITY_COLORS[item.rarity]}
              selected={itemId === selectedItemId}
              onSelect={() => setSelectedItemId(itemId)}
              ownedCount={itemOwned}
              rightContent={
                <>
                  <img className="coin-icon" src="/ilustraciones/moneda.png" alt="" /> {item.price}
                </>
              }
            />
          )
        })}
      </div>

      {selectedItemId && selectedItem ? (
        <ItemDetailPanel
          icon={ITEM_ICONS[selectedItemId]}
          name={selectedItem.displayName}
          rarityColor={RARITY_COLORS[selectedItem.rarity]}
          rarityLabel={RARITY_LABELS[selectedItem.rarity]}
          description={ITEM_EFFECT_DESCRIPTIONS[selectedItemId]}
        >
          <Button variant="primary" onClick={handleMockBuy} disabled={disabled}>
            Comprar — {selectedItem.price} <img className="coin-icon" src="/ilustraciones/moneda.png" alt="" />
          </Button>
          {atLimit && (
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
              Límite de mochila alcanzado.
            </p>
          )}
          {!atLimit && !canAfford && (
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
              Monedas insuficientes.
            </p>
          )}
        </ItemDetailPanel>
      ) : (
        <Card variant="dimmed">
          <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>Selecciona un objeto para ver sus detalles.</p>
        </Card>
      )}
    </div>
  )
}

function isBossDifficulty(difficulty: Difficulty): difficulty is BossType {
  return (BOSS_DIFFICULTIES as Difficulty[]).includes(difficulty)
}

function difficultyLabel(difficulty: Difficulty): string {
  return isBossDifficulty(difficulty) ? BOSS_DIFFICULTY_LABELS[difficulty] : DIFFICULTY_LABELS[difficulty]
}

interface MockMission {
  id: string
  type: MissionType
  name: string
  description: string
  difficulty: Difficulty
  primaryAttribute: Attribute
  secondaryAttribute: Attribute | null
  /** Fecha límite (Tarea) o fecha de resultado (Boss); null para Rutina, que no vence. */
  dueDate: string | null
}

/** "Hoy" fijo del mock, para que las misiones de ejemplo cubran de forma determinista los tres
 * casos de urgencia (vencida, vence hoy, vence pronto) en vez de depender de la fecha real. */
const MOCK_TODAY = '2026-07-28'

/** Siete misiones activas: una por cada uno de los 6 atributos (para ver los 6 tonos de cinta)
 * más un Boss aún no vencido, con las 6 dificultades en estrellas representadas (1 a 5, con
 * "media" repetida) y los 4 casos de vencimiento (venció ayer, vence hoy, vence en N días,
 * vence en 6 días → sin insignia; la rutina no vence). */
const MOCK_ACTIVE_MISSIONS: MockMission[] = [
  {
    id: 'm1',
    type: 'task',
    name: 'Beber 2 litros de agua',
    description: 'Llevar la botella contigo todo el día.',
    difficulty: 'trivial',
    primaryAttribute: 'vitality',
    secondaryAttribute: null,
    dueDate: '2026-07-28',
  },
  {
    id: 'm2',
    type: 'task',
    name: 'Terminar el capítulo del libro',
    description: 'Avanzar antes del club de lectura.',
    difficulty: 'medium',
    primaryAttribute: 'intellect',
    secondaryAttribute: null,
    dueDate: '2026-07-30',
  },
  {
    id: 'm3',
    type: 'task',
    name: 'Renovar el pasaporte',
    description: 'Pedir cita en la oficina de expedición.',
    difficulty: 'hard',
    primaryAttribute: 'discipline',
    secondaryAttribute: null,
    dueDate: '2026-07-27',
  },
  {
    id: 'm4',
    type: 'routine',
    name: 'Llamar a un amigo',
    description: 'Preguntar cómo le va, sin prisa.',
    difficulty: 'easy',
    primaryAttribute: 'relations',
    secondaryAttribute: null,
    dueDate: null,
  },
  {
    id: 'm5',
    type: 'task',
    name: 'Planear el viaje de senderismo',
    description: 'Ruta, reservas y equipo.',
    difficulty: 'epic',
    primaryAttribute: 'adventure',
    secondaryAttribute: 'discipline',
    dueDate: '2026-08-03',
  },
  {
    id: 'm6',
    type: 'task',
    name: 'Revisar el presupuesto del mes',
    description: 'Cuadrar gastos e ingresos.',
    difficulty: 'medium',
    primaryAttribute: 'fortune',
    secondaryAttribute: null,
    dueDate: '2026-07-31',
  },
  {
    id: 'm7',
    type: 'boss',
    name: 'Examen final de cálculo',
    description: 'Resultado del examen del jueves.',
    difficulty: 'boss_major',
    primaryAttribute: 'intellect',
    secondaryAttribute: null,
    dueDate: '2026-08-01',
  },
  {
    id: 'm10',
    type: 'routine',
    name: 'Entrenamiento de natación en la piscina municipal',
    description: 'Dos largos de crol, dos de espalda.',
    difficulty: 'medium',
    primaryAttribute: 'vitality',
    secondaryAttribute: null,
    dueDate: null,
  },
]

/** Dos Bosses cuya fecha de resultado ya llegó (hoy o antes) — mismo criterio que
 * isPendingBossBattle en Dashboard.tsx, así que en la app real vivirían en "Batallas
 * pendientes" en vez de en la lista normal. */
const MOCK_BOSS_BATTLES: MockMission[] = [
  {
    id: 'm8',
    type: 'boss',
    name: 'Presentación ante el cliente',
    description: 'El resultado ya está decidido — hora de declararlo.',
    difficulty: 'boss_legendary',
    primaryAttribute: 'relations',
    secondaryAttribute: 'discipline',
    dueDate: '2026-07-28',
  },
  {
    id: 'm9',
    type: 'boss',
    name: 'Entrevista de trabajo',
    description: 'Ya pasó la fecha del resultado.',
    difficulty: 'boss_minor',
    primaryAttribute: 'relations',
    secondaryAttribute: null,
    dueDate: '2026-07-25',
  },
]

function attributeSummary(mission: MockMission): string {
  const primary = ATTRIBUTE_LABELS[mission.primaryAttribute]
  return mission.secondaryAttribute ? `${primary} + ${ATTRIBUTE_LABELS[mission.secondaryAttribute]}` : primary
}

/** Traduce el mock de esta vista previa a las props ya-resueltas que espera BossMissionCard
 * (componente compartido en ./ui, el mismo que usa MissionList.tsx). */
function bossCardProps(mission: MockMission) {
  return {
    name: mission.name,
    description: mission.description,
    attributeIcon: bossIllustration(mission.primaryAttribute),
    difficultyLabel: difficultyLabel(mission.difficulty),
    difficultyColor: DIFFICULTY_COLORS[mission.difficulty],
    attributeText: attributeSummary(mission),
    resultDate: mission.dueDate,
  }
}

/** Cuenta atrás del margen de deshacer (5s), igual que useCountdownSeconds de MissionList.tsx. */
function useMockCountdownSeconds(deadline: number | null): number {
  const [remainingMs, setRemainingMs] = useState(() => (deadline === null ? 0 : Math.max(0, deadline - Date.now())))

  useEffect(() => {
    if (deadline === null) return
    setRemainingMs(Math.max(0, deadline - Date.now()))
    const interval = setInterval(() => setRemainingMs(Math.max(0, deadline - Date.now())), 200)
    return () => clearInterval(interval)
  }, [deadline])

  return Math.ceil(remainingMs / 1000)
}

/** Réplica visual de MissionList.tsx: "Batallas pendientes" como página especial del diario
 * (borde dorado grueso) arriba, y la lista normal debajo. Completar/Eliminar mutan solo el
 * estado de este preview — no llaman a gameApi.ts. */
function MisionesListPreview() {
  const [missions, setMissions] = useState(MOCK_ACTIVE_MISSIONS)
  const [pendingMissionId, setPendingMissionId] = useState<string | null>(null)
  const [pendingDeadline, setPendingDeadline] = useState<number | null>(null)
  const countdownSeconds = useMockCountdownSeconds(pendingDeadline)
  const clearTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (clearTimeoutRef.current !== null) window.clearTimeout(clearTimeoutRef.current)
    }
  }, [])

  function handleComplete(missionId: string) {
    setPendingMissionId(missionId)
    setPendingDeadline(Date.now() + 5000)
    if (clearTimeoutRef.current !== null) window.clearTimeout(clearTimeoutRef.current)
    clearTimeoutRef.current = window.setTimeout(() => {
      setPendingMissionId(null)
      setPendingDeadline(null)
    }, 5000)
  }

  function handleUndo() {
    if (clearTimeoutRef.current !== null) window.clearTimeout(clearTimeoutRef.current)
    setPendingMissionId(null)
    setPendingDeadline(null)
  }

  function handleDelete(missionId: string) {
    setMissions((prev) => prev.filter((mission) => mission.id !== missionId))
  }

  return (
    <>
      {MOCK_BOSS_BATTLES.length > 0 && (
        <section className="boss-battle-page">
          <h3 className="boss-battle-page__title">👑 Batallas pendientes</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {MOCK_BOSS_BATTLES.map((mission) => (
              <BossMissionCard key={mission.id} {...bossCardProps(mission)} onBossAction={() => {}} />
            ))}
          </ul>
        </section>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {missions.map((mission) => {
          if (mission.type === 'boss') {
            return (
              <BossMissionCard
                key={mission.id}
                {...bossCardProps(mission)}
                onDelete={() => handleDelete(mission.id)}
              />
            )
          }
          const isPending = pendingMissionId === mission.id
          return (
            <MissionCard
              key={mission.id}
              typeLabel={MISSION_TYPE_LABELS[mission.type]}
              attributeIcon={ATTRIBUTE_ICONS[mission.primaryAttribute]}
              attributeLabel={ATTRIBUTE_LABELS[mission.primaryAttribute]}
              attributeColor={ATTRIBUTE_COLORS[mission.primaryAttribute]}
              attributeTextColor={ATTRIBUTE_RIBBON_TEXT[mission.primaryAttribute]}
              attributeTint={ATTRIBUTE_TINTS[mission.primaryAttribute]}
              secondaryAttributeLabel={mission.secondaryAttribute ? ATTRIBUTE_LABELS[mission.secondaryAttribute] : null}
              name={mission.name}
              description={mission.description}
              starValue={DIFFICULTY_STAR_COUNT[mission.difficulty]}
              starLabel={`Dificultad: ${difficultyLabel(mission.difficulty)}`}
              urgency={mission.type === 'task' ? dueUrgencyBadge(mission.dueDate, MOCK_TODAY) : null}
              isPending={isPending}
              busy={false}
              countdownSeconds={isPending ? countdownSeconds : undefined}
              onComplete={() => handleComplete(mission.id)}
              onUndo={handleUndo}
              onDelete={() => handleDelete(mission.id)}
            />
          )
        })}
      </ul>
    </>
  )
}

/** Réplica visual de MissionForm.tsx: misma paleta/tipografía que la lista ("una página en
 * blanco del mismo cuaderno"). Dificultad de Tarea/Rutina como estrellas interactivas (Boss sigue
 * con los chips de texto, ya que su escala de 3 niveles no encaja en 1-5); atributo principal
 * como chips con el icono/color que tendrá la cinta de la tarjeta resultante. No envía nada — es
 * solo para revisar el estilo. */
function MisionesFormPreview() {
  const [type, setType] = useState<MissionType>('task')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [primaryAttribute, setPrimaryAttribute] = useState<Attribute>('vitality')
  const [secondaryAttribute, setSecondaryAttribute] = useState<Attribute | ''>('')

  function handleTypeChange(next: MissionType) {
    setType(next)
    if (next === 'boss' && !isBossDifficulty(difficulty)) setDifficulty(BOSS_DIFFICULTIES[0])
    else if (next !== 'boss' && isBossDifficulty(difficulty)) setDifficulty('easy')
  }

  function handlePrimaryChange(next: Attribute) {
    setPrimaryAttribute(next)
    if (secondaryAttribute === next) setSecondaryAttribute('')
  }

  const isBoss = type === 'boss'
  const usesDueDate = type === 'task' || type === 'boss'

  return (
    <form style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }} onSubmit={(e) => e.preventDefault()}>
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
        <input className="field-input" type="text" placeholder="Ej. Ordenar el escritorio" />
      </label>

      <label>
        <span className="field-label">Descripción (opcional)</span>
        <textarea className="field-input" placeholder="Detalles de la misión..." />
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
                {difficultyLabel(d)}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <StarPicker value={DIFFICULTY_STAR_COUNT[difficulty]} onChange={(n) => setDifficulty(MISSION_DIFFICULTIES[n - 1])} />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{difficultyLabel(difficulty)}</span>
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
            <input className="field-input" type="date" />
          </label>
          {type === 'task' && (
            <label>
              <span className="field-label">Hora límite (opcional, por defecto 23:59)</span>
              <input className="field-input" type="time" />
            </label>
          )}
        </>
      )}

      {type === 'routine' && (
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          Frecuencia: todos los días.
        </p>
      )}

      <Button type="submit" variant="primary">
        Anotar misión
      </Button>
    </form>
  )
}

/** Mocks de Boss para "Batalla contra Boss": mismo tipo MockMission ya usado en Misiones, mismos
 * 3 Boss de ejemplo (Menor/Importante/Legendario) por continuidad con esa sección. */
const MOCK_BOSS_MINOR: MockMission = {
  id: 'battle-minor',
  type: 'boss',
  name: 'Entrevista de trabajo',
  description: 'Prepararse bien y llegar a tiempo.',
  difficulty: 'boss_minor',
  primaryAttribute: 'adventure',
  secondaryAttribute: null,
  dueDate: '2026-07-25',
}

const MOCK_BOSS_LEGENDARY: MockMission = {
  id: 'battle-legendary',
  type: 'boss',
  name: 'Presentación ante el cliente',
  description: 'El resultado ya está decidido — hora de declararlo.',
  difficulty: 'boss_legendary',
  primaryAttribute: 'relations',
  secondaryAttribute: 'discipline',
  dueDate: '2026-07-28',
}

const MOCK_BOSS_MAJOR: MockMission = {
  id: 'battle-major',
  type: 'boss',
  name: 'Examen final de cálculo',
  description: 'Resultado del examen del jueves.',
  difficulty: 'boss_major',
  primaryAttribute: 'intellect',
  secondaryAttribute: null,
  dueDate: '2026-08-01',
}

/** Réplica visual de BossBattleScreen.tsx: mismo hexágono de doble borde + anillo de amenaza que
 * el componente real (ver BattleHex en ./ui), con XP/monedas/daño calculados con las mismas
 * funciones puras de rules-engine que usa resolveBossVictory/resolveBossDefeat (coinsForBossVictory/
 * damageForBossDefeat) — cifras reales, no inventadas, aunque el resultado en sí es local a este
 * preview (no llama a gameApi.ts). "Continuar" solo reinicia la demo, ya que aquí no hay Dashboard
 * al que volver. */
function BossBattlePreviewCard({
  mission,
  initialResult,
  celestialHandConsumed = false,
  totemActivated = false,
}: {
  mission: MockMission
  initialResult?: 'victory' | 'defeat'
  celestialHandConsumed?: boolean
  totemActivated?: boolean
}) {
  const [pending, setPending] = useState<'victory' | 'defeat' | null>(null)
  const [result, setResult] = useState<'victory' | 'defeat' | null>(initialResult ?? null)

  const bossType = mission.difficulty as BossType
  const playerDefeated = result === 'defeat'

  const playerHex = (
    <div className="boss-arena__side">
      <div className="boss-arena__side-visual">
        <BattleHex
          icon={playerDefeated ? <DefeatedFace /> : <PersonSilhouette />}
          size={76}
          fillColor="var(--color-border)"
          iconColor="var(--color-text)"
          defeated={playerDefeated}
        />
      </div>
      <span className="boss-arena__side-label">Tú</span>
    </div>
  )

  // Ver nota en BossBattleScreen.tsx: _derrota.png es el Boss celebrando (Derrota del jugador) y
  // _victoria.png es el Boss aturdido (Victoria del jugador) — el nombre sigue el sello mostrado,
  // no el punto de vista del Boss.
  const bossImageVariant = result === null ? 'neutral' : result === 'victory' ? 'victoria' : 'derrota'

  const bossHex = (
    <div className="boss-arena__side">
      <div className="boss-arena__side-visual">
        <img className="boss-arena__boss-image" src={bossIllustration(mission.primaryAttribute, bossImageVariant)} alt="" />
      </div>
      <span className="boss-arena__side-label">Boss</span>
    </div>
  )

  if (result) {
    return (
      <div className="boss-arena">
        <div className="boss-arena__combatants">
          {playerHex}
          {bossHex}
        </div>

        <span className={`boss-arena__stamp boss-arena__stamp--${result}`}>
          {result === 'victory' ? 'Victoria' : 'Derrota'}
        </span>

        <h2 className="boss-arena__name">{mission.name}</h2>

        <div className="boss-arena__breakdown">
          {result === 'victory' ? (
            <>
              <p className="boss-arena__breakdown-line">
                +500 XP general · +500 XP {ATTRIBUTE_LABELS[mission.primaryAttribute]}
                {mission.secondaryAttribute && (
                  <> · +250 XP {ATTRIBUTE_LABELS[mission.secondaryAttribute]}</>
                )}
              </p>
              <p className="boss-arena__breakdown-line boss-arena__breakdown-coins">
                +{coinsForBossVictory(bossType)} monedas
              </p>
            </>
          ) : (
            <>
              <p className="boss-arena__breakdown-line">-{damageForBossDefeat(celestialHandConsumed)} HP</p>
              {celestialHandConsumed && <p className="boss-arena__breakdown-line">Se consumió tu Mano Celestial.</p>}
              {totemActivated && (
                <p className="boss-arena__breakdown-line">
                  El Tótem de la Inmortalidad te salvó al perder contra el Boss "{mission.name}".
                </p>
              )}
            </>
          )}
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setResult(null)
            setPending(null)
          }}
        >
          Continuar
        </Button>
      </div>
    )
  }

  return (
    <div className="boss-arena">
      <span className="boss-arena__badge">Batalla contra Boss</span>

      <div className="boss-arena__combatants">
        {playerHex}
        <span className="boss-arena__vs">VS</span>
        {bossHex}
      </div>

      <h2 className="boss-arena__name">{mission.name}</h2>
      <span className="boss-arena__difficulty-badge">{BOSS_DIFFICULTY_LABELS[bossType]}</span>
      <p className="boss-arena__attrs">
        {ATTRIBUTE_LABELS[mission.primaryAttribute]}
        {mission.secondaryAttribute && ` + ${ATTRIBUTE_LABELS[mission.secondaryAttribute]}`}
      </p>
      {mission.description && <p className="boss-arena__description">{mission.description}</p>}

      {pending === null ? (
        <div className="boss-arena__actions">
          <Button variant="primary" onClick={() => setPending('victory')}>
            Victoria
          </Button>
          <Button variant="danger" onClick={() => setPending('defeat')}>
            Derrota
          </Button>
        </div>
      ) : (
        <>
          <p className="boss-arena__confirm-text">
            ¿Confirmas {pending === 'victory' ? 'la Victoria' : 'la Derrota'}? No se puede deshacer.
          </p>
          <div className="boss-arena__actions">
            <Button variant={pending === 'victory' ? 'primary' : 'danger'} onClick={() => setResult(pending)}>
              Confirmar
            </Button>
            <Button variant="secondary" onClick={() => setPending(null)}>
              Volver
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

/** Personaje/atributos/mochila de muestra para TutorialOverlay (no es una réplica: es el mismo
 * componente real, ver TutorialPreview más abajo) — nivel y XP intermedios para que los pasos 6-8
 * (barras de nivel/atributo/HP) muestren relleno parcial en vez de 0 o lleno, y dos objetos en la
 * mochila para que el paso 9 no caiga en el estado vacío. */
const TUTORIAL_MOCK_CHARACTER: CharacterRow = {
  id: 'mock-character',
  adventure_run_id: 'mock',
  level: 5,
  current_xp: 55,
  current_hp: 68,
  coins: 45,
  tutorial_completed_at: null,
  missions_completed_count: 3,
  bosses_won_count: 0,
  potions_used_count: 0,
  market_purchases_count: 1,
  coins_earned_total: 45,
  completion_streak_days: 0,
  last_completion_date: null,
  last_damage_date: null,
  flawless_streak: 0,
  min_hp_reached_this_run: 68,
  attribute_last_completed: {},
  mission_damage_taken: false,
}

const TUTORIAL_MOCK_ATTRIBUTE_PROGRESS: AttributeProgressRow[] = ATTRIBUTES.map((attribute) => ({
  id: `mock-attr-${attribute}`,
  adventure_run_id: 'mock',
  attribute,
  level: 3,
  current_xp: 20,
}))

const TUTORIAL_MOCK_INVENTORY: InventoryItemRow[] = [
  { id: 'mock-inv-1', adventure_run_id: 'mock', item_id: 'potion', quantity: 2 },
  { id: 'mock-inv-2', adventure_run_id: 'mock', item_id: 'small_shield', quantity: 1 },
]

/** No es una réplica: monta directamente TutorialOverlay.tsx real sobre los mocks de arriba, con
 * onRewardClaimed/onClose en vacío porque aquí no hay partida real a la que afectar. */
function TutorialPreview() {
  return (
    <TutorialOverlay
      character={TUTORIAL_MOCK_CHARACTER}
      attributeProgress={TUTORIAL_MOCK_ATTRIBUTE_PROGRESS}
      inventory={TUTORIAL_MOCK_INVENTORY}
      adventureRunId="mock"
      alreadyClaimed={false}
      onRewardClaimed={() => {}}
      onClose={() => {}}
    />
  )
}

type MockDashboardTab = 'missions' | 'battles' | 'market' | 'inventory'

/** Réplica visual de la cabecera rediseñada del Dashboard (Opción A): panel de
 * estado (medalla + nivel/rango + monedas + barras XP/HP) y navegación principal
 * de 4 pestañas con badge de Batallas pendientes + accesos secundarios. Mismos
 * valores de ejemplo que el resto de esta vista (nivel/XP/HP/monedas ficticios),
 * solo para revisar el estilo — no envía ni cambia nada real. */
function CabeceraDashboardPreview() {
  const [tab, setTab] = useState<MockDashboardTab>('missions')
  const mockLevel = 7
  const mockXp = 340
  const mockXpRequired = 500
  const mockHp = 22
  const mockMaxHp = 100
  const mockCoins = 128
  const mockPendingBossBattles = 2

  return (
    <>
      <Card className="status-panel">
        <div className="status-panel__top">
          <div className="status-panel__identity">
            <span className="status-panel__medal">{mockLevel}</span>
            <div className="status-panel__title">
              <span className="status-panel__level">NIVEL {mockLevel}</span>
              <span className="status-panel__rank">Rango: Aventurero</span>
            </div>
          </div>
          <span className="status-panel__coins">
            <img className="coin-icon" src="/ilustraciones/moneda.png" alt="" /> {mockCoins}
          </span>
        </div>

        <div className="status-panel__bars">
          <div className="status-panel__bar-row">
            <span className="status-panel__bar-label">XP</span>
            <div className="status-panel__bar-track">
              <ProgressBar current={mockXp} max={mockXpRequired} color="var(--color-xp)" />
            </div>
            <span className="status-panel__bar-value">
              {mockXp} / {mockXpRequired}
            </span>
          </div>
          <div className="status-panel__bar-row">
            <span className="status-panel__bar-label">HP</span>
            <div className="status-panel__bar-track">
              <ProgressBar
                current={mockHp}
                max={mockMaxHp}
                color={
                  mockHp / mockMaxHp > 0.5
                    ? 'var(--color-accent)'
                    : mockHp / mockMaxHp > 0.25
                      ? 'var(--color-accent-gold)'
                      : 'var(--color-danger)'
                }
              />
            </div>
            <span className="status-panel__bar-value">
              {mockHp} / {mockMaxHp}
            </span>
          </div>
        </div>
      </Card>

      <nav className="main-nav">
        <button
          className={`main-nav__tab${tab === 'missions' ? ' main-nav__tab--active' : ''}`}
          onClick={() => setTab('missions')}
        >
          <span className="main-nav__tab-icon">📜</span>
          Misiones
        </button>
        <button
          className={`main-nav__tab${tab === 'battles' ? ' main-nav__tab--active' : ''}`}
          onClick={() => setTab('battles')}
        >
          <span className="main-nav__tab-icon">⚔️</span>
          Batallas
          {mockPendingBossBattles > 0 && <span className="main-nav__badge">{mockPendingBossBattles}</span>}
        </button>
        <button
          className={`main-nav__tab${tab === 'market' ? ' main-nav__tab--active' : ''}`}
          onClick={() => setTab('market')}
        >
          <span className="main-nav__tab-icon">🛒</span>
          Mercado
        </button>
        <button
          className={`main-nav__tab${tab === 'inventory' ? ' main-nav__tab--active' : ''}`}
          onClick={() => setTab('inventory')}
        >
          <span className="main-nav__tab-icon">🎒</span>
          Mochila
        </button>
      </nav>

      <div className="secondary-links">
        <button className="secondary-links__link">🏆 Rangos</button>
        <button className="secondary-links__link">🏅 Logros</button>
        <button className="secondary-links__link">📖 Historial</button>
        <button className="secondary-links__link">📊 Atributos</button>
        <button className="secondary-links__link">🎓 Tutorial</button>
      </div>

      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
        Pestaña activa: <strong>{tab}</strong> — toca una pestaña o un acceso secundario para probar el resalte.
      </p>
    </>
  )
}

/** Revisión de RankPath (ver ui/RankPath.tsx) con un nivel de prueba ajustable, para comprobar
 * en vivo que el relleno parcial del tramo actual se recalcula bien contra RANKS/rankForLevel de
 * rules-engine — no es una réplica: es el mismo componente que usará RanksScreen.tsx. Nivel inicial
 * 6 porque reproduce tal cual el ejemplo del encargo (Novato 1–9, Aventurero empieza en 10 → tramo
 * relleno a (6-1)/(10-1) ≈ 55%). */
function RangosPreview() {
  const [level, setLevel] = useState(6)

  return (
    <>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <span className="field-label">Nivel de prueba</span>
        <input
          className="field-input"
          type="number"
          min={1}
          max={MAX_CHARACTER_LEVEL}
          value={level}
          onChange={(e) => {
            const next = Number(e.target.value)
            setLevel(Number.isFinite(next) ? Math.min(MAX_CHARACTER_LEVEL, Math.max(1, next)) : 1)
          }}
          style={{ width: '5rem' }}
        />
      </label>
      <RankPath level={level} />
    </>
  )
}

/** 2 de cada 7/6 logros marcados como conseguidos, para que la muestra enseñe ambos estados
 * (conseguido/bloqueado) en las dos categorías, no solo uno. Iconos: ACHIEVEMENT_ICONS (ya
 * aplicados a los 70 logros del catálogo, ver types/database.ts) — misma fuente que usa ya
 * AchievementsScreen.tsx real, no una copia local. */
const ACHIEVEMENT_UNLOCKED_PREVIEW = new Set(['mission_first', 'mission_10', 'boss_first_win', 'boss_5_wins'])

/** Vista previa de "Logros" (Paso 3, ya aplicado a AchievementsScreen.tsx): 2 categorías completas
 * del catálogo real (Misiones y Bosses) para revisar el criterio de iconos y el contraste fila
 * oscura / bloqueado sin tener que abrir la pantalla completa de 70 filas. */
function LogrosPreview() {
  return (
    <>
      {(['missions', 'bosses'] as const).map((category) => {
        const achievements = ACHIEVEMENT_CATALOG.filter((achievement) => achievement.category === category)
        return (
          <div key={category} className="achievement-group">
            <span className="achievement-group__label">{ACHIEVEMENT_CATEGORY_LABELS[category]}</span>
            <ul className="achievement-list">
              {achievements.map((achievement) => (
                <AchievementRow
                  key={achievement.id}
                  icon={ACHIEVEMENT_ICONS[achievement.id] ?? '❓'}
                  name={achievement.name}
                  description={achievement.requirementDescription}
                  unlocked={ACHIEVEMENT_UNLOCKED_PREVIEW.has(achievement.id)}
                />
              ))}
            </ul>
          </div>
        )
      })}
    </>
  )
}

/** Nivel/XP de muestra por atributo: cubre nivel bajo recién empezado (Intelecto, 0 XP), nivel
 * intermedio con progreso a mitad de barra (Vitalidad, igual que el mockup aprobado) y nivel
 * máximo (Fortuna, MAX_ATTRIBUTE_LEVEL) para revisar el caso "Nivel máximo" sin tener que forzarlo
 * en la partida real. */
const ATTRIBUTE_PREVIEW_LEVELS: Record<Attribute, number> = {
  vitality: 8,
  intellect: 1,
  discipline: 15,
  relations: 22,
  adventure: 5,
  fortune: MAX_ATTRIBUTE_LEVEL,
}

const ATTRIBUTE_PREVIEW_XP: Record<Attribute, number> = {
  vitality: 56,
  intellect: 0,
  discipline: 40,
  relations: 10,
  adventure: 12,
  fortune: 0,
}

/** Vista previa de "Atributos" (Paso 4, ya aplicado a AttributesScreen.tsx): los 6 atributos del
 * catálogo real, uno de ellos (Fortuna) en nivel máximo para comprobar ese caso sin tener que
 * forzarlo por SQL en la app real. */
function AtributosPreview() {
  return (
    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {ATTRIBUTES.map((attribute) => {
        const level = ATTRIBUTE_PREVIEW_LEVELS[attribute]
        const atMaxLevel = level >= MAX_ATTRIBUTE_LEVEL
        return (
          <AttributeCard
            key={attribute}
            icon={ATTRIBUTE_ICONS[attribute]}
            label={ATTRIBUTE_LABELS[attribute]}
            color={ATTRIBUTE_COLORS[attribute]}
            level={level}
            atMaxLevel={atMaxLevel}
            currentXp={ATTRIBUTE_PREVIEW_XP[attribute]}
            requiredXp={attributeXpRequiredForLevel(level)}
          />
        )
      })}
    </ul>
  )
}

/** "Ahora" desplazado por días/horas, para construir el mock de abajo — así la agrupación por día
 * (HOY/AYER/fecha) sale correcta sea cual sea el momento real en que se abra esta vista previa, en
 * vez de depender de una fecha fija como MOCK_TODAY (sección Misiones). */
function mockOccurredAt(daysAgo: number, hour: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

function achievementName(id: string): string {
  return ACHIEVEMENT_CATALOG.find((achievement) => achievement.id === id)?.name ?? id
}

/** Un evento de cada uno de los 13 event_type (documento 15.1), repartido en 3 días (hoy, ayer, hace
 * 2 días) para probar también la agrupación por día. Usa los catálogos reales (ITEM_CATALOG,
 * ACHIEVEMENT_CATALOG) para nombres/precios en vez de inventarlos. */
const MOCK_HISTORY_EVENTS: HistoryEventRowData[] = [
  {
    id: 'h1',
    adventure_run_id: 'mock',
    event_type: 'mission_completed',
    occurred_at: mockOccurredAt(0, 9),
    payload: {
      mission_id: 'm1',
      mission_name: 'Entrenamiento de fuerza',
      mission_type: 'routine',
      difficulty: 'easy',
      primary_attribute: 'vitality',
      secondary_attribute: null,
      xp_general: 30,
      xp_primary: 30,
      xp_secondary: null,
      occurrence_date: null,
    },
  },
  {
    id: 'h2',
    adventure_run_id: 'mock',
    event_type: 'mission_failed',
    occurred_at: mockOccurredAt(0, 8),
    payload: {
      mission_id: 'm2',
      mission_name: 'Entregar documentación',
      mission_type: 'task',
      difficulty: 'medium',
      occurrence_date: null,
      damage: 5,
    },
  },
  {
    id: 'h3',
    adventure_run_id: 'mock',
    event_type: 'achievement_unlocked',
    occurred_at: mockOccurredAt(0, 7),
    payload: { achievement_id: 'mission_first', achievement_name: achievementName('mission_first'), category: 'missions' },
  },
  {
    id: 'h4',
    adventure_run_id: 'mock',
    event_type: 'item_purchased',
    occurred_at: mockOccurredAt(0, 6),
    payload: {
      item_id: 'potion',
      item_name: ITEM_CATALOG.potion.displayName,
      price: ITEM_CATALOG.potion.price,
      coins_after: 98,
    },
  },
  {
    id: 'h5',
    adventure_run_id: 'mock',
    event_type: 'mission_deleted',
    occurred_at: mockOccurredAt(0, 5),
    payload: { mission_id: 'm5', mission_name: 'Ordenar el trastero', mission_type: 'task', difficulty: 'trivial' },
  },
  {
    id: 'h6',
    adventure_run_id: 'mock',
    event_type: 'level_up',
    occurred_at: mockOccurredAt(1, 20),
    payload: { from_level: 5, to_level: 6, levels_gained: 1 },
  },
  {
    id: 'h7',
    adventure_run_id: 'mock',
    event_type: 'boss_won',
    occurred_at: mockOccurredAt(1, 12),
    payload: {
      mission_id: 'b1',
      boss_name: 'Presentación ante el cliente',
      difficulty: 'boss_legendary',
      coins_gained: 500,
      xp_general: 500,
      xp_primary: 500,
      xp_secondary: 250,
      primary_attribute: 'relations',
      secondary_attribute: 'discipline',
      celestial_hand_consumed: true,
    },
  },
  {
    id: 'h8',
    adventure_run_id: 'mock',
    event_type: 'item_used',
    occurred_at: mockOccurredAt(1, 10),
    payload: { item_id: 'potion', item_name: ITEM_CATALOG.potion.displayName, heal_amount: 20 },
  },
  {
    id: 'h9',
    adventure_run_id: 'mock',
    event_type: 'shield_activated',
    occurred_at: mockOccurredAt(1, 9),
    payload: { item_id: 'small_shield', item_name: ITEM_CATALOG.small_shield.displayName, shield_type: 'small' },
  },
  {
    id: 'h10',
    adventure_run_id: 'mock',
    event_type: 'mission_evaded',
    occurred_at: mockOccurredAt(2, 18),
    payload: { mission_id: 'm10', mission_name: 'Renovar el pasaporte', mission_type: 'task', difficulty: 'hard', occurrence_date: null },
  },
  {
    id: 'h11',
    adventure_run_id: 'mock',
    event_type: 'boss_lost',
    occurred_at: mockOccurredAt(2, 15),
    payload: {
      mission_id: 'b2',
      boss_name: 'Entrevista de trabajo',
      difficulty: 'boss_minor',
      damage: 30,
      celestial_hand_consumed: false,
    },
  },
  {
    id: 'h12',
    adventure_run_id: 'mock',
    event_type: 'rank_changed',
    occurred_at: mockOccurredAt(2, 11),
    payload: { from_rank: 'Novato', to_rank: 'Aventurero' },
  },
  {
    id: 'h13',
    adventure_run_id: 'mock',
    event_type: 'totem_activated',
    occurred_at: mockOccurredAt(2, 10),
    payload: { context: 'boss_defeat', source_name: 'Entrevista de trabajo' },
  },
]

/** Vista previa de "Historial" (rediseño: diario de eventos agrupado por día, ver HistoryScreen.tsx):
 * etiqueta HOY/AYER/fecha por grupo, y por evento un marco de icono cuadrado (borde en el color del
 * tipo — verde completar/subir de nivel/logro, terracota fallar/recibir daño, dorado compra/objeto,
 * neutro para mission_deleted que no tiene recompensa ni penalización), texto principal con el
 * nombre entre comillas en negrita, y el delta (+XP/−HP/−monedas) resaltado en su color debajo. */
function HistorialPreview() {
  const dayGroups = groupEventsByDay(MOCK_HISTORY_EVENTS, todayLocalDateString())

  return (
    <>
      {dayGroups.map((group) => (
        <div key={group.dateStr} className="history-day-group">
          <span className="history-day-group__label">{group.label}</span>
          <ul className="history-list">
            {group.events.map((event) => {
              const { title, deltaLines, noteLines } = splitEventLines(formatHistoryEventLines(event))
              return (
                <HistoryEventRow
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
      ))}
    </>
  )
}

/** Vista previa de "Estadísticas" (rediseño de jerarquía, ver HistoryScreen.tsx): usa el mismo
 * StatSectionHeader (--font-title, --text-lg) y StatRow (--font-body, --text-base) reales, para que
 * quede claro que los encabezados de sección ahora destacan sobre las filas que agrupan — antes era
 * al revés, con encabezados más pequeños (0.85em) que las filas. "General" es la única sección
 * nueva: agrupa el primer bloque de cifras, que antes no tenía ningún título. */
function EstadisticasPreview() {
  const completedByDifficulty: Partial<Record<Difficulty, number>> = { trivial: 9, easy: 14, medium: 12, hard: 5, epic: 2 }
  const completedByAttribute: Partial<Record<Attribute, number>> = {
    vitality: 11,
    intellect: 9,
    discipline: 8,
    relations: 6,
    adventure: 5,
    fortune: 3,
  }

  return (
    <>
      <StatSectionHeader>General</StatSectionHeader>
      <StatRow label="Misiones completadas" value={42} />
      <StatRow label="Misiones falladas" value={7} />
      <StatRow label="Misiones eliminadas" value={2} />
      <StatRow label="Misiones evitadas" value={1} />
      <StatRow label="Porcentaje de éxito" value="86%" />

      <StatSectionHeader>Completadas por dificultad</StatSectionHeader>
      {MISSION_DIFFICULTIES.map((difficulty) => (
        <StatRow key={difficulty} label={DIFFICULTY_LABELS[difficulty]} value={completedByDifficulty[difficulty] ?? 0} />
      ))}

      <StatSectionHeader>Completadas por atributo</StatSectionHeader>
      {ATTRIBUTES.map((attribute) => (
        <StatRow key={attribute} label={ATTRIBUTE_LABELS[attribute]} value={completedByAttribute[attribute] ?? 0} />
      ))}

      <StatSectionHeader>Otras estadísticas</StatSectionHeader>
      <StatRow label="Bosses ganados" value={4} />
      <StatRow label="Bosses perdidos" value={1} />
      <StatRow label="Monedas obtenidas" value={860} />
    </>
  )
}

/** Vista previa de las pestañas internas de Historial y estadísticas (antes apiladas en una sola
 * pantalla larga): mismo patrón .tab-row + Button primary/secondary que Mochila/Mercado (fondo
 * --color-accent en la activa, borde --color-border en la inactiva). Por defecto se abre en
 * "Historial" — es el contenido que se revisa con más frecuencia (a diario, tipo feed de
 * actividad); "Estadísticas" es una consulta más ocasional. */
function HistorialEstadisticasTabsPreview() {
  const [activeTab, setActiveTab] = useState<'historial' | 'estadisticas'>('historial')

  return (
    <>
      <div className="tab-row" style={{ margin: '0 0 0.75rem' }}>
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
      {activeTab === 'historial' ? <HistorialPreview /> : <EstadisticasPreview />}
    </>
  )
}

type AuthPreviewMode = 'signIn' | 'signUp'
type AuthPreviewMessage = 'none' | 'error' | 'info'

/** Réplica visual de AuthScreen.tsx: título de bienvenida (LVL UP + línea dorada + subtítulo)
 * seguido de la misma Card con pestañas Iniciar sesión/Crear cuenta que sustituye al antiguo
 * enlace de texto "¿No tienes cuenta? Créala". No llama a supabase.auth — el selector de
 * mensaje de abajo solo alterna entre los tres estados reales del formulario (ninguno/error/
 * confirmación) para poder revisarlos sin forzar un error o registro real. */
function AuthPreview() {
  const [mode, setMode] = useState<AuthPreviewMode>('signIn')
  const [message, setMessage] = useState<AuthPreviewMessage>('none')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="auth-brand">
        <h1 className="auth-brand-title">LVL UP</h1>
        <div className="auth-brand-rule" />
        <p className="auth-brand-subtitle">Convierte tus hábitos en aventura</p>
      </div>

      <Card className="auth-card">
        <div className="tab-row auth-tabs">
          <Button type="button" variant={mode === 'signIn' ? 'primary' : 'secondary'} onClick={() => setMode('signIn')}>
            Iniciar sesión
          </Button>
          <Button type="button" variant={mode === 'signUp' ? 'primary' : 'secondary'} onClick={() => setMode('signUp')}>
            Crear cuenta
          </Button>
        </div>

        <form className="auth-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            <span className="field-label">Email</span>
            <input className="field-input" type="email" placeholder="tu@email.com" />
          </label>

          <label>
            <span className="field-label">Contraseña</span>
            <input className="field-input" type="password" placeholder="••••••••" />
          </label>

          {message === 'error' && (
            <p className="auth-message auth-message--error">Credenciales incorrectas.</p>
          )}
          {message === 'info' && (
            <p className="auth-message auth-message--info">
              Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión.
            </p>
          )}

          <Button type="submit" variant="primary" className="auth-submit">
            {mode === 'signIn' ? 'Entrar a la aventura' : 'Crear cuenta'}
          </Button>
        </form>
      </Card>

      <div className="tab-row" style={{ marginTop: '1rem' }}>
        <Button variant={message === 'none' ? 'primary' : 'secondary'} onClick={() => setMessage('none')}>
          Sin mensaje
        </Button>
        <Button variant={message === 'error' ? 'primary' : 'secondary'} onClick={() => setMessage('error')}>
          Ver error
        </Button>
        <Button variant={message === 'info' ? 'primary' : 'secondary'} onClick={() => setMessage('info')}>
          Ver confirmación
        </Button>
      </div>
    </div>
  )
}

/**
 * Vista temporal de solo lectura para revisar visualmente el sistema de
 * diseño (Paso 1 de 5) antes de aplicarlo a las pantallas reales (Paso 3).
 * Accesible en /design-system, sin necesidad de sesión iniciada.
 */
export function DesignSystemPreview() {
  return (
    <main style={{ width: '100%', maxWidth: '480px', textAlign: 'left', alignItems: 'stretch' }}>
      <h1>Sistema de diseño</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: '-0.75rem' }}>
        Paso 1 de 5 — solo vista previa, ninguna pantalla real usa esto todavía.
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Tipografía</h2>
        <h1>H1 · Lvl UP</h1>
        <h2>H2 · Misiones activas</h2>
        <h3>H3 · Atención requerida</h3>
        <p style={{ fontSize: 'var(--text-base)' }}>Texto base (Nunito) — cuerpo de listas y descripciones.</p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          Texto secundario (--text-sm, --color-text-secondary) — metadatos, fechas, ayuda.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Paleta</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
          {(
            [
              ['--color-bg', 'bg'],
              ['--color-surface', 'surface'],
              ['--color-border', 'border'],
              ['--color-text', 'text'],
              ['--color-text-secondary', 'text-secondary'],
              ['--color-accent', 'accent'],
              ['--color-accent-gold', 'accent-gold'],
              ['--color-danger', 'danger'],
            ] as const
          ).map(([variable, label]) => (
            <div key={variable} style={{ textAlign: 'center' }}>
              <div
                style={{
                  height: '48px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: `var(${variable})`,
                }}
              />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Card</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Card>
            <strong>Default</strong>
            <p style={{ margin: '0.25rem 0 0' }}>Misión: Ordenar el escritorio</p>
          </Card>
          <Card variant="highlighted">
            <strong>Highlighted</strong>
            <p style={{ margin: '0.25rem 0 0' }}>Rango actual: Aventurero</p>
          </Card>
          <Card variant="dimmed">
            <strong>Dimmed</strong>
            <p style={{ margin: '0.25rem 0 0' }}>Logro bloqueado: Vencer 10 Bosses</p>
          </Card>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Button</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <Button variant="primary">Completar</Button>
          <Button variant="secondary">Volver</Button>
          <Button variant="danger">Derrota</Button>
          <Button variant="primary" disabled>
            Deshabilitado
          </Button>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>ProgressBar</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <p style={{ margin: '0 0 0.25rem', fontSize: 'var(--text-sm)' }}>HP alto (verde musgo)</p>
            <ProgressBar current={80} max={100} color="var(--color-accent)" />
          </div>
          <div>
            <p style={{ margin: '0 0 0.25rem', fontSize: 'var(--text-sm)' }}>HP bajo (terracota)</p>
            <ProgressBar current={15} max={100} color="var(--color-danger)" />
          </div>
          <div>
            <p style={{ margin: '0 0 0.25rem', fontSize: 'var(--text-sm)' }}>XP de atributo (dorado)</p>
            <ProgressBar current={35} max={100} color="var(--color-accent-gold)" />
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Badge</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <Badge variant="success" icon="✅">
            Conseguido
          </Badge>
          <Badge variant="locked" icon="🔒">
            Bloqueado
          </Badge>
          <Badge variant="gold" icon="🏆">
            Rango: Leyenda
          </Badge>
          <Badge variant="danger" icon="⚠️">
            Peligro
          </Badge>
          <Badge variant="neutral" icon="🧪">
            Común
          </Badge>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Auth (bienvenida + iniciar sesión / crear cuenta)</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: '-0.5rem' }}>
          Sustituye el &lt;h1&gt;Lvl UP&lt;/h1&gt; + formulario plano de antes: título de bienvenida
          centrado (LVL UP + línea dorada + subtítulo) sobre la misma Card ya aprobada, con pestañas
          Iniciar sesión/Crear cuenta (mismo patrón que Mochila/Mercado) en vez del enlace de texto
          subrayado "¿No tienes cuenta? Créala". Prueba a cambiar de pestaña y a alternar los botones
          de abajo para ver el error (terracota) y la confirmación de registro (verde) con los colores
          ya unificados.
        </p>
        <AuthPreview />
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Cabecera del Dashboard (Opción A)</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: '-0.5rem' }}>
          Sustituye los &lt;p&gt; sueltos de Nivel/XP/HP/Rango/Monedas y los 4 botones planos de
          navegación. Medalla + Nivel/Rango arriba, monedas en píldora a la derecha, barras XP
          (dorado) y HP (verde/terracota según el mismo umbral de siempre) reutilizando ProgressBar.
          4 pestañas (Misiones/Batallas/Mercado/Mochila) con el relieve ya aprobado de los botones —
          "Batallas" lleva el badge circular solo si hay pendientes. Atributos ya no es una pestaña:
          vive en los accesos secundarios de abajo junto a Rangos/Logros/Historial/Tutorial.
        </p>
        <CabeceraDashboardPreview />
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Cabecera de pantalla secundaria</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: '-0.5rem' }}>
          Rangos/Logros/Historial/Atributos comparten esta cabecera: título centrado + flecha de
          volver discreta en la esquina, en vez del botón grande "Volver" de antes. La tercera
          columna (vacía) compensa el ancho de la flecha para que el título quede centrado de
          verdad. Las 4 a continuación, una debajo de otra con el mismo ancho de contenedor, para
          comprobar que la flecha queda en la misma posición horizontal sin importar la longitud
          del título ("Rangos" vs "Atributos").
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {['Rangos', 'Logros', 'Historial', 'Atributos'].map((title) => (
            <div key={title} style={{ border: '1px dashed var(--color-border)', borderRadius: '10px', padding: '0.75rem' }}>
              <ScreenHeader title={title} onBack={() => {}} />
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Rangos (pase de batalla)</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: '-0.5rem' }}>
          Camino vertical conectado por una línea de progreso, en vez de 8 tarjetas independientes:
          el objeto de recompensa (o 🏆 si el rango no da objeto) es ahora el elemento grande de
          cada nodo. Verde con relieve sólido en lo ya alcanzado, borde discontinuo neutro en lo
          pendiente. El tramo entre el rango actual y el siguiente se rellena proporcionalmente al
          nivel real dentro de ese tramo (RANKS/rankForLevel de rules-engine — no un valor fijo).
          Cambia el nivel de prueba para verlo recalcularse.
        </p>
        <RangosPreview />
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Logros (advancement de Minecraft)</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: '-0.5rem' }}>
          Cada fila vive sobre fondo oscuro (--color-bg-dark), no el pergamino claro del resto de la
          app — una "vitrina de trofeos" con su propio contraste. Agrupado por categoría (etiqueta
          pequeña en --font-title arriba de cada grupo), ranura de icono cuadrada a la izquierda,
          título + requisito debajo. Conseguido = ranura y título en dorado, fila a opacidad
          completa; bloqueado = fila al 40%, icono en escala de grises. Muestra con las 2 categorías
          completas de Misiones (7) y Bosses (6) del catálogo real, 2 logros de cada una marcados
          como conseguidos para comparar ambos estados — antes de generar los iconos de los 70.
        </p>
        <LogrosPreview />
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Atributos</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: '-0.5rem' }}>
          Tarjeta por atributo con el mismo lenguaje que la tarjeta de misión: borde e icono con
          degradado en el color de identidad del atributo (ATTRIBUTE_COLORS/ATTRIBUTE_ICONS, ver
          types/database.ts). Nombre en --font-title arriba a la izquierda, nivel alineado a la
          derecha en la misma línea; barra de XP con la cifra actual/requerida debajo, también
          alineada a la derecha. Fortuna está en nivel máximo (50) para comprobar ese caso: la barra
          queda llena y el texto "Nivel máximo" sustituye a la cifra de XP, en el color del atributo.
        </p>
        <AtributosPreview />
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Historial y estadísticas (pestañas internas)</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: '-0.5rem' }}>
          Historial y Estadísticas ya no van apiladas en una sola pantalla larga: dos pestañas
          internas justo debajo de la cabecera, mismo patrón .tab-row + Button primary/secondary que
          Mochila/Mercado. Cambiar de pestaña no requiere scroll ni salir de la pantalla. Prueba a
          tocar "Estadísticas": los encabezados de sección ahora usan --font-title en --text-lg,
          mayor que las StatRow que agrupan (antes era al revés), y el primer bloque de cifras tiene
          un título nuevo ("General") que antes no existía. Eventos del Historial agrupados por día
          local (HOY/AYER/"D de mes"), cada uno con marco de icono cuadrado — borde verde
          (--color-accent) para completar/subir de nivel/logro, terracota (--color-danger) para
          fallar/recibir daño, dorado (--color-accent-gold) para compra/objeto, neutro
          (--color-border) para mission_deleted, que no da recompensa ni penalización.
        </p>
        <HistorialEstadisticasTabsPreview />
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Mochila</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: '-0.5rem' }}>
          Pestañas por categoría + lista compacta seleccionable + panel de detalle fijo, calcado del
          patrón real de la mochila de Pokémon (GBA/DS) — no una rejilla de tarjetas. Toca una pestaña
          y luego una fila para ver cómo cambia el panel de abajo.
        </p>
        <MochilaPreview />
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Mercado</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: '-0.5rem' }}>
          Mismo patrón que la Mochila (pestañas + lista + panel de detalle), con dos diferenciadores:
          el cuadro de diálogo del mercader de arriba —cambia de frase según selecciones un objeto que
          no puedas pagar, o tras "comprar"— y el acento dorado en vez del verde musgo. Prueba a elegir
          la Mano Celestial o el Tótem (150 monedas no llegan) y luego compra algo asequible.
        </p>
        <MercadoPreview />
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Misiones</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: '-0.5rem' }}>
          Cada tarjeta lleva una zona de atributo grande (icono protagonista + color sólido, un
          tercio superior) con degradado a juego en el cuerpo, y una zona propia de estrellas de
          dificultad (★★★☆☆). "Completar" / "Eliminar" están siempre visibles al pie — sin
          gesto ni menú, Completar dispara el mismo margen de 5s para deshacer de siempre. "Batallas
          pendientes" (hoy: {MOCK_TODAY}) sigue arriba, como página especial de borde dorado.
        </p>
        <MisionesListPreview />
        <h3 style={{ marginTop: '1.5rem' }}>Formulario de nueva misión</h3>
        <MisionesFormPreview />
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Batalla contra Boss</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: '-0.5rem' }}>
          Escenario de combate: fondo oscuro (--color-bg-dark, sin uso hasta ahora) + marco dorado
          grueso, deliberadamente distinto del resto de la app. El hexágono del Boss reutiliza el
          mismo color/icono por atributo que ya usan las tarjetas de misión; el jugador es un
          hexágono neutro con silueta genérica. El anillo extra alrededor del hexágono marca el
          nivel de amenaza (Menor: ninguno, Importante: uno, Legendario: dos). Prueba el primer
          ejemplo de principio a fin (Victoria/Derrota → Confirmar → Resultado → Continuar).
        </p>

        <h3>Boss Menor — interactivo</h3>
        <BossBattlePreviewCard mission={MOCK_BOSS_MINOR} />

        <h3 style={{ marginTop: '1.5rem' }}>Boss Importante — anillo intermedio</h3>
        <BossBattlePreviewCard mission={MOCK_BOSS_MAJOR} />

        <h3 style={{ marginTop: '1.5rem' }}>Boss Legendario — doble anillo de amenaza</h3>
        <BossBattlePreviewCard mission={MOCK_BOSS_LEGENDARY} />

        <h3 style={{ marginTop: '1.5rem' }}>Resultado — Victoria</h3>
        <BossBattlePreviewCard mission={MOCK_BOSS_LEGENDARY} initialResult="victory" />

        <h3 style={{ marginTop: '1.5rem' }}>Resultado — Derrota (con Mano Celestial y Tótem)</h3>
        <BossBattlePreviewCard mission={MOCK_BOSS_MAJOR} initialResult="defeat" celestialHandConsumed totemActivated />
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Tutorial</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: '-0.5rem' }}>
          Cabecera título+"Saltar tutorial" (mismo criterio discreto que el resto de enlaces
          secundarios) y barra de progreso de los 12 pasos arriba; cuadro de diálogo del mentor
          (mismo patrón que MerchantDialogueBox, en verde en vez de dorado, con 🧙 en vez del
          mercader) con el texto explicativo de cada paso; debajo, la vista previa en vivo del
          control de ese paso ya con el estilo real de la app (StarPicker, chips de atributo,
          ProgressBar, filas de Mochila/Mercado...) sobre datos de personaje de muestra; abajo,
          Atrás/Paso N de 12/Siguiente. Es el mismo TutorialOverlay.tsx real, montado sobre datos
          de muestra — recorre los 12 pasos para revisar cada control.
        </p>
        <TutorialPreview />
      </section>
    </main>
  )
}
