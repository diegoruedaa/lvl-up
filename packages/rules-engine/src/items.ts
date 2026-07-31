import { ITEM_CATALOG, MAX_HP, POTION_HEAL_AMOUNT } from './constants.js'
import type { CharacterState, ItemId } from './types.js'

type PotionItemId = keyof typeof POTION_HEAL_AMOUNT

function isPotionItemId(itemId: ItemId): itemId is PotionItemId {
  return itemId in POTION_HEAL_AMOUNT
}

/** HP que recupera un objeto de curación. Lanza si el objeto no cura. */
export function healingAmountForItem(itemId: ItemId): number {
  if (!isPotionItemId(itemId)) {
    throw new Error(`${itemId} no es un objeto de curación`)
  }
  return POTION_HEAL_AMOUNT[itemId]
}

/** Cura `amount` HP sin superar MAX_HP (documento 8.6: la curación sobrante se pierde). */
export function applyHealing(character: CharacterState, amount: number): CharacterState {
  return { ...character, currentHp: Math.min(MAX_HP, character.currentHp + amount) }
}

/** Compara currentQuantity contra el stackLimit del catálogo (null = sin límite). */
export function canAddItemToInventory(itemId: ItemId, currentQuantity: number): boolean {
  const stackLimit = ITEM_CATALOG[itemId].stackLimit
  if (stackLimit === null) return true
  return currentQuantity < stackLimit
}
