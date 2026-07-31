-- Fix del bug: declarar Victoria/Derrota de un Boss aplicaba XP/monedas/daño
-- vía una secuencia de updates/inserts sueltos desde el cliente (gameApi.ts:
-- resolveBossVictory/resolveBossDefeat), sin ningún guard. Si el usuario
-- cambiaba de pestaña de la SPA entre "Confirmar" (que ya escribía todo en
-- BD) y "Continuar" (que solo cerraba la pantalla y actualizaba el estado
-- local de React), BossBattleScreen se desmontaba y Dashboard seguía
-- mostrando el Boss en "Batallas pendientes" con sus datos viejos. Si el
-- usuario volvía a declarar un resultado sobre esa misma tarjeta stale,
-- resolveBossVictory/resolveBossDefeat se ejecutaban otra vez sin que nada
-- comprobara mission.status primero: XP, monedas y daño se aplicaban dos
-- veces para el mismo Boss.
--
-- Fix: dos funciones nuevas, mismo patrón de "for update" + guard que
-- claim_tutorial_reward (020_tutorial.sql) y die_and_restart_adventure
-- (017_die_and_restart_row_lock.sql). Bloquean la fila de mission, comprueban
-- status = 'active' (si no, lanzan LV002: "esta batalla ya se resolvió") y
-- solo si pasa el guard aplican TODAS las escrituras de la Victoria/Derrota
-- en la misma transacción — guard y consecuencias ya no pueden quedar
-- separados por ningún abandono del cliente a media pantalla.
--
-- La curva de XP (xpForMissionCompletion, rules-engine) y la decisión de qué
-- recompensa de rango va a inventory_item vs pending_reward
-- (canAddItemToInventory) NO se reimplementan aquí: el cliente sigue
-- calculándolas como hoy y pasa los valores ya resueltos como parámetros,
-- para no duplicar esa lógica de negocio en dos lenguajes. Igual que
-- claim_tutorial_reward, ambas funciones devuelven void; el cliente relee
-- solo lo que cambió (character, attribute_progress, inventory_item,
-- achievement_progress) tras una llamada exitosa, en vez de que la función
-- intente devolver todo el estado nuevo.
--
-- Salvedad conocida y aceptada (no es una regresión: ya era así antes de
-- este fix, solo que ahora queda documentada): el reparto inventory_item vs
-- pending_reward que decide el cliente puede quedar stale si el stock de
-- ese objeto cambia entre esa comprobación y esta transacción (otra pestaña
-- comprando/vendiendo). Para que esa carrera puntual no tumbe TODA la
-- resolución del Boss (el check inventory_item_stock_limit_check aborta la
-- transacción si se viola), cada intento de entrega directa captura ese
-- check_violation concreto y redirige el objeto a pending_reward en su
-- lugar. La cantidad de reparto entre las dos vías del cliente
-- (fetchActiveCelestialHand, decisión inventory/pending) puede así diferir
-- en el caso raro descrito, con consecuencia puramente cosmética (un aviso
-- local que diga "a tu mochila" cuando en realidad fue a pendientes); nunca
-- corrompe datos ni duplica una recompensa.

-- 1. Victoria -----------------------------------------------------------

