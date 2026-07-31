import { describe, expect, it } from 'vitest'
import { evaluateStateBasedAchievements } from '../src/achievements.js'
import type { StateBasedAchievementExtras } from '../src/achievements.js'
import type { AchievementCounters, Attribute, AttributeLevelState, CharacterState, InventoryQuantities, ItemId } from '../src/types.js'

const ALL_ATTRIBUTES: Attribute[] = ['vitality', 'intellect', 'discipline', 'relations', 'adventure', 'fortune']

const ALL_ITEM_IDS: ItemId[] = [
  'potion',
  'super_potion',
  'hyper_potion',
  'small_shield',
  'large_shield',
  'escape_rope',
  'celestial_hand',
  'immortality_totem',
]

const ZERO_COUNTERS: AchievementCounters = {
  missionsCompletedCount: 0,
  bossesWonCount: 0,
  potionsUsedCount: 0,
  marketPurchasesCount: 0,
  coinsEarnedTotal: 0,
}

function extrasWithCounters(overrides: Partial<AchievementCounters>): StateBasedAchievementExtras {
  return { counters: { ...ZERO_COUNTERS, ...overrides }, coinsHeld: 0, inventoryQuantities: {} }
}

function extrasWithCoinsHeld(coinsHeld: number): StateBasedAchievementExtras {
  return { counters: ZERO_COUNTERS, coinsHeld, inventoryQuantities: {} }
}

function extrasWithInventory(inventoryQuantities: InventoryQuantities): StateBasedAchievementExtras {
  return { counters: ZERO_COUNTERS, coinsHeld: 0, inventoryQuantities }
}

function characterAtLevel(level: number): CharacterState {
  return { level, currentXp: 0, currentHp: 100 }
}

/** Los 6 atributos a nivel 1, salvo el que se indique explícitamente. */
function attributeLevelsWith(overrides: Partial<Record<Attribute, number>> = {}): AttributeLevelState[] {
  return ALL_ATTRIBUTES.map((attribute) => ({ attribute, level: overrides[attribute] ?? 1 }))
}

const BASELINE_ATTRIBUTES = attributeLevelsWith()

describe('evaluateStateBasedAchievements — nivel y rangos (8)', () => {
  it.each([
    ['level_5', 5, 4],
    ['rank_adventurer', 10, 9],
    ['rank_warrior', 20, 19],
    ['rank_elite', 35, 34],
    ['rank_master', 50, 49],
    ['rank_legend', 70, 69],
    ['rank_hero', 90, 89],
    ['level_100', 100, 99],
  ])('%s: se desbloquea en el nivel %i y no en el nivel %i', (achievementId, atLevel, belowLevel) => {
    expect(evaluateStateBasedAchievements(characterAtLevel(atLevel), BASELINE_ATTRIBUTES)).toContain(achievementId)
    expect(evaluateStateBasedAchievements(characterAtLevel(belowLevel), BASELINE_ATTRIBUTES)).not.toContain(
      achievementId,
    )
  })

  it('alcanzar un rango alto desbloquea también los logros de los rangos inferiores ya cruzados', () => {
    const unlocked = evaluateStateBasedAchievements(characterAtLevel(50), BASELINE_ATTRIBUTES)
    expect(unlocked).toEqual(
      expect.arrayContaining(['level_5', 'rank_adventurer', 'rank_warrior', 'rank_elite', 'rank_master']),
    )
    expect(unlocked).not.toContain('rank_legend')
    expect(unlocked).not.toContain('rank_hero')
    expect(unlocked).not.toContain('level_100')
  })

  it('nivel 1 (Novato) no desbloquea ningún logro de nivel y rangos', () => {
    const unlocked = evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES)
    expect(unlocked.filter((id) => id === 'level_5' || id.startsWith('rank_') || id === 'level_100')).toEqual([])
  })
})

