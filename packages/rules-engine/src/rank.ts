import { RANK_REWARDS, RANKS, type RankDefinition } from './constants.js'

function rankIndexForLevel(level: number): number {
  return RANKS.findIndex((rank) => level >= rank.minLevel && level <= rank.maxLevel)
}

export function rankForLevel(level: number): RankDefinition {
  const index = rankIndexForLevel(level)
  const rank = RANKS[index]
  if (!rank) {
    throw new RangeError(`No hay rango definido para el nivel ${level}`)
  }
  return rank
}

/**
 * Devuelve, en orden, las recompensas de todos los rangos cruzados al pasar
 * de oldLevel a newLevel (puede ser más de uno si el salto es grande).
 */
export function rankRewardIfCrossed(oldLevel: number, newLevel: number): string[] {
  const oldIndex = rankIndexForLevel(oldLevel)
  const newIndex = rankIndexForLevel(newLevel)

  const rewards: string[] = []
  for (let index = oldIndex + 1; index <= newIndex; index++) {
    const rank = RANKS[index]
    const reward = rank ? RANK_REWARDS[rank.name] : null
    if (reward) rewards.push(reward)
  }
  return rewards
}
