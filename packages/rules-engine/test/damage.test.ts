import { describe, expect, it } from 'vitest'
import { damageForBossDefeat, damageForMissionFailure } from '../src/damage.js'
import type { Difficulty } from '../src/types.js'

describe('damageForMissionFailure sin escudo', () => {
  it.each([
    ['trivial', 1],
    ['easy', 3],
    ['medium', 5],
    ['hard', 10],
    ['epic', 15],
    ['boss_minor', 20],
    ['boss_major', 20],
    ['boss_legendary', 20],
  ] satisfies [Difficulty, number][])('%s -> %i HP', (difficulty, expected) => {
    const result = damageForMissionFailure(difficulty, null)
    expect(result).toEqual({ damage: expected, shieldConsumed: false, shieldOverflowLost: 0 })
  })
})

describe('damageForMissionFailure con escudo', () => {
  it('escudo pequeño contra daño medio (documento: 5 -> 2 final)', () => {
    const result = damageForMissionFailure('medium', 'small')
    expect(result).toEqual({ damage: 2, shieldConsumed: true, shieldOverflowLost: 0 })
  })

  it('escudo grande contra daño fácil (documento: 3 -> 0 final, 7 de sobrante perdido)', () => {
    const result = damageForMissionFailure('easy', 'large')
    expect(result).toEqual({ damage: 0, shieldConsumed: true, shieldOverflowLost: 7 })
  })

  it('el daño nunca es negativo aunque el escudo grande supere el daño base', () => {
    const result = damageForMissionFailure('trivial', 'large')
    expect(result.damage).toBe(0)
    expect(result.shieldOverflowLost).toBe(9)
  })

  it('los escudos no se aplican contra fallos de Boss: no se consumen y el daño es completo', () => {
    const result = damageForMissionFailure('boss_major', 'large')
    expect(result).toEqual({ damage: 20, shieldConsumed: false, shieldOverflowLost: 0 })
  })
})

describe('damageForBossDefeat', () => {
  it('sin Mano Celestial: 20 HP', () => {
    expect(damageForBossDefeat(false)).toBe(20)
  })

  it('con Mano Celestial activa: 10 HP', () => {
    expect(damageForBossDefeat(true)).toBe(10)
  })
})