describe('evaluateStateBasedAchievements — atributos (18 hitos individuales)', () => {
  const cases: [Attribute, string, string, string][] = [
    ['vitality', 'attribute_vitality_10', 'attribute_vitality_25', 'attribute_vitality_50'],
    ['intellect', 'attribute_intellect_10', 'attribute_intellect_25', 'attribute_intellect_50'],
    ['discipline', 'attribute_discipline_10', 'attribute_discipline_25', 'attribute_discipline_50'],
    ['relations', 'attribute_relations_10', 'attribute_relations_25', 'attribute_relations_50'],
    ['adventure', 'attribute_adventure_10', 'attribute_adventure_25', 'attribute_adventure_50'],
    ['fortune', 'attribute_fortune_10', 'attribute_fortune_25', 'attribute_fortune_50'],
  ]

  for (const [attribute, id10, id25, id50] of cases) {
    describe(attribute, () => {
      it.each([
        [id10, 10, 9],
        [id25, 25, 24],
        [id50, 50, 49],
      ])('%s: se desbloquea en nivel %i y no en nivel %i', (achievementId, atLevel, belowLevel) => {
        const atMilestone = attributeLevelsWith({ [attribute]: atLevel })
        const belowMilestone = attributeLevelsWith({ [attribute]: belowLevel })

        expect(evaluateStateBasedAchievements(characterAtLevel(1), atMilestone)).toContain(achievementId)
        expect(evaluateStateBasedAchievements(characterAtLevel(1), belowMilestone)).not.toContain(achievementId)
      })
    })
  }

  it('alcanzar el hito 50 de un atributo también desbloquea sus hitos 10 y 25', () => {
    const unlocked = evaluateStateBasedAchievements(characterAtLevel(1), attributeLevelsWith({ vitality: 50 }))
    expect(unlocked).toEqual(
      expect.arrayContaining(['attribute_vitality_10', 'attribute_vitality_25', 'attribute_vitality_50']),
    )
  })
})

describe('evaluateStateBasedAchievements — Maestro de todos los caminos (all_attributes_50)', () => {
  it('se desbloquea cuando los seis atributos están en nivel 50', () => {
    const allAt50 = attributeLevelsWith({
      vitality: 50,
      intellect: 50,
      discipline: 50,
      relations: 50,
      adventure: 50,
      fortune: 50,
    })
    expect(evaluateStateBasedAchievements(characterAtLevel(1), allAt50)).toContain('all_attributes_50')
  })

  it('no se desbloquea con cinco atributos en 50 y uno en 49', () => {
    const fiveAt50OneAt49 = attributeLevelsWith({
      vitality: 50,
      intellect: 50,
      discipline: 50,
      relations: 50,
      adventure: 50,
      fortune: 49,
    })
    expect(evaluateStateBasedAchievements(characterAtLevel(1), fiveAt50OneAt49)).not.toContain('all_attributes_50')
  })
})

describe('evaluateStateBasedAchievements — contadores acumulados (Tanda 2, 17 logros)', () => {
  it.each([
    ['mission_first', 'missionsCompletedCount', 1, 0],
    ['mission_10', 'missionsCompletedCount', 10, 9],
    ['mission_50', 'missionsCompletedCount', 50, 49],
    ['mission_100', 'missionsCompletedCount', 100, 99],
    ['mission_250', 'missionsCompletedCount', 250, 249],
    ['mission_500', 'missionsCompletedCount', 500, 499],
    ['mission_1000', 'missionsCompletedCount', 1000, 999],
    ['boss_first_win', 'bossesWonCount', 1, 0],
    ['boss_5_wins', 'bossesWonCount', 5, 4],
    ['boss_10_wins', 'bossesWonCount', 10, 9],
    ['boss_25_wins', 'bossesWonCount', 25, 24],
    ['boss_50_wins', 'bossesWonCount', 50, 49],
    ['potions_used_10', 'potionsUsedCount', 10, 9],
    ['first_purchase', 'marketPurchasesCount', 1, 0],
    ['market_25_purchases', 'marketPurchasesCount', 25, 24],
    ['coins_earned_50_total', 'coinsEarnedTotal', 50, 49],
    ['coins_earned_500_total', 'coinsEarnedTotal', 500, 499],
  ] as [string, keyof AchievementCounters, number, number][])(
    '%s: se desbloquea justo en el umbral %i y no justo por debajo (%i)',
    (achievementId, counterKey, atThreshold, belowThreshold) => {
      const atExtras = extrasWithCounters({ [counterKey]: atThreshold })
      const belowExtras = extrasWithCounters({ [counterKey]: belowThreshold })

      expect(evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, atExtras)).toContain(
        achievementId,
      )
      expect(evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, belowExtras)).not.toContain(
        achievementId,
      )
    },
  )

  it('sin extras (undefined), ningún logro de contador se desbloquea', () => {
    const unlocked = evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES)
    expect(unlocked).toEqual([])
  })
})

