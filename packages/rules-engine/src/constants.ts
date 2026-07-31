import type { AchievementDefinition, BossType, Difficulty, ItemDefinition, ItemId, ShieldType } from './types.js'

export const MAX_CHARACTER_LEVEL = 100
export const MAX_ATTRIBUTE_LEVEL = 50
export const MAX_HP = 100
export const STARTING_HP = 100

/** xpRequiredForLevel(level) = GENERAL_XP_BASE + GENERAL_XP_PER_LEVEL * level */
export const GENERAL_XP_BASE = 50
export const GENERAL_XP_PER_LEVEL = 10

/** attributeXpRequiredForLevel(level) = ATTRIBUTE_XP_BASE + ATTRIBUTE_XP_PER_LEVEL * level */
export const ATTRIBUTE_XP_BASE = 30
export const ATTRIBUTE_XP_PER_LEVEL = 8

/** El atributo secundario de una misión recibe este porcentaje de la XP de la misión. */
export const SECONDARY_ATTRIBUTE_XP_SHARE = 0.25

export const XP_BY_DIFFICULTY: Record<Difficulty, number> = {
  trivial: 5,
  easy: 15,
  medium: 30,
  hard: 60,
  epic: 125,
  boss_minor: 200,
  boss_major: 350,
  boss_legendary: 500,
}

export const DAMAGE_BY_DIFFICULTY: Record<Difficulty, number> = {
  trivial: 1,
  easy: 3,
  medium: 5,
  hard: 10,
  epic: 15,
  boss_minor: 20,
  boss_major: 20,
  boss_legendary: 20,
}

export const SHIELD_REDUCTION: Record<ShieldType, number> = {
  small: 3,
  large: 10,
}

export const BOSS_VICTORY_COINS: Record<BossType, number> = {
  boss_minor: 10,
  boss_major: 20,
  boss_legendary: 30,
}

export const BOSS_DEFEAT_DAMAGE = 20
export const BOSS_DEFEAT_DAMAGE_WITH_CELESTIAL_HAND = 10

/** coinsForLevelUp(level) = LEVEL_UP_BASE_COINS + floor(level / 10), +LEVEL_UP_MULTIPLE_OF_10_BONUS si level % 10 === 0 */
export const LEVEL_UP_BASE_COINS = 2
export const LEVEL_UP_MULTIPLE_OF_10_BONUS = 10

export interface RankDefinition {
  name: string
  minLevel: number
  maxLevel: number
}

export const RANKS: readonly RankDefinition[] = [
  { name: 'Novato', minLevel: 1, maxLevel: 9 },
  { name: 'Aventurero', minLevel: 10, maxLevel: 19 },
  { name: 'Guerrero', minLevel: 20, maxLevel: 34 },
  { name: 'Élite', minLevel: 35, maxLevel: 49 },
  { name: 'Maestro', minLevel: 50, maxLevel: 69 },
  { name: 'Leyenda', minLevel: 70, maxLevel: 89 },
  { name: 'Héroe', minLevel: 90, maxLevel: 99 },
  { name: 'Inmortal', minLevel: 100, maxLevel: 100 },
]

/** Objeto entregado al alcanzar cada rango por primera vez. `null` si el rango no concede objeto. */
export const RANK_REWARDS: Record<string, string | null> = {
  Novato: null,
  Aventurero: 'potion',
  Guerrero: 'super_potion',
  Élite: 'small_shield',
  Maestro: 'large_shield',
  Leyenda: 'celestial_hand',
  Héroe: 'immortality_totem',
  Inmortal: null,
}

/** HP recuperado por cada tipo de poción (documento, sección 8.2-8.5). */
export const POTION_HEAL_AMOUNT = {
  potion: 5,
  super_potion: 10,
  hyper_potion: 20,
} as const

