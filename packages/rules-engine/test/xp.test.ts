import { describe, expect, it } from 'vitest'
import { XP_BY_DIFFICULTY } from '../src/constants.js'
import type { Difficulty } from '../src/types.js'
import {
  applyAttributeXp,
  applyGeneralXp,
  attributeXpRequiredForLevel,
  simulateGeneralLevelUpSequence,
  xpForMissionCompletion,
  xpRequiredForLevel,
} from '../src/xp.js'

describe('XP_BY_DIFFICULTY', () => {
  it.each([
    ['trivial', 5],
    ['easy', 15],
    ['medium', 30],
    ['hard', 60],
    ['epic', 125],
    ['boss_minor', 200],
    ['boss_major', 350],
    ['boss_legendary', 500],
  ] satisfies [Difficulty, number][])('%s concede %i XP (tabla 2.3 del documento)', (difficulty, expected) => {
    expect(XP_BY_DIFFICULTY[difficulty]).toBe(expected)
  })
})

describe('xpRequiredForLevel', () => {
  it.each([
    [1, 60],
    [2, 70],
    [5, 100],
    [10, 150],
    [20, 250],
    [50, 550],
    [75, 800],
    [99, 1040],
  ])('nivel %i -> %i XP necesaria', (level, expected) => {
    expect(xpRequiredForLevel(level)).toBe(expected)
  })
})

describe('attributeXpRequiredForLevel', () => {
  it.each([
    [1, 38],
    [10, 110],
    [20, 190],
    [30, 270],
    [40, 350],
    [49, 422],
  ])('nivel %i -> %i XP necesaria', (level, expected) => {
    expect(attributeXpRequiredForLevel(level)).toBe(expected)
  })
})

describe('applyGeneralXp', () => {
  it('sube exactamente 1 nivel con la XP justa', () => {
    const result = applyGeneralXp({ level: 1, currentXp: 0 }, 60)
    expect(result).toEqual({ level: 2, currentXp: 0, levelsGained: 1, xpOverflowLost: 0 })
  })

  it('sube varios niveles de golpe con XP grande (ej. Boss legendario, 500 XP)', () => {
    const result = applyGeneralXp({ level: 1, currentXp: 0 }, 500)
    // 60+70+80+90+100 = 400 consumidos hasta nivel 6, quedan 100 XP < 110 (nivel 6->7)
    expect(result).toEqual({ level: 6, currentXp: 100, levelsGained: 5, xpOverflowLost: 0 })
  })

  it('en nivel 99 con XP suficiente llega a 100 y descarta el resto', () => {
    const result = applyGeneralXp({ level: 99, currentXp: 0 }, 2000)
    // requerido 99->100 = 1040; sobran 960 que se pierden al tocar el tope
    expect(result).toEqual({ level: 100, currentXp: 0, levelsGained: 1, xpOverflowLost: 960 })
  })

  it('ya en nivel 100, cualquier XP se pierde sin cambiar nada', () => {
    const result = applyGeneralXp({ level: 100, currentXp: 0 }, 500)
    expect(result).toEqual({ level: 100, currentXp: 0, levelsGained: 0, xpOverflowLost: 500 })
  })
})

describe('simulateGeneralLevelUpSequence', () => {
  it('coincide con applyGeneralXp: sube exactamente 1 nivel con la XP justa', () => {
    const result = simulateGeneralLevelUpSequence({ level: 1, currentXp: 0 }, 60)
    expect(result.finalLevel).toBe(2)
    expect(result.finalXp).toBe(0)
    expect(result.steps).toEqual([{ level: 1, xpRequired: 60, startXp: 0 }])
  })

  it('un solo ding con XP de sobra (no sube 2 niveles): el resto queda en la barra final', () => {
    const result = simulateGeneralLevelUpSequence({ level: 1, currentXp: 40 }, 30)
    // 40+30=70 >= 60 (nivel 1->2), quedan 10 < 70 (nivel 2->3)
    expect(result.finalLevel).toBe(2)
    expect(result.finalXp).toBe(10)
    expect(result.steps).toEqual([{ level: 1, xpRequired: 60, startXp: 40 }])
  })

  it('coincide con applyGeneralXp: sube varios niveles de golpe con XP grande (Boss legendario, 500 XP)', () => {
    const applied = applyGeneralXp({ level: 1, currentXp: 0 }, 500)
    const result = simulateGeneralLevelUpSequence({ level: 1, currentXp: 0 }, 500)
    expect(result.finalLevel).toBe(applied.level)
    expect(result.finalXp).toBe(applied.currentXp)
    expect(result.steps).toHaveLength(applied.levelsGained)
    expect(result.steps.map((s) => s.level)).toEqual([1, 2, 3, 4, 5])
    expect(result.steps.every((s) => s.startXp === 0)).toBe(true)
  })

  it('coincide con applyGeneralXp al tocar el tope de nivel (100) y descartar el sobrante', () => {
    const applied = applyGeneralXp({ level: 99, currentXp: 0 }, 2000)
    const result = simulateGeneralLevelUpSequence({ level: 99, currentXp: 0 }, 2000)
    expect(result.finalLevel).toBe(applied.level)
    expect(result.finalXp).toBe(applied.currentXp)
    expect(result.steps).toEqual([{ level: 99, xpRequired: 1040, startXp: 0 }])
  })

  it('sin XP suficiente para subir de nivel, no hay pasos y la barra final refleja la XP acumulada', () => {
    const result = simulateGeneralLevelUpSequence({ level: 3, currentXp: 10 }, 5)
    expect(result.steps).toEqual([])
    expect(result.finalLevel).toBe(3)
    expect(result.finalXp).toBe(15)
  })
})

