-- Fase 10 (borrador): selección de personaje jugable (chico/chica).
--
-- Igual que tutorial_reward_claimed (020_tutorial.sql), player_character es
-- un dato de CUENTA, no de partida: vive en user_profile porque esa tabla
-- nunca cuelga de adventure_run_id y por tanto die_and_restart_adventure
-- (017_die_and_restart_row_lock.sql) no la toca. Elegir personaje una vez no
-- debe repetirse tras morir.
--
-- Sin default: null es el propio sentinel de "el usuario aún no ha elegido"
-- que usa el frontend para decidir si auto-abre el selector (mismo papel que
-- justCreated cumple para el Tutorial, pero aquí no hace falta un flag
-- aparte — el valor mismo de la columna ya lo es). Un default como 'chico'
-- obligaría a inventar una columna extra solo para distinguir "eligió
-- explícitamente chico" de "nunca ha elegido", lo cual es justo la
-- complejidad que el sentinel null evita.

alter table user_profile
  add column player_character text
    check (player_character in ('chico', 'chica'));

comment on column user_profile.player_character is
  'Personaje jugable elegido por el usuario (chico/chica). null = aún no ha elegido; dispara el selector en el próximo login (ver Dashboard.tsx).';