/** Catálogo de los 8 objetos del mercado (documento, secciones 8.2 y 8.13). */
export const ITEM_CATALOG: Record<ItemId, ItemDefinition> = {
  potion: {
    id: 'potion',
    displayName: 'Poción',
    rarity: 'common',
    price: 30,
    effectType: 'heal',
    effectValue: POTION_HEAL_AMOUNT.potion,
    stackLimit: null,
  },
  super_potion: {
    id: 'super_potion',
    displayName: 'Superpoción',
    rarity: 'rare',
    price: 70,
    effectType: 'heal',
    effectValue: POTION_HEAL_AMOUNT.super_potion,
    stackLimit: null,
  },
  hyper_potion: {
    id: 'hyper_potion',
    displayName: 'Hiperpoción',
    rarity: 'epic',
    price: 130,
    effectType: 'heal',
    effectValue: POTION_HEAL_AMOUNT.hyper_potion,
    stackLimit: null,
  },
  small_shield: {
    id: 'small_shield',
    displayName: 'Miniescudo',
    rarity: 'common',
    price: 40,
    effectType: 'shield',
    effectValue: SHIELD_REDUCTION.small,
    stackLimit: null,
  },
  large_shield: {
    id: 'large_shield',
    displayName: 'Escudo',
    rarity: 'rare',
    price: 110,
    effectType: 'shield',
    effectValue: SHIELD_REDUCTION.large,
    stackLimit: null,
  },
  escape_rope: {
    id: 'escape_rope',
    displayName: 'Cuerda Huida',
    rarity: 'rare',
    price: 150,
    effectType: 'escape',
    effectValue: null,
    stackLimit: 5,
  },
  celestial_hand: {
    id: 'celestial_hand',
    displayName: 'Mano Celestial',
    rarity: 'epic',
    price: 180,
    effectType: 'boss_defense',
    effectValue: BOSS_DEFEAT_DAMAGE_WITH_CELESTIAL_HAND,
    stackLimit: 3,
  },
  immortality_totem: {
    id: 'immortality_totem',
    displayName: 'Tótem de la Inmortalidad',
    rarity: 'legendary',
    price: 400,
    effectType: 'revive',
    effectValue: 1,
    stackLimit: 1,
  },
}

/**
 * Catálogo completo de los 70 logros (documento, sección 14: 7 misiones + 7
 * constancia + 6 bosses + 8 nivel/rangos + 19 atributos + 6 supervivencia +
 * 8 objetos/mercado + 4 monedas + 5 fallos/recuperación = 70).
 *
 * 63 de los 70 se evalúan en evaluateStateBasedAchievements (achievements.ts,
 * incluidas las Tandas 1-3: nivel/rango/atributos, contadores y estado de
 * monedas/mochila, consistency, y los de survival/failure_recovery que solo
 * dependen de un valor de estado ya persistido). Los 7 restantes dependen del
 * orden relativo entre dos eventos (no solo de que una condición ya se
 * cumpla) y se desbloquean como unlocks directos en el instante exacto de la
 * acción que los dispara, en gameApi: boss_no_celestial_hand,
 * perfect_shield_defense, escape_rope_used, celestial_hand_used_first,
 * totem_activated, first_mission_failed, mission_after_damage.
 */
