import {
  ATTRIBUTE_XP_BASE,
  ATTRIBUTE_XP_PER_LEVEL,
  GENERAL_XP_BASE,
  GENERAL_XP_PER_LEVEL,
  MAX_ATTRIBUTE_LEVEL,
  MAX_CHARACTER_LEVEL,
  SECONDARY_ATTRIBUTE_XP_SHARE,
  XP_BY_DIFFICULTY,
} from './constants.js'
import type {
  LevelUpSequence,
  MissionCompletionResult,
  MissionOutcomeInput,
  XpApplicationResult,
} from './types.js'

export function xpRequiredForLevel(level: number): number {
  return GENERAL_XP_BASE + GENERAL_XP_PER_LEVEL * level
}

export function attributeXpRequiredForLevel(level: number): number {
  return ATTRIBUTE_XP_BASE + ATTRIBUTE_XP_PER_LEVEL * level
}

function applyXp(
  current: { level: number; currentXp: number },
  xpGained: number,
  maxLevel: number,
  xpRequiredForLevelFn: (level: number) => number,
): XpApplicationResult {
  if (current.level >= maxLevel) {
    return { level: current.level, currentXp: current.currentXp, levelsGained: 0, xpOverflowLost: xpGained }
  }

  let level = current.level
  let currentXp = current.currentXp + xpGained
  let levelsGained = 0

  while (level < maxLevel) {
    const required = xpRequiredForLevelFn(level)
    if (currentXp < required) break
    currentXp -= required
    level += 1
    levelsGained += 1
  }

  let xpOverflowLost = 0
  if (level >= maxLevel) {
    xpOverflowLost = currentXp
    currentXp = 0
  }

  return { level, currentXp, levelsGained, xpOverflowLost }
}

export function applyGeneralXp(
  current: { level: number; currentXp: number },
  xpGained: number,
): XpApplicationResult {
  return applyXp(current, xpGained, MAX_CHARACTER_LEVEL, xpRequiredForLevel)
}

/**
 * Reproduce, paso a paso, los mismos "dings" de nivel que ya calculó
 * applyGeneralXp (misma xpRequiredForLevel/MAX_CHARACTER_LEVEL), para que la
 * UI pueda animar cada subida en secuencia en vez de saltar directo al
 * resultado final. No recalcula ni cambia la regla de negocio: finalLevel/
 * finalXp siempre coinciden con el level/currentXp que devuelve
 * applyGeneralXp para el mismo input.
 */
export function simulateGeneralLevelUpSequence(
  current: { level: number; currentXp: number },
  xpGained: number,
): LevelUpSequence {
  const steps: LevelUpSequence['steps'] = []
  let level = current.level
  let displayXp = current.currentXp
  let pool = xpGained

  while (level < MAX_CHARACTER_LEVEL) {
    const required = xpRequiredForLevel(level)
    const spaceLeft = required - displayXp
    if (pool < spaceLeft) break
    steps.push({ level, xpRequired: required, startXp: displayXp })
    pool -= spaceLeft
    level += 1
    displayXp = 0
  }

  const finalXp = level >= MAX_CHARACTER_LEVEL ? 0 : displayXp + pool
  return { steps, finalLevel: level, finalXp }
}

export function applyAttributeXp(
  current: { level: number; currentXp: number },
  xpGained: number,
): XpApplicationResult {
  return applyXp(current, xpGained, MAX_ATTRIBUTE_LEVEL, attributeXpRequiredForLevel)
}

export function xpForMissionCompletion(input: MissionOutcomeInput): MissionCompletionResult {
  const xpGained = XP_BY_DIFFICULTY[input.difficulty]

  const general = applyGeneralXp(input.generalState, xpGained)
  const primaryAttributeResult = applyAttributeXp(input.primaryAttributeState, xpGained)
  // El documento funcional original describe el 25% como una fracción exacta
  // (ejemplo: 30 XP -> 7.5 XP de atributo secundario), pero el usuario ha
  // confirmado un cambio de diseño deliberado: se redondea hacia abajo al
  // entero más cercano (7.5 -> 7). No es un bug ni una corrección de
  // precisión — attribute_progress.current_xp se queda intencionadamente
  // como `int` porque con esta regla ya nunca recibe un valor fraccionario.
  const secondaryAttributeResult = input.secondaryAttributeState
    ? applyAttributeXp(input.secondaryAttributeState, Math.floor(xpGained * SECONDARY_ATTRIBUTE_XP_SHARE))
    : null

  return {
    xpGained,
    general,
    primaryAttribute: input.primaryAttribute,
    primaryAttributeResult,
    secondaryAttribute: input.secondaryAttribute,
    secondaryAttributeResult,
  }
}
