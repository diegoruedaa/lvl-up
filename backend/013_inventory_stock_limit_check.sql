-- Fase 6 (continuación): límite de stock también a nivel de base de datos.
--
-- inventory_item solo tenía `check (quantity >= 0)` (009_economy_and_items.sql);
-- el límite superior (stackLimit: escape_rope=5, celestial_hand=3,
-- immortality_totem=1) solo vivía en ITEM_CATALOG (rules-engine) y se
-- aplicaba exclusivamente en cliente vía canAddItemToInventory. Eso deja un
-- hueco TOCTOU en purchaseItem, grantRankRewards y resolvePendingRewards
-- (gameApi.ts): entre leer currentQuantity y hacer el upsert, otra pestaña/
-- dispositivo podría incrementar la misma fila y dejar quantity por encima
-- del límite sin que nada lo impida. Este constraint no cambia ningún
-- comportamiento normal (el cliente ya respeta el límite hoy); solo
-- convierte esa corrupción silenciosa en un error explícito
-- (23514 check_violation) si algún día ocurre la carrera.
--
-- Este archivo toca una tabla existente (inventory_item) añadiendo un
-- constraint nuevo, no modifica ni renombra ninguno de los que ya tiene.
-- Aun así, antes de ejecutarlo, confirma que no hay ya un constraint con
-- este nombre (no debería haberlo: es la primera vez que se usa):
--   select conname from pg_constraint where conrelid = 'inventory_item'::regclass and contype = 'c';

-- IMPORTANTE: los valores 5/3/1 de abajo deben mantenerse sincronizados a
-- mano con stackLimit en packages/rules-engine/src/constants.ts (ITEM_CATALOG,
-- entradas de escape_rope/celestial_hand/immortality_totem). Si esos números
-- cambian algún día en rules-engine, hay que actualizar también este
-- constraint con una migración nueva (los check constraints de Postgres no
-- pueden leer una constante de TypeScript).

alter table inventory_item add constraint inventory_item_stock_limit_check
  check (
    case item_id
      when 'escape_rope' then quantity <= 5
      when 'celestial_hand' then quantity <= 3
      when 'immortality_totem' then quantity <= 1
      else true
    end
  );
