import { useState } from 'react'
import { ITEM_CATALOG } from 'rules-engine'
import type { ItemId } from 'rules-engine'
import { getErrorMessage } from '../lib/errors'
import {
  activateCelestialHand,
  activateShield,
  applyEscapeRopeToRoutine,
  applyEscapeRopeToTask,
  consumePotion,
} from '../lib/gameApi'
import {
  ITEM_EFFECT_DESCRIPTIONS,
  ITEM_ICONS,
  RARITY_COLORS,
  RARITY_LABELS,
  summarizePendingRewardNames,
} from '../types/database'
import type {
  AchievementProgressRow,
  CharacterRow,
  InventoryItemRow,
  MissionRow,
  PendingRewardRow,
  ShieldItemId,
} from '../types/database'
import { Button, Card, ItemDetailPanel, ItemRow } from './ui'

type MochilaCategoryId = 'healing' | 'defense' | 'special'

const MOCHILA_CATEGORIES: { id: MochilaCategoryId; label: string }[] = [
  { id: 'healing', label: 'Curación' },
  { id: 'defense', label: 'Defensa' },
  { id: 'special', label: 'Especiales' },
]

/** Agrupación de los 8 objetos en 3 categorías con sentido temático (aprobada en /design-system).
 * Las recompensas pendientes no son una categoría: viven en el aviso de arriba de la lista. */
const CATEGORY_ITEM_IDS: Record<MochilaCategoryId, ItemId[]> = {
  healing: ['potion', 'super_potion', 'hyper_potion'],
  defense: ['small_shield', 'large_shield', 'celestial_hand'],
  special: ['escape_rope', 'immortality_totem'],
}

interface InventoryScreenProps {
  adventureRunId: string
  character: CharacterRow
  inventory: InventoryItemRow[]
  /** Recompensas de rango (documento 12.4) que no cupieron en la mochila y siguen sin reclamar. */
  pendingRewards: PendingRewardRow[]
  /** Misiones activas elegibles para Cuerda Huida (rutinas ya resueltas hoy excluidas). */
  missions: MissionRow[]
  today: string
  /** Si ya hay una Mano Celestial activada (active_celestial_hand) para esta partida. */
  celestialHandActive: boolean
  onHeal: (character: CharacterRow, inventoryItem: InventoryItemRow) => void
  onShieldActivated: (inventoryItem: InventoryItemRow) => void
  /** achievementUnlocked no es nulo si esta activación acaba de desbloquear 'celestial_hand_used_first' (La parada celestial). */
  onCelestialHandActivated: (inventoryItem: InventoryItemRow, achievementUnlocked: AchievementProgressRow | null) => void
  /** achievementUnlocked no es nulo si este uso acaba de desbloquear 'escape_rope_used' (Huida estratégica). */
  onEscapeRopeUsed: (
    mission: MissionRow,
    inventoryItem: InventoryItemRow,
    achievementUnlocked: AchievementProgressRow | null,
  ) => void
}

