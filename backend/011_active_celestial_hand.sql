-- Fase 5 (corrección): Mano Celestial requiere activación explícita.
--
-- El documento (8.11, línea 1308) dice literalmente "Debe activarse antes de
-- conocer o registrar el resultado" — una activación explícita, no una
-- aplicación automática por el mero hecho de tener unidades en
-- inventory_item. active_celestial_hand guarda ese estado "armado" por
-- partida, con la misma estructura y políticas que active_shield
-- (009_economy_and_items.sql), pero sin columna item_id: solo existe un
-- tipo de Mano Celestial, así que no hace falta distinguir cuál está activa,
-- solo si lo está.
--
-- No se toca ningún constraint existente en este archivo (solo se crea una
-- tabla nueva y se reemplaza una función), así que no hace falta ninguna
-- consulta de verificación de nombres antes de ejecutarlo.

-- 1. active_celestial_hand -------------------------------------------------
-- unique(adventure_run_id) garantiza como mucho una activación por partida.

create table active_celestial_hand (
  id uuid primary key default gen_random_uuid(),
  adventure_run_id uuid not null references adventure_run(id),
  activated_at timestamptz not null default now(),
  unique (adventure_run_id)
);

alter table active_celestial_hand enable row level security;

create policy "active_celestial_hand_select_own"
  on active_celestial_hand for select
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = active_celestial_hand.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "active_celestial_hand_insert_own"
  on active_celestial_hand for insert
  to authenticated
  with check (
    exists (
      select 1 from adventure_run
      where adventure_run.id = active_celestial_hand.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "active_celestial_hand_update_own"
  on active_celestial_hand for update
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = active_celestial_hand.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from adventure_run
      where adventure_run.id = active_celestial_hand.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "active_celestial_hand_delete_own"
  on active_celestial_hand for delete
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = active_celestial_hand.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

-- 2. die_and_restart_adventure: también borra active_celestial_hand de la
-- partida vieja (documento: "todos los objetos se pierden al morir", y una
-- Mano Celestial activada pero sin resolver es parte del estado de esa
-- partida). Idéntica a la versión de 009_economy_and_items.sql salvo por
-- esa única línea añadida; sigue sin BEGIN/EXCEPTION ni commits
-- intermedios, así que sigue siendo una única transacción atómica.

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
  -- active_shield y active_celestial_hand no tienen dependientes y pueden
  -- borrarse en cualquier orden.
  delete from mission_occurrence
  where mission_id in (select id from mission where adventure_run_id = p_adventure_run_id);

  delete from mission where adventure_run_id = p_adventure_run_id;
  delete from attribute_progress where adventure_run_id = p_adventure_run_id;
  delete from "character" where adventure_run_id = p_adventure_run_id;
  delete from inventory_item where adventure_run_id = p_adventure_run_id;
  delete from active_shield where adventure_run_id = p_adventure_run_id;
  delete from active_celestial_hand where adventure_run_id = p_adventure_run_id;

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
