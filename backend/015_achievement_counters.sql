-- Fase 7, Tanda 2: contadores acumulados para los logros de contador
-- (documento 14.3 misiones, 14.5 bosses, 14.9 objetos/mercado, 14.10
-- monedas). Viven en "character" porque son 1:1 con la adventure_run, igual
-- que level/current_xp/current_hp/coins.
--
-- Solo suman, nunca bajan (ni al gastar monedas, ni al perder un objeto de
-- mochila, ni al fallar una misión): coins_earned_total en particular es
-- distinto de coins (saldo actual, que sí baja al comprar), y se usa para
-- 'coins_earned_50_total'/'coins_earned_500_total'; coins ya existente
-- (009_economy_and_items.sql) sigue siendo la base de 'coins_held_100'/'250'.
--
-- No hace falta tocar die_and_restart_adventure (última versión en
-- 014_achievements.sql): el insert de esa función es
--   insert into "character" (adventure_run_id) values (v_new_adventure_run_id);
-- y no lista columnas explícitas, así que la fila nueva ya toma el valor por
-- defecto (0) de estas cinco columnas nuevas sin ningún cambio adicional.

alter table "character"
  add column missions_completed_count int not null default 0 check (missions_completed_count >= 0),
  add column bosses_won_count int not null default 0 check (bosses_won_count >= 0),
  add column potions_used_count int not null default 0 check (potions_used_count >= 0),
  add column market_purchases_count int not null default 0 check (market_purchases_count >= 0),
  add column coins_earned_total int not null default 0 check (coins_earned_total >= 0);
