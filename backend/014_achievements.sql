-- Fase 7: Logros (documento, sección 14).
--
-- Tanda 1: solo se registran aquí los 27 logros de 'level_rank' y
-- 'attributes' (evaluateStateBasedAchievements, rules-engine), los únicos
-- calculables sin historial de eventos. El resto de los 70 logros
-- (ACHIEVEMENT_CATALOG, rules-engine) todavía no tiene evaluador: hasta que
-- se implementen en tandas futuras, sencillamente nunca se insertará una
-- fila para ellos.
--
-- achievement_id es texto libre (not null, sin check) a propósito: el
-- catálogo completo de 70 ids vive en rules-engine (ACHIEVEMENT_CATALOG) y
-- no se duplica aquí como constraint — igual que ITEM_CATALOG (8 objetos)
-- tampoco se replica como check en inventory_item. La app es la única que
-- escribe en esta tabla y solo escribe ids que existen en el catálogo.

-- 1. achievement_progress -----------------------------------------------

create table achievement_progress (
  id uuid primary key default gen_random_uuid(),
  adventure_run_id uuid not null references adventure_run(id),
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  unique (adventure_run_id, achievement_id)
);

create index achievement_progress_adventure_run_id_idx on achievement_progress (adventure_run_id);

alter table achievement_progress enable row level security;

create policy "achievement_progress_select_own"
  on achievement_progress for select
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = achievement_progress.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "achievement_progress_insert_own"
  on achievement_progress for insert
  to authenticated
  with check (
    exists (
      select 1 from adventure_run
      where adventure_run.id = achievement_progress.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "achievement_progress_update_own"
  on achievement_progress for update
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = achievement_progress.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from adventure_run
      where adventure_run.id = achievement_progress.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "achievement_progress_delete_own"
  on achievement_progress for delete
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = achievement_progress.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

-- 2. die_and_restart_adventure: también borra achievement_progress de la
-- partida vieja (documento 4.6: "Se eliminan todos los logros" / 14.1: "Los
-- logros se reinician al morir"). Idéntica a la versión de
-- 012_rank_rewards.sql salvo por esa única línea añadida; sigue sin BEGIN/
-- EXCEPTION ni commits intermedios, así que sigue siendo una única
-- transacción atómica.

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
  -- active_shield, active_celestial_hand, pending_reward y
  -- achievement_progress no tienen dependientes y pueden borrarse en
  -- cualquier orden.
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
