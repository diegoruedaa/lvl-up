-- Fase 4: monedas, mercado y los 8 objetos.

-- 1. Monedas del personaje ---------------------------------------------

alter table "character"
  add column coins int not null default 0 check (coins >= 0);

-- 2. inventory_item -------------------------------------------------------
-- Una fila por (adventure_run, objeto) con la cantidad que hay en mochila.

create table inventory_item (
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
  quantity int not null default 0 check (quantity >= 0),
  unique (adventure_run_id, item_id)
);

create index inventory_item_adventure_run_id_idx on inventory_item (adventure_run_id);

alter table inventory_item enable row level security;

create policy "inventory_item_select_own"
  on inventory_item for select
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = inventory_item.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "inventory_item_insert_own"
  on inventory_item for insert
  to authenticated
  with check (
    exists (
      select 1 from adventure_run
      where adventure_run.id = inventory_item.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "inventory_item_update_own"
  on inventory_item for update
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = inventory_item.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from adventure_run
      where adventure_run.id = inventory_item.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "inventory_item_delete_own"
  on inventory_item for delete
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = inventory_item.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

-- 3. active_shield ----------------------------------------------------------
-- unique(adventure_run_id) garantiza como máximo un escudo activo por
-- partida. Se pueden comprar varios escudos, pero solo activar uno; activar
-- uno nuevo hace upsert sobre esta misma fila y sustituye al anterior.

create table active_shield (
  id uuid primary key default gen_random_uuid(),
  adventure_run_id uuid not null references adventure_run(id),
  item_id text not null check (item_id in ('small_shield', 'large_shield')),
  activated_at timestamptz not null default now(),
  unique (adventure_run_id)
);

alter table active_shield enable row level security;

create policy "active_shield_select_own"
  on active_shield for select
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = active_shield.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "active_shield_insert_own"
  on active_shield for insert
  to authenticated
  with check (
    exists (
      select 1 from adventure_run
      where adventure_run.id = active_shield.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "active_shield_update_own"
  on active_shield for update
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = active_shield.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from adventure_run
      where adventure_run.id = active_shield.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "active_shield_delete_own"
  on active_shield for delete
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = active_shield.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

-- 4. 'evaded' como nuevo status válido ------------------------------------
-- Cuerda Huida deja la misión (o la ocurrencia de rutina de hoy) en estado
-- 'evaded': no cuenta como completada ni como fallada, no da XP ni daño.
--
-- Los nombres de constraint de abajo (mission_status_check,
-- mission_occurrence_status_check) son los que Postgres asigna por defecto a
-- un check de columna sin nombre explícito (<tabla>_<columna>_check), que es
-- como están declarados ambos en 004_mission.sql y 005_mission_occurrence.sql.
-- Antes de ejecutar, confirma el nombre real con:
--   select conname from pg_constraint where conrelid = 'mission'::regclass and contype = 'c';
--   select conname from pg_constraint where conrelid = 'mission_occurrence'::regclass and contype = 'c';

alter table mission drop constraint mission_status_check;
alter table mission add constraint mission_status_check
  check (status in ('active', 'completed', 'failed', 'deleted', 'evaded'));

alter table mission_occurrence drop constraint mission_occurrence_status_check;
alter table mission_occurrence add constraint mission_occurrence_status_check
  check (status in ('active', 'completed', 'failed', 'deleted', 'evaded'));

-- 5. die_and_restart_adventure: también borra inventory_item y active_shield
-- de la partida vieja (documento: "todos los objetos se pierden al morir").
-- Igual que en 006_die_and_restart.sql, sin BEGIN/EXCEPTION ni commits
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
  -- borrarse antes. attribute_progress, "character", inventory_item y
  -- active_shield no tienen dependientes y pueden borrarse en cualquier orden.
  delete from mission_occurrence
  where mission_id in (select id from mission where adventure_run_id = p_adventure_run_id);

  delete from mission where adventure_run_id = p_adventure_run_id;
  delete from attribute_progress where adventure_run_id = p_adventure_run_id;
  delete from "character" where adventure_run_id = p_adventure_run_id;
  delete from inventory_item where adventure_run_id = p_adventure_run_id;
  delete from active_shield where adventure_run_id = p_adventure_run_id;

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
