import { describe, expect, it } from 'vitest'
import { coinsForBossVictory, coinsForLevelsGained, coinsForLevelUp } from '../src/coins.js'

function accumulatedCoins(fromLevel: number, toLevel: number): number {
  let total = 0
  for (let level = fromLevel; level <= toLevel; level++) {
    total += coinsForLevelUp(level)
  }
  return total
}

describe('coinsForLevelUp', () => {
  it('concede 2 monedas base en niveles que no son múltiplo de 10 dentro de la primera decena', () => {
    expect(coinsForLevelUp(2)).toBe(2)
    expect(coinsForLevelUp(9)).toBe(2)
  })

  it('concede una bonificación de 10 monedas extra en múltiplos de 10', () => {
    // 2 base + 1 (floor(10/10)) + 10 bonus = 13
    expect(coinsForLevelUp(10)).toBe(13)
  })

  it.each([
    [10, 29],
    [20, 70],
    [30, 121],
    [40, 182],
    [50, 253],
    [60, 334],
    [70, 425],
    [80, 526],
    [90, 637],
    [100, 758],
  ])('acumulado del nivel 2 al %i = %i monedas (tabla 5.3 del documento)', (toLevel, expected) => {
    expect(accumulatedCoins(2, toLevel)).toBe(expected)
  })
})

describe('coinsForBossVictory', () => {
  it.each([
    ['boss_minor', 10],
    ['boss_major', 20],
    ['boss_legendary', 30],
  ] as const)('%s -> %i monedas', (bossType, expected) => {
    expect(coinsForBossVictory(bossType)).toBe(expected)
  })
})

describe('coinsForLevelsGained', () => {
  it('devuelve 0 cuando no se ha subido de nivel', () => {
    expect(coinsForLevelsGained(5, 5)).toBe(0)
  })

  it('un único nivel ganado equivale a coinsForLevelUp del nivel alcanzado', () => {
    expect(coinsForLevelsGained(9, 10)).toBe(coinsForLevelUp(10))
  })

  it('varios niveles ganados de una vez sirven coinsForLevelUp de cada uno (documento 5.3)', () => {
    // Mismo resultado que accumulatedCoins(2, 10) de la tabla de arriba: 29.
    expect(coinsForLevelsGained(1, 10)).toBe(29)
  })
})