create or replace function resolve_boss_victory(
  p_mission_id uuid,
  p_new_character_level int,
  p_new_character_current_xp int,
  p_coins_gained int,
  p_new_primary_attribute_level int,
  p_new_primary_attribute_current_xp int,
  p_new_secondary_attribute_level int default null,
  p_new_secondary_attribute_current_xp int default null,
  p_xp_general int default 0,
  p_xp_primary int default 0,
  p_xp_secondary int default null,
  p_rank_reward_inventory_item_ids text[] default '{}',
  p_rank_reward_pending_item_ids text[] default '{}',
  p_old_rank_name text default null,
  p_new_rank_name text default null,
  p_boss_no_celestial_hand_achievement_name text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_mission mission%rowtype;
  v_adventure_run_id uuid;
  v_old_level int;
  v_levels_gained int;
  v_had_celestial_hand boolean;
  v_deleted_count int;
  v_item_id text;
begin
  -- "for update": bloquea esta fila de mission hasta el commit. Una segunda
  -- llamada (doble-pestaña, o reabrir una pantalla de batalla stale tras
  -- cambiar de tab sin pulsar "Continuar") se bloquea aquí mismo hasta que
  -- la primera confirme, y al desbloquearse relee status ya en 'boss_won' —
  -- exactamente el mismo mecanismo de 017_die_and_restart_row_lock.sql.
  select * into v_mission
  from mission
  where id = p_mission_id
  for update;

  if v_mission.id is null then
    raise exception 'mission % no existe', p_mission_id;
  end if;

  if v_mission.type <> 'boss' then
    raise exception 'mission % no es un Boss', p_mission_id;
  end if;

  -- No se comprueba aquí la propiedad del usuario (adventure_run.user_id =
  -- auth.uid()) como sí hace die_and_restart_adventure: con security invoker
  -- las RLS de mission/character/etc. ya bastan (mission_select_own filtra
  -- la fila si no es del usuario, cayendo en el caso "no existe" de arriba),
  -- y el radio de esta función es marcar una misión, no resetear una cuenta
  -- entera, así que no hace falta el mensaje distinto de die_and_restart_adventure.
  if v_mission.status <> 'active' then
    raise exception 'la batalla contra "%" ya se resolvió (status=%)', v_mission.name, v_mission.status
      using errcode = 'LV002';
  end if;

  v_adventure_run_id := v_mission.adventure_run_id;

  update mission
  set status = 'boss_won', resolved_at = now()
  where id = p_mission_id;

  -- "for update" también aquí: cierra el mismo hueco de lost-update que
  -- 017_die_and_restart_row_lock.sql documenta para adventure_run, esta vez
  -- sobre "character" mientras dura esta transacción.
  select level into v_old_level
  from "character"
  where adventure_run_id = v_adventure_run_id
  for update;

  v_levels_gained := p_new_character_level - v_old_level;

  update "character"
  set level = p_new_character_level,
      current_xp = p_new_character_current_xp,
      coins = coins + p_coins_gained,
      coins_earned_total = coins_earned_total + p_coins_gained,
      bosses_won_count = bosses_won_count + 1
  where adventure_run_id = v_adventure_run_id;

  update attribute_progress
  set level = p_new_primary_attribute_level,
      current_xp = p_new_primary_attribute_current_xp
  where adventure_run_id = v_adventure_run_id
    and attribute = v_mission.primary_attribute;

  if v_mission.secondary_attribute is not null then
    update attribute_progress
    set level = p_new_secondary_attribute_level,
        current_xp = p_new_secondary_attribute_current_xp
    where adventure_run_id = v_adventure_run_id
      and attribute = v_mission.secondary_attribute;
  end if;

  -- Recompensas de rango: reparto ya decidido por el cliente
  -- (canAddItemToInventory), con fallback a pending_reward si ese reparto
  -- quedó stale (ver comentario de cabecera).
  foreach v_item_id in array p_rank_reward_inventory_item_ids loop
    begin
      insert into inventory_item (adventure_run_id, item_id, quantity)
      values (v_adventure_run_id, v_item_id, 1)
      on conflict (adventure_run_id, item_id)
      do update set quantity = inventory_item.quantity + 1;
    exception when check_violation then
      insert into pending_reward (adventure_run_id, item_id)
      values (v_adventure_run_id, v_item_id);
    end;
  end loop;

  foreach v_item_id in array p_rank_reward_pending_item_ids loop
    insert into pending_reward (adventure_run_id, item_id)
    values (v_adventure_run_id, v_item_id);
  end loop;

  -- Mano Celestial: se consume también al ganar (documento 8.11). "consumido"
  -- se decide por si de verdad había una fila que borrar, no por lo que el
  -- cliente creyera tener al calcular el resultado.
  delete from active_celestial_hand where adventure_run_id = v_adventure_run_id;
  get diagnostics v_deleted_count = row_count;
  v_had_celestial_hand := v_deleted_count > 0;

  if not v_had_celestial_hand then
    insert into achievement_progress (adventure_run_id, achievement_id)
    values (v_adventure_run_id, 'boss_no_celestial_hand')
    on conflict (adventure_run_id, achievement_id) do nothing;

    if found and p_boss_no_celestial_hand_achievement_name is not null then
      insert into history_event (adventure_run_id, event_type, payload)
      values (
        v_adventure_run_id,
        'achievement_unlocked',
        jsonb_build_object(
          'achievement_id', 'boss_no_celestial_hand',
          'achievement_name', p_boss_no_celestial_hand_achievement_name,
          'category', 'bosses'
        )
      );
    end if;
  end if;

  insert into history_event (adventure_run_id, event_type, payload)
  values (
    v_adventure_run_id,
    'boss_won',
    jsonb_build_object(
      'mission_id', v_mission.id,
      'boss_name', v_mission.name,
      'difficulty', v_mission.difficulty,
      'coins_gained', p_coins_gained,
      'xp_general', p_xp_general,
      'xp_primary', p_xp_primary,
      'xp_secondary', p_xp_secondary,
      'primary_attribute', v_mission.primary_attribute,
      'secondary_attribute', v_mission.secondary_attribute,
      'celestial_hand_consumed', v_had_celestial_hand
    )
  );

  if v_levels_gained > 0 then
    insert into history_event (adventure_run_id, event_type, payload)
    values (
      v_adventure_run_id,
      'level_up',
      jsonb_build_object(
        'from_level', v_old_level,
        'to_level', p_new_character_level,
        'levels_gained', v_levels_gained
      )
    );

    if p_old_rank_name is not null and p_new_rank_name is not null and p_old_rank_name <> p_new_rank_name then
      insert into history_event (adventure_run_id, event_type, payload)
      values (
        v_adventure_run_id,
        'rank_changed',
        jsonb_build_object('from_rank', p_old_rank_name, 'to_rank', p_new_rank_name)
      );
    end if;
  end if;
end;
$$;

grant execute on function resolve_boss_victory(
  uuid, int, int, int, int, int, int, int, int, int, int, text[], text[], text, text, text
) to authenticated;

-- 2. Derrota (rama en la que el personaje sobrevive) ---------------------
--
-- La rama en la que el daño mata al personaje NO pasa por aquí: el cliente
-- sigue llamando directo a die_and_restart_adventure (017_die_and_restart_row_lock.sql),
-- que ya es atómica y ya tiene su propio guard (LV001 sobre
-- adventure_run.ended_at). Esa rama nunca llegaba a tocar mission.status
-- (la misión se borra igualmente al reiniciar la partida), así que ya era
-- segura contra el doble-confirmar antes de este fix.

create or replace function resolve_boss_defeat_alive(
  p_mission_id uuid,
  p_new_current_hp int,
  p_damage_taken int,
  p_totem_consumed boolean default false,
  p_last_damage_date date default null,
  p_totem_activated_achievement_name text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_mission mission%rowtype;
  v_adventure_run_id uuid;
  v_had_celestial_hand boolean;
  v_deleted_count int;
begin
  select * into v_mission
  from mission
  where id = p_mission_id
  for update;

  if v_mission.id is null then
    raise exception 'mission % no existe', p_mission_id;
  end if;

  if v_mission.type <> 'boss' then
    raise exception 'mission % no es un Boss', p_mission_id;
  end if;

  if v_mission.status <> 'active' then
    raise exception 'la batalla contra "%" ya se resolvió (status=%)', v_mission.name, v_mission.status
      using errcode = 'LV002';
  end if;

  v_adventure_run_id := v_mission.adventure_run_id;

  update mission
  set status = 'boss_lost', resolved_at = now()
  where id = p_mission_id;

  -- Una Derrota de Boss siempre causa daño > 0 (BOSS_DEFEAT_DAMAGE/
  -- _WITH_CELESTIAL_HAND, rules-engine), así que last_damage_date se
  -- actualiza sin condición, igual que en el gameApi.ts original.
  update "character"
  set current_hp = p_new_current_hp,
      min_hp_reached_this_run = least(min_hp_reached_this_run, p_new_current_hp),
      last_damage_date = p_last_damage_date
  where adventure_run_id = v_adventure_run_id;

  delete from active_celestial_hand where adventure_run_id = v_adventure_run_id;
  get diagnostics v_deleted_count = row_count;
  v_had_celestial_hand := v_deleted_count > 0;

  if p_totem_consumed then
    update inventory_item
    set quantity = quantity - 1
    where adventure_run_id = v_adventure_run_id
      and item_id = 'immortality_totem';

    insert into history_event (adventure_run_id, event_type, payload)
    values (
      v_adventure_run_id,
      'totem_activated',
      jsonb_build_object('context', 'boss_defeat', 'source_name', v_mission.name)
    );

    insert into achievement_progress (adventure_run_id, achievement_id)
    values (v_adventure_run_id, 'totem_activated')
    on conflict (adventure_run_id, achievement_id) do nothing;

    if found and p_totem_activated_achievement_name is not null then
      insert into history_event (adventure_run_id, event_type, payload)
      values (
        v_adventure_run_id,
        'achievement_unlocked',
        jsonb_build_object(
          'achievement_id', 'totem_activated',
          'achievement_name', p_totem_activated_achievement_name,
          'category', 'survival'
        )
      );
    end if;
  end if;

  insert into history_event (adventure_run_id, event_type, payload)
  values (
    v_adventure_run_id,
    'boss_lost',
    jsonb_build_object(
      'mission_id', v_mission.id,
      'boss_name', v_mission.name,
      'difficulty', v_mission.difficulty,
      'damage', p_damage_taken,
      'celestial_hand_consumed', v_had_celestial_hand
    )
  );
end;
$$;

grant execute on function resolve_boss_defeat_alive(uuid, int, int, boolean, date, text) to authenticated;