describe('evaluateStateBasedAchievements — estado actual de monedas y mochila (Tanda 2, 4 logros)', () => {
  it.each([
    ['coins_held_100', 100, 99],
    ['coins_held_250', 250, 249],
  ] as [string, number, number][])('%s: se desbloquea con saldo %i y no con %i', (achievementId, at, below) => {
    expect(
      evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, extrasWithCoinsHeld(at)),
    ).toContain(achievementId)
    expect(
      evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, extrasWithCoinsHeld(below)),
    ).not.toContain(achievementId)
  })

  it('backpack_5_items se desbloquea con 5 unidades sumadas entre varios objetos y no con 4', () => {
    const at = extrasWithInventory({ potion: 3, small_shield: 2 })
    const below = extrasWithInventory({ potion: 2, small_shield: 2 })

    expect(evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, at)).toContain(
      'backpack_5_items',
    )
    expect(evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, below)).not.toContain(
      'backpack_5_items',
    )
  })

  it('item_collector_all_types se desbloquea con al menos 1 unidad de los 8 tipos y no con 7/8', () => {
    const sevenOfEight: InventoryQuantities = {}
    for (const itemId of ALL_ITEM_IDS.slice(0, 7)) sevenOfEight[itemId] = 1
    const allEight: InventoryQuantities = {}
    for (const itemId of ALL_ITEM_IDS) allEight[itemId] = 1

    expect(
      evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, extrasWithInventory(allEight)),
    ).toContain('item_collector_all_types')
    expect(
      evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, extrasWithInventory(sevenOfEight)),
    ).not.toContain('item_collector_all_types')
  })
})

describe('evaluateStateBasedAchievements — Constancia (Tanda 3, 7 logros)', () => {
  it.each([
    ['streak_3', 3, 2],
    ['streak_7', 7, 6],
    ['streak_14', 14, 13],
    ['streak_30', 30, 29],
    ['streak_60', 60, 59],
    ['streak_100', 100, 99],
    ['streak_365', 365, 364],
  ] as [string, number, number][])('%s: se desbloquea justo en la racha de %i días y no en %i', (achievementId, at, below) => {
    const atExtras: StateBasedAchievementExtras = { counters: ZERO_COUNTERS, coinsHeld: 0, inventoryQuantities: {}, completionStreakDays: at }
    const belowExtras: StateBasedAchievementExtras = { counters: ZERO_COUNTERS, coinsHeld: 0, inventoryQuantities: {}, completionStreakDays: below }

    expect(evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, atExtras)).toContain(achievementId)
    expect(evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, belowExtras)).not.toContain(
      achievementId,
    )
  })

  it('sin completionStreakDays en extras, ningún streak_* se desbloquea', () => {
    const extras: StateBasedAchievementExtras = { counters: ZERO_COUNTERS, coinsHeld: 0, inventoryQuantities: {} }
    const unlocked = evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, extras)
    expect(unlocked.filter((id) => id.startsWith('streak_'))).toEqual([])
  })
})

