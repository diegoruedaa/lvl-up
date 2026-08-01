-- Rutinas: días específicos de la semana + fecha de fin opcional.
--
-- days_of_week: array de enteros ISO (1=Lunes..7=Domingo) con los días en
-- que la rutina genera/revisa ocurrencia. NULL = todos los días — el mismo
-- comportamiento que ya tienen hoy todas las rutinas, así que las filas
-- existentes no necesitan backfill: ADD COLUMN sin default deja NULL en
-- todas ellas automáticamente.
--
-- end_date: último día (inclusive) en que la rutina genera/revisa
-- ocurrencia. NULL = sin fecha de fin (comportamiento actual). Mismo
-- razonamiento: cero migración de datos necesaria.
--
-- Ambas columnas solo tienen sentido para type = 'routine'; el check de
-- abajo lo deja explícito en el esquema en vez de confiar solo en la UI.

alter table mission add column days_of_week smallint[] null;
alter table mission add column end_date date null;

alter table mission add constraint mission_routine_fields_check
  check (type = 'routine' or (days_of_week is null and end_date is null));
