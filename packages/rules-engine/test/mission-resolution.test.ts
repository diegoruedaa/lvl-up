import { describe, expect, it } from 'vitest'
import { applyDamageSequence, isDead } from '../src/mission-resolution.js'
import type { CharacterState } from '../src/types.js'

const baseCharacter: CharacterState = { level: 5, currentXp: 20, currentHp: 10 }

describe('applyDamageSequence', () => {
  it('secuencia de fallos que mata sin Tótem', () => {
    const result = applyDamageSequence(baseCharacter, [{ amount: 5 }, { amount: 5 }, { amount: 5 }], false)

    expect(result.finalState.currentHp).toBe(0)
    expect(result.totemConsumed).toBe(false)
    expect(result.isDead).toBe(true)
  })

  it('misma secuencia con Tótem: sobrevive al primer golpe mortal con 1 HP pero puede morir después', () => {
    const result = applyDamageSequence(baseCharacter, [{ amount: 5 }, { amount: 5 }, { amount: 5 }], true)

    // evento1: 10 -> 5 (sigue vivo)
    // evento2: 5 -> 0, Tótem se activa -> 1 HP, se consume
    // evento3: 1 -> -4, sin Tótem disponible -> muere de verdad
    expect(result.finalState.currentHp).toBe(0)
    expect(result.totemConsumed).toBe(true)
    expect(result.isDead).toBe(true)
  })

  it('con Tótem y sin más golpes letales tras la activación, el personaje sobrevive en 1 HP', () => {
    const result = applyDamageSequence(baseCharacter, [{ amount: 8 }, { amount: 5 }], true)

    // evento1: 10 -> 2 (sigue vivo)
    // evento2: 2 -> -3, Tótem se activa -> 1 HP, se consume, no hay más eventos
    expect(result.finalState.currentHp).toBe(1)
    expect(result.totemConsumed).toBe(true)
    expect(result.isDead).toBe(false)
  })

  it('sin eventos letales, el Tótem no se activa', () => {
    const result = applyDamageSequence(baseCharacter, [{ amount: 3 }], true)

    expect(result.finalState.currentHp).toBe(7)
    expect(result.totemConsumed).toBe(false)
    expect(result.isDead).toBe(false)
  })

  it('los eventos posteriores a una muerte real (sin Tótem) no se siguen aplicando', () => {
    const result = applyDamageSequence(baseCharacter, [{ amount: 10 }, { amount: 999 }], false)

    expect(result.finalState.currentHp).toBe(0)
    expect(result.finalState.level).toBe(baseCharacter.level)
    expect(result.isDead).toBe(true)
  })
})

describe('isDead', () => {
  it('true cuando la vida es 0', () => {
    expect(isDead({ level: 1, currentXp: 0, currentHp: 0 })).toBe(true)
  })

  it('true cuando la vida es negativa', () => {
    expect(isDead({ level: 1, currentXp: 0, currentHp: -5 })).toBe(true)
  })

  it('false cuando la vida es mayor que 0', () => {
    expect(isDead({ level: 1, currentXp: 0, currentHp: 1 })).toBe(false)
  })
})