describe('evaluateStateBasedAchievements — Superviviente (level_50_no_death)', () => {
  it('se desbloquea en el nivel 50 (morir ya crea una adventure_run nueva, así que "sin morir" es automático)', () => {
    expect(evaluateStateBasedAchievements(characterAtLevel(50), BASELINE_ATTRIBUTES)).toContain('level_50_no_death')
    expect(evaluateStateBasedAchievements(characterAtLevel(49), BASELINE_ATTRIBUTES)).not.toContain(
      'level_50_no_death',
    )
  })
})

describe('evaluateStateBasedAchievements — Supervivencia derivada de min_hp_reached_this_run (Tanda 3)', () => {
  function extrasWithMinHp(minHpReachedThisRun: number): StateBasedAchievementExtras {
    return { counters: ZERO_COUNTERS, coinsHeld: 0, inventoryQuantities: {}, minHpReachedThisRun }
  }

  it('hp_below_25_first: se desbloquea con mínimo 24 y no con 25', () => {
    expect(evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, extrasWithMinHp(24))).toContain(
      'hp_below_25_first',
    )
    expect(
      evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, extrasWithMinHp(25)),
    ).not.toContain('hp_below_25_first')
  })

  it('survive_1_hp: se desbloquea solo con mínimo exactamente 1 (no con 2, no con 0)', () => {
    expect(evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, extrasWithMinHp(1))).toContain(
      'survive_1_hp',
    )
    expect(evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, extrasWithMinHp(2))).not.toContain(
      'survive_1_hp',
    )
  })

  it('sin minHpReachedThisRun en extras (equivale a 100, nunca ha bajado), no se desbloquea ninguno de los dos', () => {
    const extras: StateBasedAchievementExtras = { counters: ZERO_COUNTERS, coinsHeld: 0, inventoryQuantities: {} }
    const unlocked = evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, extras)
    expect(unlocked).not.toContain('hp_below_25_first')
    expect(unlocked).not.toContain('survive_1_hp')
  })
})

describe('evaluateStateBasedAchievements — Intocable (no_damage_30_days)', () => {
  it('se desbloquea con 30 días sin daño y no con 29', () => {
    const at: StateBasedAchievementExtras = { counters: ZERO_COUNTERS, coinsHeld: 0, inventoryQuantities: {}, daysSinceLastDamage: 30 }
    const below: StateBasedAchievementExtras = { counters: ZERO_COUNTERS, coinsHeld: 0, inventoryQuantities: {}, daysSinceLastDamage: 29 }

    expect(evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, at)).toContain('no_damage_30_days')
    expect(evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, below)).not.toContain(
      'no_damage_30_days',
    )
  })
})

describe('evaluateStateBasedAchievements — Camino impecable y Regreso triunfal (flawlessStreak)', () => {
  it('flawless_25_missions: se desbloquea con racha 25 y no con 24', () => {
    const at: StateBasedAchievementExtras = { counters: ZERO_COUNTERS, coinsHeld: 0, inventoryQuantities: {}, flawlessStreak: 25 }
    const below: StateBasedAchievementExtras = { counters: ZERO_COUNTERS, coinsHeld: 0, inventoryQuantities: {}, flawlessStreak: 24 }

    expect(evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, at)).toContain(
      'flawless_25_missions',
    )
    expect(evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, below)).not.toContain(
      'flawless_25_missions',
    )
  })

  it('recovery_10_missions_after_below_25: necesita racha >= 10 Y haber bajado de 25 HP alguna vez, ninguna de las dos condiciones basta sola', () => {
    const both: StateBasedAchievementExtras = {
      counters: ZERO_COUNTERS,
      coinsHeld: 0,
      inventoryQuantities: {},
      flawlessStreak: 10,
      minHpReachedThisRun: 24,
    }
    const onlyStreak: StateBasedAchievementExtras = {
      counters: ZERO_COUNTERS,
      coinsHeld: 0,
      inventoryQuantities: {},
      flawlessStreak: 10,
      minHpReachedThisRun: 100,
    }
    const onlyHp: StateBasedAchievementExtras = {
      counters: ZERO_COUNTERS,
      coinsHeld: 0,
      inventoryQuantities: {},
      flawlessStreak: 9,
      minHpReachedThisRun: 24,
    }

    expect(evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, both)).toContain(
      'recovery_10_missions_after_below_25',
    )
    expect(evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, onlyStreak)).not.toContain(
      'recovery_10_missions_after_below_25',
    )
    expect(evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, onlyHp)).not.toContain(
      'recovery_10_missions_after_below_25',
    )
  })
})

