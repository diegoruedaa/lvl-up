import { describe, expect, it, vi } from 'vitest'
import type { Difficulty } from 'rules-engine'
import type { MissionOccurrenceRow, MissionRow } from '../src/types/database'

// gameApi.ts importa './supabase', que crea el cliente real de Supabase y
// revienta si faltan las variables de entorno VITE_SUPABASE_*. Se mockea
// entero para que los tests no toquen ninguna base de datos ni dependan de
// esas variables.
vi.mock('../src/lib/supabase', () => ({ supabase: {} }))

const { computeExpiredFailureEvents, isAdventureRunAlreadyEndedError } = await import('../src/lib/gameApi')

function makeTaskMission(
  id: string,
  createdAt: Date,
  dueDate: string,
  dueTime: string | null,
  difficulty: Difficulty = 'easy',
): MissionRow {
  return {
    id,
    adventure_run_id: 'run-1',
    type: 'task',
    name: `task-${id}`,
    description: null,
    difficulty,
    primary_attribute: 'vitality',
    secondary_attribute: null,
    due_date: dueDate,
    due_time: dueTime,
    recurrence_rule: null,
    status: 'active',
    created_at: createdAt.toISOString(),
    resolved_at: null,
  }
}

function makeRoutineMission(id: string, createdAt: Date, difficulty: Difficulty = 'easy'): MissionRow {
  return {
    id,
    adventure_run_id: 'run-1',
    type: 'routine',
    name: `routine-${id}`,
    description: null,
    difficulty,
    primary_attribute: 'vitality',
    secondary_attribute: null,
    due_date: null,
    due_time: null,
    recurrence_rule: { frequency: 'daily' },
    status: 'active',
    created_at: createdAt.toISOString(),
    resolved_at: null,
  }
}

function makeBossMission(id: string, createdAt: Date, dueDate: string, difficulty: Difficulty = 'boss_minor'): MissionRow {
  return {
    id,
    adventure_run_id: 'run-1',
    type: 'boss',
    name: `boss-${id}`,
    description: null,
    difficulty,
    primary_attribute: 'vitality',
    secondary_attribute: null,
    due_date: dueDate,
    due_time: null,
    recurrence_rule: null,
    status: 'active',
    created_at: createdAt.toISOString(),
    resolved_at: null,
  }
}

function makeOccurrence(missionId: string, occurrenceDate: string): MissionOccurrenceRow {
  return {
    id: `${missionId}-${occurrenceDate}`,
    mission_id: missionId,
    occurrence_date: occurrenceDate,
    status: 'completed',
    resolved_at: new Date().toISOString(),
  }
}

