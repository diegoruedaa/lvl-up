-- Fase 9: Tutorial inicial (documento, sección 6).
--
-- Problema a resolver: "el tutorial ya se completó alguna vez" debe
-- sobrevivir a la muerte del personaje (documento 6.2: "el tutorial no
-- vuelve a conceder la Poción ni las monedas" después de morir), pero
-- die_and_restart_adventure (017_die_and_restart_row_lock.sql) borra TODA
-- fila colgada de adventure_run_id, incluida "character" entera. Ninguna
-- tabla existente vive fuera de una adventure_run concreta salvo
-- adventure_run mismo (que no se borra, solo se marca ended_at) — no sirve
-- porque hay varias adventure_run por usuario a lo largo del tiempo.
--
-- user_profile es la primera tabla puramente "de cuenta": una fila por
-- auth.users, nunca por adventure_run_id, y por tanto invisible para
-- die_and_restart_adventure (que no la menciona ni falta que la mencione).
--
-- No reutiliza character.tutorial_completed_at (002_character.sql): esa
-- columna vive en "character", así que se borraría en cada muerte igual que
-- el resto de la partida — no sirve para "una vez en la vida de la cuenta".
-- Queda como campo muerto, sin tocar en esta migración.

create table user_profile (
  user_id uuid primary key references auth.users(id),
  tutorial_reward_claimed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table user_profile enable row level security;

-- RLS directo por user_id = auth.uid() (mismo patrón que adventure_run,
-- 001_adventure_run.sql), no el indirecto vía "exists (... adventure_run_id
-- ...)" que usa el resto de tablas: user_profile no cuelga de ninguna
-- adventure_run, es puramente de cuenta.

create policy "user_profile_select_own"
  on user_profile for select
  to authenticated
  using (user_id = auth.uid());

create policy "user_profile_insert_own"
  on user_profile for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "user_profile_update_own"
  on user_profile for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_profile_delete_own"
  on user_profile for delete
  to authenticated
  using (user_id = auth.uid());

-- Reclama la recompensa del tutorial (1 Poción + 10 monedas, documento 6.2)
-- sobre la adventure_run activa del usuario, de forma atómica y segura
-- contra reclamarla dos veces.
--
-- "for update" sobre la fila de user_profile (mismo fix de concurrencia que
-- 017_die_and_restart_row_lock.sql) bloquea cualquier llamada concurrente
-- del mismo usuario (doble-montaje de React StrictMode, doble pestaña) hasta
-- que la primera confirme; la segunda, al desbloquearse, relee
-- tutorial_reward_claimed ya en true y no concede nada. Devuelve true solo
-- si esta llamada concreta acaba de conceder la recompensa (para que el
-- cliente sepa si debe releer character/inventory_item), false si ya estaba
-- reclamada de antes (no-op).
create or replace function claim_tutorial_reward(p_adventure_run_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_already_claimed boolean;
  v_adventure_run_user_id uuid;
begin
  select tutorial_reward_claimed into v_already_claimed
  from user_profile
  where user_id = auth.uid()
  for update;

  if v_already_claimed is null then
    raise exception 'user_profile de % no existe', auth.uid();
  end if;

  if v_already_claimed then
    return false;
  end if;

  select user_id into v_adventure_run_user_id
  from adventure_run
  where id = p_adventure_run_id;

  if v_adventure_run_user_id is null then
    raise exception 'adventure_run % no existe', p_adventure_run_id;
  end if;

  if v_adventure_run_user_id <> auth.uid() then
    raise exception 'adventure_run % no pertenece al usuario autenticado', p_adventure_run_id;
  end if;

  update "character"
  set coins = coins + 10
  where adventure_run_id = p_adventure_run_id;

  insert into inventory_item (adventure_run_id, item_id, quantity)
  values (p_adventure_run_id, 'potion', 1)
  on conflict (adventure_run_id, item_id)
  do update set quantity = inventory_item.quantity + 1;

  update user_profile
  set tutorial_reward_claimed = true
  where user_id = auth.uid();

  return true;
end;
$$;

grant execute on function claim_tutorial_reward(uuid) to authenticated;