describe('evaluateStateBasedAchievements — Nunca te rindas (hp_recovery_10_to_50)', () => {
  it('necesita haber bajado de 10 HP alguna vez Y estar por encima de 50 HP ahora mismo', () => {
    function character(currentHp: number) {
      return { level: 1, currentXp: 0, currentHp }
    }

    const both: StateBasedAchievementExtras = { counters: ZERO_COUNTERS, coinsHeld: 0, inventoryQuantities: {}, minHpReachedThisRun: 9 }
    expect(evaluateStateBasedAchievements(character(51), BASELINE_ATTRIBUTES, both)).toContain('hp_recovery_10_to_50')
    expect(evaluateStateBasedAchievements(character(50), BASELINE_ATTRIBUTES, both)).not.toContain(
      'hp_recovery_10_to_50',
    )

    const neverBelow10: StateBasedAchievementExtras = { counters: ZERO_COUNTERS, coinsHeld: 0, inventoryQuantities: {}, minHpReachedThisRun: 10 }
    expect(evaluateStateBasedAchievements(character(51), BASELINE_ATTRIBUTES, neverBelow10)).not.toContain(
      'hp_recovery_10_to_50',
    )
  })
})

describe('evaluateStateBasedAchievements — Maestro versátil (versatile_master_6_attributes_7_days)', () => {
  function extrasWithAttributeDates(dates: Partial<Record<Attribute, string>>): StateBasedAchievementExtras {
    return { counters: ZERO_COUNTERS, coinsHeld: 0, inventoryQuantities: {}, attributeLastCompletedDates: dates }
  }

  it('se desbloquea cuando los 6 atributos tienen fecha y el rango entre la más antigua y la más reciente es de 6 días o menos', () => {
    const extras = extrasWithAttributeDates({
      vitality: '2026-01-01',
      intellect: '2026-01-02',
      discipline: '2026-01-03',
      relations: '2026-01-04',
      adventure: '2026-01-05',
      fortune: '2026-01-07',
    })
    expect(evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, extras)).toContain(
      'versatile_master_6_attributes_7_days',
    )
  })

  it('no se desbloquea cuando el rango entre fechas es de 7 días (uno más de lo permitido)', () => {
    const extras = extrasWithAttributeDates({
      vitality: '2026-01-01',
      intellect: '2026-01-02',
      discipline: '2026-01-03',
      relations: '2026-01-04',
      adventure: '2026-01-05',
      fortune: '2026-01-08',
    })
    expect(evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, extras)).not.toContain(
      'versatile_master_6_attributes_7_days',
    )
  })

  it('no se desbloquea si falta la fecha de un atributo (5 de 6)', () => {
    const extras = extrasWithAttributeDates({
      vitality: '2026-01-01',
      intellect: '2026-01-02',
      discipline: '2026-01-03',
      relations: '2026-01-04',
      adventure: '2026-01-05',
    })
    expect(evaluateStateBasedAchievements(characterAtLevel(1), BASELINE_ATTRIBUTES, extras)).not.toContain(
      'versatile_master_6_attributes_7_days',
    )
  })
})
