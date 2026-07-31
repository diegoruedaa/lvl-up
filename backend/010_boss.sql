-- Fase 5: Bosses.
--
-- 'boss' se añade como tipo de misión (mission.type), junto con las tres
-- dificultades boss_minor/boss_major/boss_legendary y dos estados de
-- historial nuevos, boss_won/boss_lost (en vez de reutilizar
-- completed/failed: ver justificación abajo, junto al punto 4).
--
-- due_date/due_time (ya existentes desde 004_mission.sql) se reutilizan tal
-- cual como "fecha de resultado" de un Boss: el documento (7.7) los lista
-- dentro del mismo formulario general sin definir un campo distinto para
-- Boss ("Fecha de resultado, si corresponde" aparece junto a "Fecha límite",
-- no en vez de ella), y 7.6 solo exige poder comparar esa fecha para saber
-- si el Boss ya está "pendiente". No hace falta una columna nueva.
--
-- mission_occurrence no se toca: un Boss nunca genera filas ahí (no es una
-- rutina), así que sus checks de tipo/dificultad no aplican a Boss.
--
-- ---------------------------------------------------------------------
-- IMPORTANTE: antes de ejecutar este archivo, confirma los nombres reales de
-- los check constraints de mission con esta consulta:
--
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'mission'::regclass and contype = 'c'
--   order by conname;
--
-- Este archivo asume, por la convención de nombres por defecto de Postgres
-- para checks de columna sin nombre explícito (<tabla>_<columna>_check, tal
-- como están declarados en 004_mission.sql), que son:
--   mission_type_check
--   mission_difficulty_check
--   mission_status_check  (ya renombrado explícitamente a este mismo nombre
--                          en 009_economy_and_items.sql al añadir 'evaded')
-- Si la consulta anterior devuelve nombres distintos, ajusta los
-- ALTER TABLE ... DROP CONSTRAINT de abajo antes de continuar.
-- ---------------------------------------------------------------------

-- 1. type: añadir 'boss' -------------------------------------------------

alter table mission drop constraint mission_type_check;
alter table mission add constraint mission_type_check
  check (type in ('routine', 'task', 'boss'));

-- 2. difficulty: añadir las tres dificultades de Boss --------------------

alter table mission drop constraint mission_difficulty_check;
alter table mission add constraint mission_difficulty_check
  check (
    difficulty in (
      'trivial', 'easy', 'medium', 'hard', 'epic',
      'boss_minor', 'boss_major', 'boss_legendary'
    )
  );

-- 3. Coherencia type/difficulty para Boss ---------------------------------
-- Evita crear una Tarea o Rutina con dificultad boss_* por error, y evita un
-- Boss con una dificultad que no sea boss_*. Constraint nueva, con nombre
-- explícito (no depende de la convención por defecto de Postgres).

alter table mission add constraint mission_boss_difficulty_check
  check (
    (type = 'boss') = (difficulty in ('boss_minor', 'boss_major', 'boss_legendary'))
  );

-- 4. status: añadir 'boss_won' y 'boss_lost' ------------------------------
--
-- A propósito distintos de 'completed'/'failed', no una reutilización:
--
-- - El documento (15.2) lista "Bosses ganados" y "Bosses perdidos" como
--   categorías de historial separadas de "misiones completadas" y
--   "misiones falladas" — son items distintos en la misma lista, no el
--   mismo evento con otra etiqueta.
-- - Los logros de misiones (14.3: "Completar 10/50/100/... misiones") y los
--   logros de Boss (14.5: "Vencer 1/5/10/... Bosses") se cuentan por
--   separado. Si Boss reutilizara 'completed'/'failed', cada consulta de
--   esos logros (y de las estadísticas de 15.3) tendría que añadir
--   "and type <> 'boss'" para no contaminar los contadores de misiones
--   normales; con un status propio, filtrar por status ya basta sin
--   recordar excluir el tipo en cada sitio.
--
-- Los nombres de constraint de abajo son los confirmados/asignados en
-- 009_economy_and_items.sql al añadir 'evaded'.

alter table mission drop constraint mission_status_check;
alter table mission add constraint mission_status_check
  check (status in ('active', 'completed', 'failed', 'deleted', 'evaded', 'boss_won', 'boss_lost'));