export function InventoryScreen({
  adventureRunId,
  character,
  inventory,
  pendingRewards,
  missions,
  today,
  celestialHandActive,
  onHeal,
  onShieldActivated,
  onCelestialHandActivated,
  onEscapeRopeUsed,
}: InventoryScreenProps) {
  const [busyItemId, setBusyItemId] = useState<ItemId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [escapeRopeTargetId, setEscapeRopeTargetId] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<MochilaCategoryId>('healing')
  const [selectedItemId, setSelectedItemId] = useState<ItemId | null>(() => {
    const initialRows = inventory.filter(
      (row) => row.quantity > 0 && CATEGORY_ITEM_IDS.healing.includes(row.item_id),
    )
    return initialRows[0]?.item_id ?? null
  })

  const owned = inventory.filter((row) => row.quantity > 0)

  function rowsForCategory(categoryId: MochilaCategoryId): InventoryItemRow[] {
    return owned.filter((row) => CATEGORY_ITEM_IDS[categoryId].includes(row.item_id))
  }

  function selectCategory(categoryId: MochilaCategoryId) {
    setSelectedCategory(categoryId)
    const nextRows = rowsForCategory(categoryId)
    setSelectedItemId(nextRows[0]?.item_id ?? null)
  }

  const rows = rowsForCategory(selectedCategory)
  const selectedInventoryItem = rows.find((row) => row.item_id === selectedItemId) ?? null
  const selectedItem = selectedInventoryItem ? ITEM_CATALOG[selectedInventoryItem.item_id] : null
  const busy = selectedInventoryItem !== null && busyItemId === selectedInventoryItem.item_id

  async function handleUsePotion(inventoryItem: InventoryItemRow) {
    setError(null)
    setBusyItemId(inventoryItem.item_id)
    try {
      const outcome = await consumePotion(character, inventoryItem.item_id, inventoryItem)
      onHeal(outcome.character, outcome.inventoryItem)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyItemId(null)
    }
  }

  async function handleActivateShield(inventoryItem: InventoryItemRow) {
    setError(null)
    setBusyItemId(inventoryItem.item_id)
    try {
      const updated = await activateShield(adventureRunId, inventoryItem.item_id as ShieldItemId, inventoryItem)
      onShieldActivated(updated)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyItemId(null)
    }
  }

  async function handleActivateCelestialHand(inventoryItem: InventoryItemRow) {
    setError(null)
    setBusyItemId(inventoryItem.item_id)
    try {
      const outcome = await activateCelestialHand(adventureRunId, inventoryItem)
      onCelestialHandActivated(outcome.inventoryItem, outcome.achievementUnlocked)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyItemId(null)
    }
  }

  async function handleUseEscapeRope(inventoryItem: InventoryItemRow) {
    const mission = missions.find((m) => m.id === escapeRopeTargetId)
    if (!mission) {
      setError('Elige una misión sobre la que usar la Cuerda Huida.')
      return
    }

    setError(null)
    setBusyItemId(inventoryItem.item_id)
    try {
      const outcome =
        mission.type === 'task'
          ? await applyEscapeRopeToTask(mission, inventoryItem)
          : await applyEscapeRopeToRoutine(mission, today, inventoryItem)
      onEscapeRopeUsed(mission, outcome.inventoryItem, outcome.achievementUnlocked)
      setEscapeRopeTargetId('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyItemId(null)
    }
  }

  return (
    <div>
      <h2>Mochila</h2>
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {pendingRewards.length > 0 && (
        <p className="pending-reward-banner">
          <span aria-hidden="true">🎁</span>
          <span>
            Tienes {pendingRewards.length} recompensa{pendingRewards.length === 1 ? '' : 's'} en espera:{' '}
            {summarizePendingRewardNames(pendingRewards.map((reward) => reward.item_id))} — se entregará
            {pendingRewards.length === 1 ? '' : 'n'} cuando haya espacio en la mochila.
          </span>
        </p>
      )}

      {owned.length === 0 ? (
        <p>No tienes ningún objeto todavía. Cómpralos en el mercado.</p>
      ) : (
        <>
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
              <p
                style={{ margin: 0, padding: '0.6rem', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}
              >
                No tienes objetos en esta categoría.
              </p>
            )}
            {rows.map((inventoryItem) => {
              const item = ITEM_CATALOG[inventoryItem.item_id]
              return (
                <ItemRow
                  key={inventoryItem.item_id}
                  icon={ITEM_ICONS[inventoryItem.item_id]}
                  name={item.displayName}
                  rarityColor={RARITY_COLORS[item.rarity]}
                  quantity={inventoryItem.quantity}
                  selected={inventoryItem.item_id === selectedItemId}
                  onSelect={() => setSelectedItemId(inventoryItem.item_id)}
                />
              )
            })}
          </div>

          {selectedInventoryItem && selectedItem ? (
            <ItemDetailPanel
              icon={ITEM_ICONS[selectedInventoryItem.item_id]}
              name={selectedItem.displayName}
              rarityColor={RARITY_COLORS[selectedItem.rarity]}
              rarityLabel={RARITY_LABELS[selectedItem.rarity]}
              description={ITEM_EFFECT_DESCRIPTIONS[selectedInventoryItem.item_id]}
            >
              {selectedItem.effectType === 'heal' && (
                <Button variant="primary" onClick={() => handleUsePotion(selectedInventoryItem)} disabled={busy}>
                  Usar
                </Button>
              )}

              {selectedItem.effectType === 'shield' && (
                <Button variant="primary" onClick={() => handleActivateShield(selectedInventoryItem)} disabled={busy}>
                  Activar
                </Button>
              )}

              {selectedItem.effectType === 'escape' && (
                <>
                  <select value={escapeRopeTargetId} onChange={(e) => setEscapeRopeTargetId(e.target.value)}>
                    <option value="">Elige misión...</option>
                    {missions.map((mission) => (
                      <option key={mission.id} value={mission.id}>
                        {mission.name} ({mission.type === 'task' ? 'Tarea' : 'Rutina'})
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="primary"
                    onClick={() => handleUseEscapeRope(selectedInventoryItem)}
                    disabled={busy || escapeRopeTargetId === ''}
                  >
                    Usar sobre misión
                  </Button>
                </>
              )}

              {selectedItem.effectType === 'boss_defense' &&
                (celestialHandActive ? (
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', fontStyle: 'italic' }}>
                    ✋ Activada: se aplicará al resolver tu próxima Batalla contra Boss (gana o pierda).
                  </p>
                ) : (
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
                    <Button
                      variant="primary"
                      onClick={() => handleActivateCelestialHand(selectedInventoryItem)}
                      disabled={busy}
                    >
                      Activar
                    </Button>
                  </>
                ))}

              {selectedItem.effectType === 'revive' && (
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', fontStyle: 'italic' }}>
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
      )}
    </div>
  )
}
