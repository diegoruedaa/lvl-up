-- Fix de concurrencia en die_and_restart_adventure: se observó en pruebas
-- reales el error
--   duplicate key value violates unique constraint "adventure_run_one_active_per_user"
-- al morir, en vez del error ya manejado 'ya ha finalizado' (LV001).
--
-- Causa raíz: el SELECT inicial (todas las versiones anteriores, desde
-- 006_die_and_restart.sql) lee user_id/ended_at SIN ningún bloqueo. Si dos
-- llamadas concurrentes (p.ej. el doble-montaje de React StrictMode en
-- desarrollo, o dos pestañas) invocan la función casi a la vez sobre la
-- MISMA adventure_run_id todavía activa:
--   1. Ambas transacciones (T1, T2) ejecutan el SELECT antes de que ninguna
--      haya hecho commit: las dos leen ended_at = null y pasan el chequeo
--      "if v_ended_at is not null".
--   2. T1 sigue, hace sus deletes, marca la fila vieja ended_at = now() e
--      inserta la adventure_run nueva, y hace commit.
--   3. T2, al llegar a su propio "update adventure_run ... where id =
--      p_adventure_run_id", se bloquea (esa fila ya está bloqueada por T1
--      hasta su commit). En cuanto T1 hace commit, T2 se desbloquea: su
--      UPDATE reevalúa el WHERE contra la fila ya actualizada (mecanismo
--      EvalPlanQual de Postgres) y, como el id no cambia, el UPDATE de T2
--      igualmente tiene éxito (vuelve a poner ended_at = now()) — pero la
--      variable local v_ended_at de T2 sigue siendo la de su SELECT
--      original (null), porque ese chequeo ya pasó antes del bloqueo y
--      nunca se repite.
--   4. T2 continúa: sus deletes ya no borran nada (T1 ya lo hizo, 0 filas
--      afectadas, sin error) y llega al INSERT de una adventure_run nueva
--      para el mismo user_id. T1 ya insertó la suya (ended_at null): el
--      índice único parcial adventure_run_one_active_per_user salta aquí,
--      no en el chequeo de "ya finalizado".
--
-- Nota sobre consistencia de datos: como la función no tiene ningún bloque
-- BEGIN/EXCEPTION (sigue siendo una única transacción atómica, ver
-- comentario de 014_achievements.sql), el error sin capturar del INSERT de
-- T2 revierte TODA la transacción de T2 (incluidos sus deletes redundantes).
-- Es decir: los datos nunca quedan inconsistentes ni duplicados — la única
-- adventure_run activa que sobrevive es la de T1. El problema real era que
-- T2 le mostraba al usuario un error crudo de Postgres en vez del LV001 ya
-- manejado por isAdventureRunAlreadyEndedError (gameApi.ts), y que hacía
-- todo el trabajo de borrado dos veces para nada.
--
-- Fix: "select ... for update" en el SELECT inicial. Si T2 llega a ese
-- SELECT mientras T1 todavía no ha hecho commit, T2 se bloquea ahí mismo
-- (antes de leer nada, no después); en cuanto T1 hace commit, el FOR UPDATE
-- de T2 adquiere el lock y relee la fila YA ACTUALIZADA (a diferencia de un
-- SELECT normal, FOR UPDATE siempre devuelve la versión más reciente
-- confirmada de la fila que bloquea), así que v_ended_at ya no es null: el
-- chequeo "if v_ended_at is not null" ahora sí detecta correctamente que
-- otra llamada ya la finalizó, y lanza LV001 de forma limpia, ANTES de
-- tocar ninguna tabla — que es exactamente el error que gameApi.ts ya sabe
-- tolerar (isAdventureRunAlreadyEndedError) releyendo el estado con
-- ensureActiveGameState. No se necesita ningún cambio en el cliente.
--
-- No requiere ningún privilegio nuevo: SELECT ... FOR UPDATE exige permiso
-- de UPDATE sobre la tabla, y esta misma función ya hace "update
-- adventure_run" más abajo con éxito (security invoker, rol authenticated),
-- así que ese permiso ya existía.

create or replace function die_and_restart_adventure(p_adventure_run_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid;
  v_ended_at timestamptz;
  v_new_adventure_run_id uuid;
begin
  select user_id, ended_at into v_user_id, v_ended_at
  from adventure_run
  where id = p_adventure_run_id
  for update;

  if v_user_id is null then
    raise exception 'adventure_run % no existe', p_adventure_run_id;
  end if;

  if v_user_id <> auth.uid() then
    raise exception 'adventure_run % no pertenece al usuario autenticado', p_adventure_run_id;
  end if;

  if v_ended_at is not null then
    raise exception 'adventure_run % ya ha finalizado', p_adventure_run_id
      using errcode = 'LV001';
  end if;

  -- Orden de borrado: mission_occurrence depende de mission por FK y debe
  -- borrarse antes. attribute_progress, "character", inventory_item,
  -- active_shield, active_celestial_hand, pending_reward,
  -- achievement_progress e history_event no tienen dependientes y pueden
  -- borrarse en cualquier orden.
  delete from mission_occurrence
  where mission_id in (select id from mission where adventure_run_id = p_adventure_run_id);

  delete from mission where adventure_run_id = p_adventure_run_id;
  delete from attribute_progress where adventure_run_id = p_adventure_run_id;
  delete from "character" where adventure_run_id = p_adventure_run_id;
  delete from inventory_item where adventure_run_id = p_adventure_run_id;
  delete from active_shield where adventure_run_id = p_adventure_run_id;
  delete from active_celestial_hand where adventure_run_id = p_adventure_run_id;
  delete from pending_reward where adventure_run_id = p_adventure_run_id;
  delete from achievement_progress where adventure_run_id = p_adventure_run_id;
  delete from history_event where adventure_run_id = p_adventure_run_id;

  update adventure_run
  set ended_at = now(), ended_reason = 'death'
  where id = p_adventure_run_id;

  insert into adventure_run (user_id)
  values (v_user_id)
  returning id into v_new_adventure_run_id;

  -- level/current_xp/current_hp/coins toman sus valores por defecto (1, 0, 100, 0).
  insert into "character" (adventure_run_id)
  values (v_new_adventure_run_id);

  -- level/current_xp toman sus valores por defecto (1, 0) en las 6 filas.
  insert into attribute_progress (adventure_run_id, attribute)
  values
    (v_new_adventure_run_id, 'vitality'),
    (v_new_adventure_run_id, 'intellect'),
    (v_new_adventure_run_id, 'discipline'),
    (v_new_adventure_run_id, 'relations'),
    (v_new_adventure_run_id, 'adventure'),
    (v_new_adventure_run_id, 'fortune');

  return v_new_adventure_run_id;
end;
$$;

grant execute on function die_and_restart_adventure(uuid) to authenticated;
