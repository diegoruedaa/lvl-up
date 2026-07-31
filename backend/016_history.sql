-- Fase 8: Historial y estadísticas (documento, secciones 15 y 16.7).
--
-- history_event es una lista cronológica de eventos de juego (misión
-- completada/fallada/eliminada/evitada, Boss ganado/perdido, objeto usado,
-- escudo activado, compra, logro desbloqueado, subida de nivel, cambio de
-- rango, Tótem activado — 13 valores de event_type que cubren, a veces
-- fusionados en un mismo evento, los 15 tipos que lista 15.2: "daño
-- recibido" viaja como campo `damage` dentro de mission_failed/boss_lost, y
-- "vida recuperada" como campo `heal_amount` dentro de item_used, en vez de
-- ser eventos aparte, para que cada acción de juego sea una sola línea de
-- historial en vez de dos simultáneas).
--
-- payload es jsonb de forma libre (a propósito, sin columnas propias por
-- campo): cada event_type tiene su propia forma, decidida y documentada en
-- app/src/lib/gameApi.ts (los puntos que insertan cada evento) y
-- app/src/types/database.ts (los tipos de cada payload) — igual que
-- achievement_id en achievement_progress (014_achievements.sql) es texto
-- libre en vez de una columna por campo del catálogo.
--
-- seq (bigserial) es un desempate de orden para eventos insertados con el
-- mismo occurred_at (p.ej. mission_completed + level_up + rank_changed de un
-- mismo gesto): el índice y toda consulta de listado ordenan por
-- (occurred_at desc, seq desc).
--
-- Las estadísticas de 15.3 NO se guardan aquí ni en ninguna otra tabla: se
-- calculan en el momento en la app agregando sobre los history_event ya
-- cargados para la pantalla de historial (documento, decisión de diseño
-- explícita para esta fase: evitar una "estadística guardada" que se
-- desincronice de los eventos reales).

-- 1. history_event ---------------------------------------------------------

create table history_event (
  id uuid primary key default gen_random_uuid(),
  adventure_run_id uuid not null references adventure_run(id),
  event_type text not null,
  payload jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  seq bigserial
);

create index history_event_adventure_run_id_occurred_at_idx
  on history_event (adventure_run_id, occurred_at desc, seq desc);

alter table history_event enable row level security;

create policy "history_event_select_own"
  on history_event for select
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = history_event.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "history_event_insert_own"
  on history_event for insert
  to authenticated
  with check (
    exists (
      select 1 from adventure_run
      where adventure_run.id = history_event.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

-- No hay policy de update: el historial es de solo-inserción desde la app
-- (nunca se corrige ni se reescribe un evento ya registrado).

create policy "history_event_delete_own"
  on history_event for delete
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = history_event.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

-- 2. die_and_restart_adventure: también borra history_event de la partida
-- vieja (documento 15.4: "El historial se elimina completamente" / "Las
-- estadísticas vuelven a 0"). Idéntica a la versión de 014_achievements.sql
-- salvo por esa única línea añadida.

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
  where id = p_adventure_run_id;

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
