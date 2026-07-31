import type { CharacterState } from './types.js'

export function isDead(character: CharacterState): boolean {
  return character.currentHp <= 0
}

/**
 * Aplica una secuencia de eventos de daño en orden cronológico. El Tótem de
 * la Inmortalidad se activa en el primer evento que dejaría la vida en 0 o
 * menos: deja al personaje en 1 HP, se consume, y los eventos siguientes
 * siguen aplicándose con normalidad (el personaje puede volver a morir).
 */
export function applyDamageSequence(
  character: CharacterState,
  damageEvents: { amount: number }[],
  hasTotem: boolean,
): { finalState: CharacterState; totemConsumed: boolean; isDead: boolean } {
  let currentHp = character.currentHp
  let totemAvailable = hasTotem
  let totemConsumed = false

  for (const event of damageEvents) {
    if (currentHp <= 0) break

    currentHp -= event.amount

    if (currentHp <= 0) {
      if (totemAvailable) {
        currentHp = 1
        totemAvailable = false
        totemConsumed = true
      } else {
        currentHp = 0
        break
      }
    }
  }

  const finalState: CharacterState = { ...character, currentHp }
  return { finalState, totemConsumed, isDead: currentHp <= 0 }
}
