-- Fase 8, Tanda 3, corrección: 'mission_after_damage' (De vuelta al camino)
-- comprobaba min_hp_reached_this_run < 100 (018_achievement_streaks.sql),
-- pero esa columna la actualizan tanto processExpiredMissions (fallo de
-- Tarea/Rutina) como resolveBossDefeat (Derrota de Boss) — sin distinguir el
-- origen. Con el mismo criterio ya aplicado al resto de esta tanda ("misión"
-- y "Boss" son categorías separadas: missions_completed_count vs
-- bosses_won_count, documento 14.3 vs 14.5), perder solo un Boss no debe
-- desbloquear "De vuelta al camino" — el logro es sobre fallar/recibir daño
-- de una MISIÓN, no de un Boss.
--
-- mission_damage_taken es una columna dedicada solo a esto: la pone a true
-- únicamente processExpiredMissions (mismo evento anyDamageDealt que ya
-- actualiza last_damage_date), nunca resolveBossDefeat. Una vez en true se
-- queda así el resto de la partida (no hay lógica de "resetear" salvo la
-- partida nueva que crea die_and_restart_adventure).
--
-- No hace falta tocar die_and_restart_adventure (última versión en
-- 017_die_and_restart_row_lock.sql): su insert es
--   insert into "character" (adventure_run_id) values (v_new_adventure_run_id);
-- sin columnas explícitas, así que la fila nueva de cada partida ya toma el
-- valor por defecto (false) de esta columna sin ningún cambio adicional.

alter table "character"
  add column mission_damage_taken boolean not null default false;
