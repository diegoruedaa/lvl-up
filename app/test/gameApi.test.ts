import { describe, expect, it, vi } from 'vitest'
import type { Difficulty } from 'rules-engine'
import type { MissionOccurrenceRow, MissionRow } from '../src/types/database'

// gameApi.ts importa './supabase', que crea el cliente real de Supabase y
// revienta si faltan las variables de entorno VITE_SUPABASE_*. Se mockea
// entero para que los tests no toquen ninguna base de datos ni dependan de
// esas variables.
vi.mock('../src/lib/supabase', () => ({ supabase: {} }))

const { computeExpiredFailureEvents, isAdventureRunAlreadyEndedError, isDayApplicable, routineStreakFromOccurrences } =
  await import('../src/lib/gameApi')

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
    days_of_week: null,
    end_date: null,
    status: 'active',
    created_at: createdAt.toISOString(),
    resolved_at: null,
  }
}

function makeRoutineMission(
  id: string,
  createdAt: Date,
  difficulty: Difficulty = 'easy',
  daysOfWeek: number[] | null = null,
  endDate: string | null = null,
): MissionRow {
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
    days_of_week: daysOfWeek,
    end_date: endDate,
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
    days_of_week: null,
    end_date: null,
    status: 'active',
    created_at: createdAt.toISOString(),
    resolved_at: null,
  }
}

function makeOccurrence(
  missionId: string,
  occurrenceDate: string,
  status: MissionOccurrenceRow['status'] = 'completed',
): MissionOccurrenceRow {
  return {
    id: `${missionId}-${occurrenceDate}`,
    mission_id: missionId,
    occurrence_date: occurrenceDate,
    status,
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

  it('una rutina con days_of_week solo genera evento los días marcados', () => {
    const now = new Date(2026, 0, 10, 10, 0, 0)
    // 2026-01-07 es miércoles, 08 jueves, 09 viernes: días_of_week = [1,3,5]
    // (Lunes/Miércoles/Viernes) deja fuera el jueves.
    const routine = makeRoutineMission('routine-1', new Date(2026, 0, 7, 9, 0, 0), 'easy', [1, 3, 5])

    const events = computeExpiredFailureEvents([routine], [], now)

    expect(events.map((e) => e.occurrenceDate)).toEqual(['2026-01-07', '2026-01-09'])
  })

  it('una rutina sin days_of_week (rutina ya existente antes de este campo) se comporta como "todos los días"', () => {
    const now = new Date(2026, 0, 10, 10, 0, 0)
    const routine = makeRoutineMission('routine-1', new Date(2026, 0, 7, 9, 0, 0), 'easy', null, null)

    const events = computeExpiredFailureEvents([routine], [], now)

    expect(events.map((e) => e.occurrenceDate)).toEqual(['2026-01-07', '2026-01-08', '2026-01-09'])
  })

  it('una rutina con end_date ya pasado deja de generar eventos a partir del día siguiente al cierre', () => {
    const now = new Date(2026, 0, 10, 10, 0, 0)
    // end_date inclusive: el día 7 (el propio end_date) todavía genera
    // evento; el 8 y el 9 (posteriores al cierre) ya no.
    const routine = makeRoutineMission('routine-1', new Date(2026, 0, 7, 9, 0, 0), 'easy', null, '2026-01-07')

    const events = computeExpiredFailureEvents([routine], [], now)

    expect(events.map((e) => e.occurrenceDate)).toEqual(['2026-01-07'])
  })

  it('una rutina con end_date hoy todavía genera evento para hoy si vence antes de `now`', () => {
    const now = new Date(2026, 0, 10, 23, 59, 59, 999)
    const routine = makeRoutineMission('routine-1', new Date(2026, 0, 10, 9, 0, 0), 'easy', null, '2026-01-10')

    const events = computeExpiredFailureEvents([routine], [], now)

    expect(events.map((e) => e.occurrenceDate)).toEqual(['2026-01-10'])
  })
})

