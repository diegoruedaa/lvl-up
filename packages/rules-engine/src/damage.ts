import {
  BOSS_DEFEAT_DAMAGE,
  BOSS_DEFEAT_DAMAGE_WITH_CELESTIAL_HAND,
  DAMAGE_BY_DIFFICULTY,
  SHIELD_REDUCTION,
} from './constants.js'
import type { Difficulty, MissionFailureResult, ShieldType } from './types.js'

function isBossDifficulty(difficulty: Difficulty): boolean {
  return difficulty === 'boss_minor' || difficulty === 'boss_major' || difficulty === 'boss_legendary'
}

/** Escudos NO se aplican contra fallos de Boss: no se consumen y no reducen el daño. */
export function damageForMissionFailure(
  difficulty: Difficulty,
  activeShield: ShieldType | null,
): MissionFailureResult {
  const baseDamage = DAMAGE_BY_DIFFICULTY[difficulty]

  if (activeShield === null || isBossDifficulty(difficulty)) {
    return { damage: baseDamage, shieldConsumed: false, shieldOverflowLost: 0 }
  }

  const reduction = SHIELD_REDUCTION[activeShield]
  const damage = Math.max(0, baseDamage - reduction)
  const shieldOverflowLost = Math.max(0, reduction - baseDamage)

  return { damage, shieldConsumed: true, shieldOverflowLost }
}

export function damageForBossDefeat(hasCelestialHand: boolean): number {
  return hasCelestialHand ? BOSS_DEFEAT_DAMAGE_WITH_CELESTIAL_HAND : BOSS_DEFEAT_DAMAGE
}
