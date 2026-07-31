import { describe, expect, it } from 'vitest'
import { ITEM_CATALOG, MAX_HP } from '../src/constants.js'
import { applyHealing, canAddItemToInventory, healingAmountForItem } from '../src/items.js'
import type { CharacterState, ItemId } from '../src/types.js'

describe('ITEM_CATALOG', () => {
  it('contiene exactamente los 8 objetos del documento (sección 8.2)', () => {
    expect(Object.keys(ITEM_CATALOG).sort()).toEqual(
      [
        'celestial_hand',
        'escape_rope',
        'hyper_potion',
        'immortality_totem',
        'large_shield',
        'potion',
        'small_shield',
        'super_potion',
      ].sort(),
    )
  })

  it.each([
    ['potion', 'common', 30, null],
    ['super_potion', 'rare', 70, null],
    ['hyper_potion', 'epic', 130, null],
    ['small_shield', 'common', 40, null],
    ['large_shield', 'rare', 110, null],
    ['escape_rope', 'rare', 150, 5],
    ['celestial_hand', 'epic', 180, 3],
    ['immortality_totem', 'legendary', 400, 1],
  ] satisfies [ItemId, string, number, number | null][])(
    '%s: rareza %s, precio %i, límite %s (documento 8.2 y 8.13)',
    (itemId, rarity, price, stackLimit) => {
      const item = ITEM_CATALOG[itemId]
      expect(item.rarity).toBe(rarity)
      expect(item.price).toBe(price)
      expect(item.stackLimit).toBe(stackLimit)
    },
  )
})

describe('healingAmountForItem', () => {
  it.each([
    ['potion', 5],
    ['super_potion', 10],
    ['hyper_potion', 20],
  ] satisfies [ItemId, number][])('%s cura %i HP', (itemId, expected) => {
    expect(healingAmountForItem(itemId)).toBe(expected)
  })

  it('lanza si el objeto no cura', () => {
    expect(() => healingAmountForItem('small_shield')).toThrow()
    expect(() => healingAmountForItem('immortality_totem')).toThrow()
  })
})

describe('applyHealing', () => {
  const character: CharacterState = { level: 3, currentXp: 0, currentHp: 50 }

  it('cura sin superar MAX_HP', () => {
    const result = applyHealing(character, 20)
    expect(result.currentHp).toBe(70)
  })

  it('la curación sobrante se pierde: no supera 100 HP (documento 8.6)', () => {
    const nearMax: CharacterState = { ...character, currentHp: 95 }
    const result = applyHealing(nearMax, 20)
    expect(result.currentHp).toBe(MAX_HP)
  })

  it('no modifica level ni currentXp', () => {
    const result = applyHealing(character, 5)
    expect(result.level).toBe(character.level)
    expect(result.currentXp).toBe(character.currentXp)
  })
})

describe('canAddItemToInventory', () => {
  it('los objetos sin límite (potion) siempre permiten añadir, sea cual sea la cantidad', () => {
    expect(canAddItemToInventory('potion', 0)).toBe(true)
    expect(canAddItemToInventory('potion', 999)).toBe(true)
  })

  it('escape_rope (límite 5): permite hasta 4, no permite en 5', () => {
    expect(canAddItemToInventory('escape_rope', 4)).toBe(true)
    expect(canAddItemToInventory('escape_rope', 5)).toBe(false)
  })

  it('celestial_hand (límite 3): permite hasta 2, no permite en 3', () => {
    expect(canAddItemToInventory('celestial_hand', 2)).toBe(true)
    expect(canAddItemToInventory('celestial_hand', 3)).toBe(false)
  })

  it('immortality_totem (límite 1): permite en 0, no permite en 1', () => {
    expect(canAddItemToInventory('immortality_totem', 0)).toBe(true)
    expect(canAddItemToInventory('immortality_totem', 1)).toBe(false)
  })
})
