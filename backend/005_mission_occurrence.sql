-- Fase 2: mission_occurrence
-- Solo aplica a misiones de tipo 'routine': cada día genera una ocurrencia
-- independiente que se completa/falla sin afectar a las demás.

create table mission_occurrence (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references mission(id),
  occurrence_date date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'failed', 'deleted')),
  resolved_at timestamptz null,
  unique (mission_id, occurrence_date)
);

create index mission_occurrence_mission_id_idx on mission_occurrence (mission_id);

alter table mission_occurrence enable row level security;

create policy "mission_occurrence_select_own"
  on mission_occurrence for select
  to authenticated
  using (
    exists (
      select 1
      from mission
      join adventure_run on adventure_run.id = mission.adventure_run_id
      where mission.id = mission_occurrence.mission_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "mission_occurrence_insert_own"
  on mission_occurrence for insert
  to authenticated
  with check (
    exists (
      select 1
      from mission
      join adventure_run on adventure_run.id = mission.adventure_run_id
      where mission.id = mission_occurrence.mission_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "mission_occurrence_update_own"
  on mission_occurrence for update
  to authenticated
  using (
    exists (
      select 1
      from mission
      join adventure_run on adventure_run.id = mission.adventure_run_id
      where mission.id = mission_occurrence.mission_id
        and adventure_run.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from mission
      join adventure_run on adventure_run.id = mission.adventure_run_id
      where mission.id = mission_occurrence.mission_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "mission_occurrence_delete_own"
  on mission_occurrence for delete
  to authenticated
  using (
    exists (
      select 1
      from mission
      join adventure_run on adventure_run.id = mission.adventure_run_id
      where mission.id = mission_occurrence.mission_id
        and adventure_run.user_id = auth.uid()
    )
  );