describe('isDayApplicable', () => {
  it('con days_of_week null, cualquier día es aplicable', () => {
    const routine = makeRoutineMission('routine-1', new Date(2026, 0, 1))
    expect(isDayApplicable(routine, '2026-01-07')).toBe(true)
  })

  it('con days_of_week [1,3,5], solo lunes/miércoles/viernes son aplicables', () => {
    const routine = makeRoutineMission('routine-1', new Date(2026, 0, 1), 'easy', [1, 3, 5])
    expect(isDayApplicable(routine, '2026-01-07')).toBe(true) // miércoles
    expect(isDayApplicable(routine, '2026-01-08')).toBe(false) // jueves
  })

  it('domingo se interpreta como día ISO 7, no 0', () => {
    const routine = makeRoutineMission('routine-1', new Date(2026, 0, 1), 'easy', [7])
    expect(isDayApplicable(routine, '2026-01-11')).toBe(true) // domingo
    expect(isDayApplicable(routine, '2026-01-12')).toBe(false) // lunes
  })
})

describe('routineStreakFromOccurrences', () => {
  it('rutina recién creada sin ninguna ocurrencia: racha 0', () => {
    expect(routineStreakFromOccurrences([], '2026-01-10')).toBe(0)
  })

  it('varios días completados seguidos suman la racha', () => {
    const occurrences = [
      makeOccurrence('r1', '2026-01-07'),
      makeOccurrence('r1', '2026-01-08'),
      makeOccurrence('r1', '2026-01-09'),
    ]
    expect(routineStreakFromOccurrences(occurrences, '2026-01-10')).toBe(3)
  })

  it('un fallo corta la racha en ese punto, sin contar los días anteriores', () => {
    const occurrences = [
      makeOccurrence('r1', '2026-01-06'),
      makeOccurrence('r1', '2026-01-07'),
      makeOccurrence('r1', '2026-01-08', 'failed'),
      makeOccurrence('r1', '2026-01-09'),
    ]
    // 09 suma (1), 08 es el fallo que corta: 06 y 07 no cuentan aunque estén completados.
    expect(routineStreakFromOccurrences(occurrences, '2026-01-10')).toBe(1)
  })

  it('un fallo el día más reciente deja la racha en 0', () => {
    const occurrences = [makeOccurrence('r1', '2026-01-08'), makeOccurrence('r1', '2026-01-09', 'failed')]
    expect(routineStreakFromOccurrences(occurrences, '2026-01-10')).toBe(0)
  })

  it('un día evitado con la Cuerda de Huida mantiene la racha viva, igual que un completado', () => {
    const occurrences = [
      makeOccurrence('r1', '2026-01-07'),
      makeOccurrence('r1', '2026-01-08', 'evaded'),
      makeOccurrence('r1', '2026-01-09'),
    ]
    expect(routineStreakFromOccurrences(occurrences, '2026-01-10')).toBe(3)
  })

  it('el día de hoy se salta: ni suma ni rompe la racha aunque tenga fila', () => {
    const occurrences = [
      makeOccurrence('r1', '2026-01-08'),
      makeOccurrence('r1', '2026-01-09'),
      makeOccurrence('r1', '2026-01-10', 'failed'),
    ]
    // Si "hoy" (10) contara, el 'failed' de hoy cortaría la racha a 0; al saltarse, sigue mirando
    // hacia atrás y cuenta los dos días anteriores.
    expect(routineStreakFromOccurrences(occurrences, '2026-01-10')).toBe(2)
  })

  it('no depende del orden de entrada: reordena por fecha antes de recorrer', () => {
    const occurrences = [
      makeOccurrence('r1', '2026-01-09'),
      makeOccurrence('r1', '2026-01-07'),
      makeOccurrence('r1', '2026-01-08'),
    ]
    expect(routineStreakFromOccurrences(occurrences, '2026-01-10')).toBe(3)
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