describe('computeExpiredFailureEvents', () => {
  it('detecta una tarea vencida (due_date+due_time ya pasado)', () => {
    const now = new Date(2026, 0, 10, 12, 0, 0)
    const task = makeTaskMission('task-1', new Date(2026, 0, 1, 9, 0, 0), '2026-01-09', null)

    const events = computeExpiredFailureEvents([task], [], now)

    expect(events).toHaveLength(1)
    expect(events[0].mission.id).toBe('task-1')
    expect(events[0].occurrenceDate).toBeNull()
  })

  it('no genera evento para una tarea todavía no vencida', () => {
    const now = new Date(2026, 0, 10, 12, 0, 0)
    const task = makeTaskMission('task-1', new Date(2026, 0, 1, 9, 0, 0), '2026-01-15', null)

    const events = computeExpiredFailureEvents([task], [], now)

    expect(events).toHaveLength(0)
  })

  it('una rutina con varios días sin resolver genera un evento por cada día vencido', () => {
    const now = new Date(2026, 0, 10, 10, 0, 0)
    const routine = makeRoutineMission('routine-1', new Date(2026, 0, 7, 9, 0, 0))

    const events = computeExpiredFailureEvents([routine], [], now)

    // Días 7, 8 y 9 ya vencieron (23:59:59.999 pasado); hoy (10) a las 10:00
    // todavía no.
    expect(events.map((e) => e.occurrenceDate)).toEqual(['2026-01-07', '2026-01-08', '2026-01-09'])
    expect(events.every((e) => e.mission.id === 'routine-1')).toBe(true)
  })

  it('una rutina con algún día ya resuelto no genera evento para ese día', () => {
    const now = new Date(2026, 0, 10, 10, 0, 0)
    const routine = makeRoutineMission('routine-1', new Date(2026, 0, 7, 9, 0, 0))
    const occurrences = [makeOccurrence('routine-1', '2026-01-08')]

    const events = computeExpiredFailureEvents([routine], occurrences, now)

    expect(events.map((e) => e.occurrenceDate)).toEqual(['2026-01-07', '2026-01-09'])
  })

  it('devuelve los eventos de tarea y de rutina mezclados en orden cronológico de vencimiento', () => {
    const now = new Date(2026, 0, 10, 10, 0, 0)
    const routine = makeRoutineMission('routine-1', new Date(2026, 0, 7, 9, 0, 0))
    // Vence a las 06:00 del día 8, entre el vencimiento de la rutina del día
    // 7 (23:59:59.999) y el del día 8 (23:59:59.999).
    const task = makeTaskMission('task-1', new Date(2026, 0, 1, 9, 0, 0), '2026-01-08', '06:00')

    const events = computeExpiredFailureEvents([routine, task], [], now)

    expect(
      events.map((e) => (e.occurrenceDate === null ? `task:${e.mission.id}` : `routine:${e.occurrenceDate}`)),
    ).toEqual(['routine:2026-01-07', 'task:task-1', 'routine:2026-01-08', 'routine:2026-01-09'])
  })

  it('un Boss con fecha de resultado ya pasada nunca genera un evento de fallo', () => {
    const now = new Date(2026, 0, 10, 10, 0, 0)
    // Creado el mismo día que la rutina de la prueba anterior: si computeExpiredFailureEvents
    // tratara "no es task" como "es routine" (el bug que corrige 010_boss.sql/gameApi.ts),
    // esto generaría un evento por cada día 7, 8 y 9 igual que una rutina.
    const boss = makeBossMission('boss-1', new Date(2026, 0, 7, 9, 0, 0), '2026-01-07')

    const events = computeExpiredFailureEvents([boss], [], now)

    expect(events).toHaveLength(0)
  })

  it('un Boss vencido mezclado con misiones normales no afecta a los eventos de estas', () => {
    const now = new Date(2026, 0, 10, 10, 0, 0)
    const boss = makeBossMission('boss-1', new Date(2026, 0, 7, 9, 0, 0), '2026-01-07')
    const task = makeTaskMission('task-1', new Date(2026, 0, 1, 9, 0, 0), '2026-01-09', null)

    const events = computeExpiredFailureEvents([boss, task], [], now)

    expect(events).toHaveLength(1)
    expect(events[0].mission.id).toBe('task-1')
  })
})

describe('isAdventureRunAlreadyEndedError', () => {
  it('es true cuando el code coincide con el SQLSTATE propio LV001', () => {
    expect(isAdventureRunAlreadyEndedError({ code: 'LV001', message: 'cualquier cosa' })).toBe(true)
  })

  it('es true cuando el mensaje contiene la frase exacta de la excepción SQL (fallback sin code)', () => {
    expect(isAdventureRunAlreadyEndedError({ message: 'adventure_run 123 ya ha finalizado' })).toBe(true)
  })

  it('es false para otro mensaje de error de la misma función (adventure_run inexistente)', () => {
    expect(isAdventureRunAlreadyEndedError({ code: 'P0001', message: 'adventure_run 123 no existe' })).toBe(false)
  })

  it('es false para un mensaje con palabras parecidas que no forman la frase exacta', () => {
    expect(
      isAdventureRunAlreadyEndedError({ message: 'el proceso ya ha sido finalizado correctamente' }),
    ).toBe(false)
  })
})