describe('applyAttributeXp', () => {
  it('sube exactamente 1 nivel con la XP justa', () => {
    const result = applyAttributeXp({ level: 1, currentXp: 0 }, 38)
    expect(result).toEqual({ level: 2, currentXp: 0, levelsGained: 1, xpOverflowLost: 0 })
  })

  it('sube varios niveles de golpe con XP grande', () => {
    const result = applyAttributeXp({ level: 1, currentXp: 0 }, 500)
    // 38+46+54+62+70+78+86 = 434 consumidos hasta nivel 8, quedan 66 XP < 94 (nivel 8->9)
    expect(result).toEqual({ level: 8, currentXp: 66, levelsGained: 7, xpOverflowLost: 0 })
  })

  it('en nivel 49 con XP suficiente llega a 50 (tope) y descarta el resto', () => {
    const result = applyAttributeXp({ level: 49, currentXp: 0 }, 1000)
    // requerido 49->50 = 422; sobran 578 que se pierden al tocar el tope
    expect(result).toEqual({ level: 50, currentXp: 0, levelsGained: 1, xpOverflowLost: 578 })
  })

  it('ya en nivel 50, cualquier XP se pierde sin cambiar nada', () => {
    const result = applyAttributeXp({ level: 50, currentXp: 0 }, 200)
    expect(result).toEqual({ level: 50, currentXp: 0, levelsGained: 0, xpOverflowLost: 200 })
  })
})

describe('xpForMissionCompletion', () => {
  it('misión media, Vitalidad principal + Disciplina secundaria: el 25% de XP secundaria se redondea hacia abajo (30 * 0.25 = 7.5 -> 7, cambio de diseño confirmado, no la fracción exacta del documento original)', () => {
    const result = xpForMissionCompletion({
      difficulty: 'medium',
      primaryAttribute: 'vitality',
      secondaryAttribute: 'discipline',
      generalState: { level: 1, currentXp: 0 },
      primaryAttributeState: { level: 1, currentXp: 0 },
      secondaryAttributeState: { level: 1, currentXp: 0 },
    })

    expect(result.xpGained).toBe(30)
    expect(result.general.currentXp).toBe(30)
    expect(result.primaryAttributeResult.currentXp).toBe(30)
    expect(result.secondaryAttributeResult?.currentXp).toBe(7)
  })

  it('sin atributo secundario, secondaryAttributeResult es null', () => {
    const result = xpForMissionCompletion({
      difficulty: 'easy',
      primaryAttribute: 'intellect',
      secondaryAttribute: null,
      generalState: { level: 1, currentXp: 0 },
      primaryAttributeState: { level: 1, currentXp: 0 },
      secondaryAttributeState: null,
    })

    expect(result.xpGained).toBe(15)
    expect(result.primaryAttributeResult.currentXp).toBe(15)
    expect(result.secondaryAttributeResult).toBeNull()
  })

  it('con atributo secundario ya al máximo, su XP se pierde pero el resto se aplica igual', () => {
    const result = xpForMissionCompletion({
      difficulty: 'medium',
      primaryAttribute: 'vitality',
      secondaryAttribute: 'discipline',
      generalState: { level: 1, currentXp: 0 },
      primaryAttributeState: { level: 1, currentXp: 0 },
      secondaryAttributeState: { level: 50, currentXp: 0 },
    })

    expect(result.general.currentXp).toBe(30)
    expect(result.primaryAttributeResult.currentXp).toBe(30)
    expect(result.secondaryAttributeResult).toEqual({
      level: 50,
      currentXp: 0,
      levelsGained: 0,
      xpOverflowLost: 7,
    })
  })

  it('con atributo principal ya al máximo, su XP se pierde pero el general se aplica igual', () => {
    const result = xpForMissionCompletion({
      difficulty: 'medium',
      primaryAttribute: 'vitality',
      secondaryAttribute: null,
      generalState: { level: 1, currentXp: 0 },
      primaryAttributeState: { level: 50, currentXp: 0 },
      secondaryAttributeState: null,
    })

    expect(result.general.currentXp).toBe(30)
    expect(result.primaryAttributeResult).toEqual({
      level: 50,
      currentXp: 0,
      levelsGained: 0,
      xpOverflowLost: 30,
    })
  })
})
