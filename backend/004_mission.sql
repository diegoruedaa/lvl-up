-- Fase 2: mission
-- 'boss' se añade como tipo y como dificultades boss_* en una fase futura.

create table mission (
  id uuid primary key default gen_random_uuid(),
  adventure_run_id uuid not null references adventure_run(id),
  type text not null check (type in ('routine', 'task')),
  name text not null,
  description text null,
  difficulty text not null check (difficulty in ('trivial', 'easy', 'medium', 'hard', 'epic')),
  primary_attribute text not null check (
    primary_attribute in ('vitality', 'intellect', 'discipline', 'relations', 'adventure', 'fortune')
  ),
  secondary_attribute text null check (
    secondary_attribute in ('vitality', 'intellect', 'discipline', 'relations', 'adventure', 'fortune')
  ),
  check (secondary_attribute is null or secondary_attribute <> primary_attribute),
  due_date date null,
  due_time time null,
  recurrence_rule jsonb null,
  status text not null default 'active' check (status in ('active', 'completed', 'failed', 'deleted')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

create index mission_adventure_run_id_idx on mission (adventure_run_id);
create index mission_status_idx on mission (status);

alter table mission enable row level security;

create policy "mission_select_own"
  on mission for select
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = mission.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "mission_insert_own"
  on mission for insert
  to authenticated
  with check (
    exists (
      select 1 from adventure_run
      where adventure_run.id = mission.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "mission_update_own"
  on mission for update
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = mission.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from adventure_run
      where adventure_run.id = mission.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "mission_delete_own"
  on mission for delete
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = mission.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );
