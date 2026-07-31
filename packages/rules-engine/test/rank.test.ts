import { describe, expect, it } from 'vitest'
import { rankForLevel, rankRewardIfCrossed } from '../src/rank.js'

describe('rankForLevel', () => {
  it.each([
    [1, 'Novato'],
    [9, 'Novato'],
    [10, 'Aventurero'],
    [19, 'Aventurero'],
    [20, 'Guerrero'],
    [34, 'Guerrero'],
    [35, 'Élite'],
    [49, 'Élite'],
    [50, 'Maestro'],
    [69, 'Maestro'],
    [70, 'Leyenda'],
    [89, 'Leyenda'],
    [90, 'Héroe'],
    [99, 'Héroe'],
    [100, 'Inmortal'],
  ])('nivel %i -> %s', (level, expectedName) => {
    expect(rankForLevel(level).name).toBe(expectedName)
  })
})

describe('rankRewardIfCrossed', () => {
  it('salto que cruza una sola frontera de rango concede su recompensa', () => {
    // 19 (Aventurero) -> 20 (Guerrero)
    expect(rankRewardIfCrossed(19, 20)).toEqual(['super_potion'])
  })

  it('salto que cruza dos fronteras de golpe devuelve ambas recompensas en orden', () => {
    // 9 (Novato) -> 20 (Guerrero): cruza Aventurero (potion) y Guerrero (super_potion)
    expect(rankRewardIfCrossed(9, 20)).toEqual(['potion', 'super_potion'])
  })

  it('salto que no cruza ninguna frontera no concede recompensa', () => {
    // 11 -> 15, ambos dentro de Aventurero
    expect(rankRewardIfCrossed(11, 15)).toEqual([])
  })

  it('alcanzar Inmortal (nivel 100) no concede recompensa material', () => {
    expect(rankRewardIfCrossed(99, 100)).toEqual([])
  })

  it('alcanzar Héroe concede el Tótem de la Inmortalidad', () => {
    expect(rankRewardIfCrossed(89, 90)).toEqual(['immortality_totem'])
  })
})