export const ACHIEVEMENT_CATALOG: readonly AchievementDefinition[] = [
  // 14.3. Logros de misiones — 7
  { id: 'mission_first', category: 'missions', name: 'Primer paso', requirementDescription: 'Completar la primera misión' },
  { id: 'mission_10', category: 'missions', name: 'Aprendiz de aventurero', requirementDescription: 'Completar 10 misiones' },
  { id: 'mission_50', category: 'missions', name: 'Cazador de misiones', requirementDescription: 'Completar 50 misiones' },
  { id: 'mission_100', category: 'missions', name: 'Veterano', requirementDescription: 'Completar 100 misiones' },
  { id: 'mission_250', category: 'missions', name: 'Héroe incansable', requirementDescription: 'Completar 250 misiones' },
  { id: 'mission_500', category: 'missions', name: 'Toda una vida de aventuras', requirementDescription: 'Completar 500 misiones' },
  { id: 'mission_1000', category: 'missions', name: 'Maestro de misiones', requirementDescription: 'Completar 1.000 misiones' },

  // 14.4. Logros de constancia — 7
  { id: 'streak_3', category: 'consistency', name: 'Primer paso firme', requirementDescription: 'Completar al menos una misión durante 3 días seguidos' },
  { id: 'streak_7', category: 'consistency', name: 'En marcha', requirementDescription: 'Completar al menos una misión durante 7 días seguidos' },
  { id: 'streak_14', category: 'consistency', name: 'Constante', requirementDescription: 'Completar al menos una misión durante 14 días seguidos' },
  { id: 'streak_30', category: 'consistency', name: 'Disciplinado', requirementDescription: 'Completar al menos una misión durante 30 días seguidos' },
  { id: 'streak_60', category: 'consistency', name: 'Imparable', requirementDescription: 'Completar al menos una misión durante 60 días seguidos' },
  { id: 'streak_100', category: 'consistency', name: 'Leyenda de la constancia', requirementDescription: 'Completar al menos una misión durante 100 días seguidos' },
  { id: 'streak_365', category: 'consistency', name: 'Un año de aventura', requirementDescription: 'Completar al menos una misión durante 365 días seguidos' },

  // 14.5. Logros de Bosses — 6
  { id: 'boss_first_win', category: 'bosses', name: 'Primer gran desafío', requirementDescription: 'Vencer el primer Boss' },
  { id: 'boss_5_wins', category: 'bosses', name: 'Cazador de gigantes', requirementDescription: 'Vencer 5 Bosses' },
  { id: 'boss_10_wins', category: 'bosses', name: 'Rompejefes', requirementDescription: 'Vencer 10 Bosses' },
  { id: 'boss_25_wins', category: 'bosses', name: 'Azote de los titanes', requirementDescription: 'Vencer 25 Bosses' },
  { id: 'boss_no_celestial_hand', category: 'bosses', name: 'Sin miedo', requirementDescription: 'Vencer un Boss sin tener activa Mano Celestial' },
  { id: 'boss_50_wins', category: 'bosses', name: 'Conquistador', requirementDescription: 'Vencer 50 Bosses' },

  // 14.6. Logros de nivel y rangos — 8
  { id: 'level_5', category: 'level_rank', name: 'La aventura comienza', requirementDescription: 'Alcanzar el nivel 5' },
  { id: 'rank_adventurer', category: 'level_rank', name: 'Aventurero', requirementDescription: 'Alcanzar el rango Aventurero' },
  { id: 'rank_warrior', category: 'level_rank', name: 'Guerrero', requirementDescription: 'Alcanzar el rango Guerrero' },
  { id: 'rank_elite', category: 'level_rank', name: 'Élite', requirementDescription: 'Alcanzar el rango Élite' },
  { id: 'rank_master', category: 'level_rank', name: 'Maestro', requirementDescription: 'Alcanzar el rango Maestro' },
  { id: 'rank_legend', category: 'level_rank', name: 'Leyenda', requirementDescription: 'Alcanzar el rango Leyenda' },
  { id: 'rank_hero', category: 'level_rank', name: 'Héroe', requirementDescription: 'Alcanzar el rango Héroe' },
  { id: 'level_100', category: 'level_rank', name: 'Inmortal', requirementDescription: 'Alcanzar el nivel 100' },

  // 14.7. Logros de atributos — 19
  { id: 'attribute_vitality_10', category: 'attributes', name: 'Cuerpo resistente', requirementDescription: 'Alcanzar Vitalidad 10' },
  { id: 'attribute_vitality_25', category: 'attributes', name: 'Corazón de hierro', requirementDescription: 'Alcanzar Vitalidad 25' },
  { id: 'attribute_vitality_50', category: 'attributes', name: 'Fortaleza absoluta', requirementDescription: 'Alcanzar Vitalidad 50' },
  { id: 'attribute_intellect_10', category: 'attributes', name: 'Mente despierta', requirementDescription: 'Alcanzar Intelecto 10' },
  { id: 'attribute_intellect_25', category: 'attributes', name: 'Mente brillante', requirementDescription: 'Alcanzar Intelecto 25' },
  { id: 'attribute_intellect_50', category: 'attributes', name: 'Sabio supremo', requirementDescription: 'Alcanzar Intelecto 50' },
  { id: 'attribute_discipline_10', category: 'attributes', name: 'Voluntad firme', requirementDescription: 'Alcanzar Disciplina 10' },
  { id: 'attribute_discipline_25', category: 'attributes', name: 'Voluntad inquebrantable', requirementDescription: 'Alcanzar Disciplina 25' },
  { id: 'attribute_discipline_50', category: 'attributes', name: 'Dominio de uno mismo', requirementDescription: 'Alcanzar Disciplina 50' },
  { id: 'attribute_relations_10', category: 'attributes', name: 'Buen compañero', requirementDescription: 'Alcanzar Relaciones 10' },
  { id: 'attribute_relations_25', category: 'attributes', name: 'Alma sociable', requirementDescription: 'Alcanzar Relaciones 25' },
  { id: 'attribute_relations_50', category: 'attributes', name: 'Corazón de la comunidad', requirementDescription: 'Alcanzar Relaciones 50' },
  { id: 'attribute_adventure_10', category: 'attributes', name: 'Primer explorador', requirementDescription: 'Alcanzar Aventura 10' },
  { id: 'attribute_adventure_25', category: 'attributes', name: 'Espíritu explorador', requirementDescription: 'Alcanzar Aventura 25' },
  { id: 'attribute_adventure_50', category: 'attributes', name: 'Leyenda errante', requirementDescription: 'Alcanzar Aventura 50' },
  { id: 'attribute_fortune_10', category: 'attributes', name: 'Golpe de suerte', requirementDescription: 'Alcanzar Fortuna 10' },
  { id: 'attribute_fortune_25', category: 'attributes', name: 'Favor de la fortuna', requirementDescription: 'Alcanzar Fortuna 25' },
  { id: 'attribute_fortune_50', category: 'attributes', name: 'Elegido del destino', requirementDescription: 'Alcanzar Fortuna 50' },
  { id: 'all_attributes_50', category: 'attributes', name: 'Maestro de todos los caminos', requirementDescription: 'Alcanzar nivel 50 en los seis atributos' },

  // 14.8. Logros de supervivencia — 6
  { id: 'hp_below_25_first', category: 'survival', name: 'Herido, pero en pie', requirementDescription: 'Bajar por primera vez de 25 HP' },
  { id: 'survive_1_hp', category: 'survival', name: 'Al límite', requirementDescription: 'Sobrevivir quedándose exactamente con 1 HP' },
  { id: 'totem_activated', category: 'survival', name: 'La muerte tendrá que esperar', requirementDescription: 'Activar un Tótem de la Inmortalidad' },
  { id: 'level_50_no_death', category: 'survival', name: 'Superviviente', requirementDescription: 'Alcanzar nivel 50 sin morir' },
  { id: 'no_damage_30_days', category: 'survival', name: 'Intocable', requirementDescription: 'Pasar 30 días consecutivos sin recibir daño' },
  { id: 'flawless_25_missions', category: 'survival', name: 'Camino impecable', requirementDescription: 'Completar 25 misiones consecutivas sin fallar ninguna' },

  // 14.9. Logros de objetos y mercado — 8
  { id: 'first_purchase', category: 'items_market', name: 'Primera compra', requirementDescription: 'Comprar el primer objeto' },
  { id: 'backpack_5_items', category: 'items_market', name: 'Preparado para el viaje', requirementDescription: 'Tener cinco objetos simultáneamente en la mochila' },
  { id: 'potions_used_10', category: 'items_market', name: 'Alquimista aficionado', requirementDescription: 'Usar 10 pociones de cualquier tipo' },
  { id: 'perfect_shield_defense', category: 'items_market', name: 'Defensa perfecta', requirementDescription: 'Evitar completamente el daño de una misión con un escudo' },
  { id: 'escape_rope_used', category: 'items_market', name: 'Huida estratégica', requirementDescription: 'Usar una Cuerda Huida' },
  { id: 'celestial_hand_used_first', category: 'items_market', name: 'La parada celestial', requirementDescription: 'Usar Mano Celestial por primera vez' },
  { id: 'item_collector_all_types', category: 'items_market', name: 'Coleccionista', requirementDescription: 'Tener al menos una unidad de cada tipo de objeto' },
  { id: 'market_25_purchases', category: 'items_market', name: 'Cliente habitual', requirementDescription: 'Realizar 25 compras en el mercado' },

  // 14.10. Logros de monedas — 4
  { id: 'coins_earned_50_total', category: 'coins', name: 'Primeras ganancias', requirementDescription: 'Obtener un total de 50 monedas en una aventura' },
  { id: 'coins_held_100', category: 'coins', name: 'Ahorrador', requirementDescription: 'Tener 100 monedas disponibles al mismo tiempo' },
  { id: 'coins_held_250', category: 'coins', name: 'Tesoro personal', requirementDescription: 'Tener 250 monedas disponibles al mismo tiempo' },
  { id: 'coins_earned_500_total', category: 'coins', name: 'Gran fortuna', requirementDescription: 'Obtener un total acumulado de 500 monedas en una aventura' },

  // 14.11. Logros de fallos, recuperación y variedad — 5
  { id: 'first_mission_failed', category: 'failure_recovery', name: 'Una lección aprendida', requirementDescription: 'Fallar la primera misión' },
  { id: 'mission_after_damage', category: 'failure_recovery', name: 'De vuelta al camino', requirementDescription: 'Completar una misión después de haber recibido daño' },
  { id: 'hp_recovery_10_to_50', category: 'failure_recovery', name: 'Nunca te rindas', requirementDescription: 'Pasar de menos de 10 HP a más de 50 HP' },
  { id: 'recovery_10_missions_after_below_25', category: 'failure_recovery', name: 'Regreso triunfal', requirementDescription: 'Completar 10 misiones consecutivas después de haber bajado de 25 HP' },
  { id: 'versatile_master_6_attributes_7_days', category: 'failure_recovery', name: 'Maestro versátil', requirementDescription: 'Completar al menos una misión principal de cada uno de los seis atributos durante un periodo de 7 días' },
]
