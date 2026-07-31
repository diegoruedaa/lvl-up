import { BOSS_VICTORY_COINS, LEVEL_UP_BASE_COINS, LEVEL_UP_MULTIPLE_OF_10_BONUS } from './constants.js'
import type { BossType } from './types.js'

export function coinsForLevelUp(level: number): number {
  const base = LEVEL_UP_BASE_COINS + Math.floor(level / 10)
  return level % 10 === 0 ? base + LEVEL_UP_MULTIPLE_OF_10_BONUS : base
}

export function coinsForBossVictory(bossType: BossType): number {
  return BOSS_VICTORY_COINS[bossType]
}

/** Suma coinsForLevelUp(level) por cada nivel recién alcanzado al subir de oldLevel a newLevel. */
export function coinsForLevelsGained(oldLevel: number, newLevel: number): number {
  let total = 0
  for (let level = oldLevel + 1; level <= newLevel; level++) {
    total += coinsForLevelUp(level)
  }
  return total
}
