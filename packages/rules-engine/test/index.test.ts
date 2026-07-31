import { describe, expect, it } from 'vitest'
import {
  applyDamageSequence,
  applyGeneralXp,
  coinsForLevelUp,
  damageForMissionFailure,
  MAX_CHARACTER_LEVEL,
  rankForLevel,
} from '../src/index.js'

describe('rules-engine barrel export', () => {
  it('re-exporta las funciones y constantes públicas del paquete', () => {
    expect(MAX_CHARACTER_LEVEL).toBe(100)
    expect(typeof applyGeneralXp).toBe('function')
    expect(typeof damageForMissionFailure).toBe('function')
    expect(typeof coinsForLevelUp).toBe('function')
    expect(typeof rankForLevel).toBe('function')
    expect(typeof applyDamageSequence).toBe('function')
  })
})
