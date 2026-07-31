-- Fase 2: attribute_progress
-- Una fila por atributo y adventure_run (6 filas por partida).

create table attribute_progress (
  id uuid primary key default gen_random_uuid(),
  adventure_run_id uuid not null references adventure_run(id),
  attribute text not null check (
    attribute in ('vitality', 'intellect', 'discipline', 'relations', 'adventure', 'fortune')
  ),
  level int not null default 1 check (level between 1 and 50),
  current_xp int not null default 0 check (current_xp >= 0),
  unique (adventure_run_id, attribute)
);

alter table attribute_progress enable row level security;

create policy "attribute_progress_select_own"
  on attribute_progress for select
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = attribute_progress.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "attribute_progress_insert_own"
  on attribute_progress for insert
  to authenticated
  with check (
    exists (
      select 1 from adventure_run
      where adventure_run.id = attribute_progress.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "attribute_progress_update_own"
  on attribute_progress for update
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = attribute_progress.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from adventure_run
      where adventure_run.id = attribute_progress.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );

create policy "attribute_progress_delete_own"
  on attribute_progress for delete
  to authenticated
  using (
    exists (
      select 1 from adventure_run
      where adventure_run.id = attribute_progress.adventure_run_id
        and adventure_run.user_id = auth.uid()
    )
  );
