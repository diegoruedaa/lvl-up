-- Fase 8, Tanda 3: estado incremental para los logros de Constancia (7),
-- Supervivencia (6) y Fallos y Recuperación (5). Viven en "character" por el
-- mismo motivo que los contadores de 015_achievement_counters.sql: son 1:1
-- con la adventure_run y se actualizan en el mismo punto donde ya se
-- persiste el resto del estado del personaje, sin releer history_event.
--
-- completion_streak_days / last_completion_date: racha de días locales
-- consecutivos con al menos un mission_completed (SOLO misiones de
-- Tarea/Rutina, no bosses). Se compara la fecha local del día actual contra
-- last_completion_date en cada mission_completed: mismo día => no-op; día
-- siguiente => +1; cualquier otro caso (hueco o primera vez) => vuelve a 1.
-- Alimenta los 7 umbrales de Constancia (3/7/14/30/60/100/365).
--
-- last_damage_date: fecha local del último evento que restó HP
-- (mission_failed o boss_lost con damage > 0). Si es null, el logro
-- "Intocable" usa adventure_run.started_at como ancla. A diferencia de las
-- demás columnas, esta se revisa también al cargar el Dashboard (no solo al
-- escribir un evento), porque el umbral de 30 días se puede cruzar por el
-- simple paso del tiempo sin ninguna acción del usuario.
--
-- flawless_streak: racha de mission_completed consecutivos (solo
-- Tarea/Rutina) sin ningún mission_failed intercalado; mission_deleted y
-- mission_evaded no la avanzan ni la rompen (se ignoran). Alimenta "Camino
-- impecable" (>= 25) y, combinada con min_hp_reached_this_run < 25,
-- "Regreso triunfal" (>= 10) sin necesitar una columna aparte: cualquier
-- mission_failed que baje el HP por debajo de 25 resetea esta misma racha a
-- 0 en el mismo evento, así que el "portón" y el reinicio de la racha
-- siempre coinciden.
--
-- min_hp_reached_this_run: HP mínimo alcanzado en la partida activa
-- (arranca en 100, solo baja, nunca sube). Alimenta "Herido, pero en pie"
-- (< 25), "Nunca te rindas" (< 10, comprobado en la próxima subida de HP),
-- "De vuelta al camino" (< 100, es decir, ha recibido daño alguna vez) y el
-- portón de "Regreso triunfal" (< 25) descrito arriba.
--
-- attribute_last_completed: mapa {atributo: fecha local}, una entrada por
-- cada uno de los 6 atributos, actualizado en cada mission_completed con ese
-- atributo como principal (solo Tarea/Rutina). "Maestro versátil" se
-- desbloquea cuando las 6 fechas están presentes y su rango (máxima menos
-- mínima) es de 6 días o menos.
--
-- "Al límite" (HP == 1 al final de una resolución de daño) y "La muerte
-- tendrá que esperar" (activar un Tótem) y "Una lección aprendida" (fallar
-- la primera misión) no necesitan columna nueva: se resuelven con un
-- chequeo puntual en el momento exacto de la acción, igual que los 4 logros
-- de desbloqueo directo ya existentes desde Tanda 1/2.
--
-- No hace falta tocar die_and_restart_adventure (última versión en
-- 017_die_and_restart_row_lock.sql): su insert es
--   insert into "character" (adventure_run_id) values (v_new_adventure_run_id);
-- sin columnas explícitas, así que la fila nueva de cada partida ya toma los
-- valores por defecto de estas 6 columnas sin ningún cambio adicional.

alter table "character"
  add column completion_streak_days int not null default 0 check (completion_streak_days >= 0),
  add column last_completion_date date null,
  add column last_damage_date date null,
  add column flawless_streak int not null default 0 check (flawless_streak >= 0),
  add column min_hp_reached_this_run int not null default 100 check (min_hp_reached_this_run between 0 and 100),
  add column attribute_last_completed jsonb not null default '{}';
