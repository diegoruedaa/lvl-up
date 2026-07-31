/** Dificultades de misión, incluidas las tres variantes de Boss. */
export type Difficulty =
  | 'trivial'
  | 'easy'
  | 'medium'
  | 'hard'
  | 'epic'
  | 'boss_minor'
  | 'boss_major'
  | 'boss_legendary'

export type BossType = 'boss_minor' | 'boss_major' | 'boss_legendary'

export type Attribute =
  | 'vitality'
  | 'intellect'
  | 'discipline'
  | 'relations'
  | 'adventure'
  | 'fortune'

export type ShieldType = 'small' | 'large'

/** Los 8 objetos del mercado (documento funcional, sección 8). */
export type ItemId =
  | 'potion'
  | 'super_potion'
  | 'hyper_potion'
  | 'small_shield'
  | 'large_shield'
  | 'escape_rope'
  | 'celestial_hand'
  | 'immortality_totem'

export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary'

export type ItemEffectType = 'heal' | 'shield' | 'escape' | 'boss_defense' | 'revive'

export interface ItemDefinition {
  id: ItemId
  displayName: string
  rarity: ItemRarity
  price: number
  effectType: ItemEffectType
  /** null para objetos sin magnitud numérica de efecto (Cuerda Huida). */
  effectValue: number | null
  /** null si no hay límite de stock en mochila. */
  stackLimit: number | null
}

export interface CharacterState {
  level: number
  currentXp: number
  currentHp: number
}

export interface AttributeState {
  level: number
  currentXp: number
}

/** Resultado de aplicar XP a una barra de nivel (general o de atributo). */
export interface XpApplicationResult {
  level: number
  currentXp: number
  levelsGained: number
  xpOverflowLost: number
}

export interface MissionOutcomeInput {
  difficulty: Difficulty
  primaryAttribute: Attribute
  secondaryAttribute: Attribute | null
  generalState: { level: number; currentXp: number }
  primaryAttributeState: { level: number; currentXp: number }
  secondaryAttributeState: { level: number; currentXp: number } | null
}

export interface MissionCompletionResult {
  xpGained: number
  general: XpApplicationResult
  primaryAttribute: Attribute
  primaryAttributeResult: XpApplicationResult
  secondaryAttribute: Attribute | null
  secondaryAttributeResult: XpApplicationResult | null
}

export interface MissionFailureResult {
  damage: number
  shieldConsumed: boolean
  shieldOverflowLost: number
}

/** Las 9 categorías de logros (documento funcional, sección 14). */
export type AchievementCategory =
  | 'missions'
  | 'consistency'
  | 'bosses'
  | 'level_rank'
  | 'attributes'
  | 'survival'
  | 'items_market'
  | 'coins'
  | 'failure_recovery'

export interface AchievementDefinition {
  id: string
  category: AchievementCategory
  name: string
  requirementDescription: string
}

/** Nivel de un atributo junto con a qué atributo pertenece (attribute_progress no siempre trae currentXp cuando solo hace falta el nivel, p.ej. en evaluateStateBasedAchievements). */
export interface AttributeLevelState {
  attribute: Attribute
  level: number
}

/**
 * Contadores acumulados de una partida que solo suben (nunca bajan al
 * gastar/perder), usados por los logros de contador de la Tanda 2 (documento,
 * secciones 14.3, 14.5, 14.9, 14.10): misiones completadas, Bosses vencidos,
 * pociones usadas, compras de mercado y monedas ganadas en total.
 */
export interface AchievementCounters {
  missionsCompletedCount: number
  bossesWonCount: number
  potionsUsedCount: number
  marketPurchasesCount: number
  coinsEarnedTotal: number
}

/** Cantidad en mochila de cada objeto, indexada por ItemId (ausente equivale a 0). */
export type InventoryQuantities = Partial<Record<ItemId, number>>
