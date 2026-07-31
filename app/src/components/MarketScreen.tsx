import { useEffect, useRef, useState } from 'react'
import { ITEM_CATALOG } from 'rules-engine'
import type { ItemId } from 'rules-engine'
import { getErrorMessage } from '../lib/errors'
import { purchaseItem } from '../lib/gameApi'
import { ITEM_EFFECT_DESCRIPTIONS, ITEM_ICONS, RARITY_COLORS, RARITY_LABELS } from '../types/database'
import type { CharacterRow, InventoryItemRow } from '../types/database'
import { Button, Card, ItemDetailPanel, ItemRow, MerchantDialogueBox } from './ui'

type MarketCategoryId = 'healing' | 'defense' | 'special'

const MARKET_CATEGORIES: { id: MarketCategoryId; label: string }[] = [
  { id: 'healing', label: 'Curación' },
  { id: 'defense', label: 'Defensa' },
  { id: 'special', label: 'Especiales' },
]

/** Mismas 3 categorías que la Mochila (coherencia entre pantallas), pero aquí listan los 8
 * objetos siempre, tenga o no unidades el jugador — es una tienda, no un inventario. */
const CATEGORY_ITEM_IDS: Record<MarketCategoryId, ItemId[]> = {
  healing: ['potion', 'super_potion', 'hyper_potion'],
  defense: ['small_shield', 'large_shield', 'celestial_hand'],
  special: ['escape_rope', 'immortality_totem'],
}

const MERCHANT_WELCOME_LINE = '¡Bienvenido, aventurero! Echa un vistazo, tómate tu tiempo.'
const MERCHANT_NO_COINS_LINE = 'Vuelve cuando tengas más monedas...'
const MERCHANT_THANKS_LINE = '¡Buena elección! Que te sea útil.'
const MERCHANT_THANKS_DURATION_MS = 1800

interface MarketScreenProps {
  adventureRunId: string
  character: CharacterRow
  inventory: InventoryItemRow[]
  onPurchase: (character: CharacterRow, inventoryItem: InventoryItemRow) => void
}

export function MarketScreen({ adventureRunId, character, inventory, onPurchase }: MarketScreenProps) {
  const [busyItemId, setBusyItemId] = useState<ItemId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<MarketCategoryId>('healing')
  const [selectedItemId, setSelectedItemId] = useState<ItemId | null>(CATEGORY_ITEM_IDS.healing[0] ?? null)
  const [justPurchased, setJustPurchased] = useState(false)
  const thanksTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (thanksTimeoutRef.current !== null) window.clearTimeout(thanksTimeoutRef.current)
    }
  }, [])

  const quantityByItemId = new Map(inventory.map((row) => [row.item_id, row.quantity]))

  function selectCategory(categoryId: MarketCategoryId) {
    setSelectedCategory(categoryId)
    setSelectedItemId(CATEGORY_ITEM_IDS[categoryId][0] ?? null)
  }

  const rowItemIds = CATEGORY_ITEM_IDS[selectedCategory]
  const selectedItem = selectedItemId ? ITEM_CATALOG[selectedItemId] : null
  const selectedOwned = selectedItemId ? (quantityByItemId.get(selectedItemId) ?? 0) : 0
  const atLimit = selectedItem !== null && selectedItem.stackLimit !== null && selectedOwned >= selectedItem.stackLimit
  const canAfford = selectedItem !== null && character.coins >= selectedItem.price
  const busy = selectedItemId !== null && busyItemId === selectedItemId
  const disabled = atLimit || !canAfford || busy

  const merchantLine = justPurchased
    ? MERCHANT_THANKS_LINE
    : selectedItem && !canAfford
      ? MERCHANT_NO_COINS_LINE
      : MERCHANT_WELCOME_LINE

  async function handleBuy(itemId: ItemId) {
    setError(null)
    setBusyItemId(itemId)
    try {
      const currentQuantity = quantityByItemId.get(itemId) ?? 0
      const outcome = await purchaseItem(adventureRunId, character, itemId, currentQuantity)
      onPurchase(outcome.character, outcome.inventoryItem)

      if (thanksTimeoutRef.current !== null) window.clearTimeout(thanksTimeoutRef.current)
      setJustPurchased(true)
      thanksTimeoutRef.current = window.setTimeout(() => setJustPurchased(false), MERCHANT_THANKS_DURATION_MS)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyItemId(null)
    }
  }

  return (
    <div className="market-theme">
      <h2>Mercado</h2>
      <p>
        Monedas: {character.coins} <img className="coin-icon" src="/ilustraciones/moneda.png" alt="" />
      </p>

      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      <MerchantDialogueBox line={merchantLine} />

      <div className="tab-row">
        {MARKET_CATEGORIES.map((category) => (
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
          const owned = quantityByItemId.get(itemId) ?? 0
          return (
            <ItemRow
              key={itemId}
              icon={ITEM_ICONS[itemId]}
              name={item.displayName}
              rarityColor={RARITY_COLORS[item.rarity]}
              selected={itemId === selectedItemId}
              onSelect={() => setSelectedItemId(itemId)}
              ownedCount={owned}
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
          <Button variant="primary" onClick={() => handleBuy(selectedItemId)} disabled={disabled}>
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
