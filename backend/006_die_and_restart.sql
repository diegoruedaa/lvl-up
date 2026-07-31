-- Fase 3: die_and_restart_adventure
-- Muerte del personaje: termina la adventure_run actual, borra todo su
-- progreso y arranca una nueva adventure_run limpia para el mismo usuario.
--
-- Todo ocurre dentro de esta única función (sin bloques BEGIN/EXCEPTION que
-- absorban errores y sin commits intermedios), así que Postgres la ejecuta
-- como una única transacción: si cualquier paso falla, la excepción se
-- propaga y el conjunto entero se revierte.
--
-- security invoker (el valor por defecto, explicitado aquí) porque no hace
-- falta saltarse RLS: el chequeo de propiedad de más abajo garantiza que
-- auth.uid() es dueño de la adventure_run, así que las mismas policies que
-- protegen el resto de la app (mission_*_own, character_*_own, etc.) dejan
-- pasar sin problema todas las operaciones de esta función.

create function die_and_restart_adventure(p_adventure_run_id uuid)
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
    -- SQLSTATE propio (fuera de las clases reservadas a Postgres/estándar SQL:
    -- estas empiezan por dígito o por letra A-H, así que una clase que empiece
    -- por una letra I-Z queda reservada para uso de aplicación y no puede
    -- colisionar con códigos que Postgres añada en el futuro) para que
    -- gameApi.ts distinga esta excepción concreta de las otras dos de esta
    -- función sin tener que mirar el texto del mensaje.
    raise exception 'adventure_run % ya ha finalizado', p_adventure_run_id
      using errcode = 'LV001';
  end if;

  -- Orden de borrado: mission_occurrence depende de mission por FK y debe
  -- borrarse antes. attribute_progress y "character" no tienen dependientes
  -- y pueden borrarse en cualquier orden.
  delete from mission_occurrence
  where mission_id in (select id from mission where adventure_run_id = p_adventure_run_id);

  delete from mission where adventure_run_id = p_adventure_run_id;
  delete from attribute_progress where adventure_run_id = p_adventure_run_id;
  delete from "character" where adventure_run_id = p_adventure_run_id;

  update adventure_run
  set ended_at = now(), ended_reason = 'death'
  where id = p_adventure_run_id;

  insert into adventure_run (user_id)
  values (v_user_id)
  returning id into v_new_adventure_run_id;

  -- level/current_xp/current_hp toman sus valores por defecto (1, 0, 100).
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
