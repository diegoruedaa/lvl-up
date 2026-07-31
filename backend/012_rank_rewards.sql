-- Fase 6: Rangos (documento, sección 12).
--
-- rankForLevel y rankRewardIfCrossed ya existen en rules-engine desde la
-- Fase 1 y no se tocan aquí (verificados contra el documento: 8 rangos y 7
-- recompensas coinciden exactamente).
--
-- Este archivo solo añade lo que falta en el backend: dónde guardar una
-- recompensa de rango que no se pudo entregar porque el objeto ya estaba a
-- su límite de stock (documento 12.4: "la recompensa queda pendiente...
-- puede reclamarse cuando exista espacio").
--
-- No se toca ningún constraint existente en este archivo (solo se crea una
-- tabla nueva y se reemplaza una función), así que no hace falta ninguna
-- consulta de verificación de nombres antes de ejecutarlo.

-- 1. pending_reward ---------------------------------------------------------
-- Una fila por recompensa de rango sin reclamar. A diferencia de
-- inventory_item, no tiene `unique (adventure_run_id, item_id)`: en teoría
-- podrían acumularse varias pendientes del mismo objeto si el usuario nunca
-- libera espacio (p.ej. dos rangos que dieran el mismo objeto), así que cada
-- recompensa pendiente es su propia fila y se reclaman en orden de
-- creación (created_at).

create table pending_reward (
  id uuid primary key default gen_random_uuid(),
  adventure_run_id uuid not null references adventure_run(id),
  item_id text not null check (
    item_id in (
      'potion',
      'super_potion',
      'hyper_potion',
      'small_shield',
      'large_shield',
      'escape_rope',
      'celestial_hand',
      'immortality_totem'
    )
  ),
  created_at timestamptz not null default now()
);

create index pending_reward_adventure_run_id_idx on pending_reward (adventure_run_id);

alter table pending_reward enable row level security;

create policy "pending_reward_select_own"
  on pending_reward for select
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = pending_reward.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "pending_reward_insert_own"
  on pending_reward for insert
  to authenticated
  with check (
    exists (
      select 1 from adventure_run
      where adventure_run.id = pending_reward.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "pending_reward_update_own"
  on pending_reward for update
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = pending_reward.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from adventure_run
      where adventure_run.id = pending_reward.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "pending_reward_delete_own"
  on pending_reward for delete
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = pending_reward.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

-- 2. die_and_restart_adventure: también borra pending_reward de la partida
-- vieja (documento 4.6: "Se eliminan las recompensas pendientes"). Idéntica
-- a la versión de 011_active_celestial_hand.sql salvo por esa única línea
-- añadida; sigue sin BEGIN/EXCEPTION ni commits intermedios, así que sigue
-- siendo una única transacción atómica.

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
  -- active_shield, active_celestial_hand y pending_reward no tienen
  -- dependientes y pueden borrarse en cualquier orden.
  delete from mission_occurrence
  where mission_id in (select id from mission where adventure_run_id = p_adventure_run_id);

  delete from mission where adventure_run_id = p_adventure_run_id;
  delete from attribute_progress where adventure_run_id = p_adventure_run_id;
  delete from "character" where adventure_run_id = p_adventure_run_id;
  delete from inventory_item where adventure_run_id = p_adventure_run_id;
  delete from active_shield where adventure_run_id = p_adventure_run_id;
  delete from active_celestial_hand where adventure_run_id = p_adventure_run_id;
  delete from pending_reward where adventure_run_id = p_adventure_run_id;

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
