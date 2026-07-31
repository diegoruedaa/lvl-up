-- Fase 2: character
-- Relación 1:1 con una adventure_run. "character" se entrecomilla porque es
-- palabra reservada de tipo en SQL (character varying); como nombre de tabla
-- funciona pero se referencia siempre entre comillas para evitar ambigüedad.

create table "character" (
  id uuid primary key default gen_random_uuid(),
  adventure_run_id uuid not null references adventure_run(id),
  level int not null default 1 check (level between 1 and 100),
  current_xp int not null default 0 check (current_xp >= 0),
  current_hp int not null default 100 check (current_hp between 0 and 100),
  tutorial_completed_at timestamptz null,
  unique (adventure_run_id)
);

alter table "character" enable row level security;

create policy "character_select_own"
  on "character" for select
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = "character".adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "character_insert_own"
  on "character" for insert
  to authenticated
  with check (
    exists (
      select 1 from adventure_run
      where adventure_run.id = "character".adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "character_update_own"
  on "character" for update
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = "character".adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from adventure_run
      where adventure_run.id = "character".adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "character_delete_own"
  on "character" for delete
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = "character".adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );
