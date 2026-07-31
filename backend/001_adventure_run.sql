-- Fase 2: adventure_run
-- Una partida ("aventura") por usuario. Mientras ended_at es null, está activa.

create table adventure_run (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  ended_reason text null check (ended_reason in ('death'))
);

create index adventure_run_user_id_idx on adventure_run (user_id);

-- Garantiza una única aventura activa (ended_at is null) por usuario.
-- Ver PARTE del informe "Cómo garantizaste una única adventure_run activa" para el razonamiento.
create unique index adventure_run_one_active_per_user
  on adventure_run (user_id)
  where ended_at is null;

alter table adventure_run enable row level security;

create policy "adventure_run_select_own"
  on adventure_run for select
  to authenticated
  using (user_id = auth.uid());

create policy "adventure_run_insert_own"
  on adventure_run for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "adventure_run_update_own"
  on adventure_run for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "adventure_run_delete_own"
  on adventure_run for delete
  to authenticated
  using (user_id = auth.uid());
