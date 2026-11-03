-- Migración: 0016_login_branding.sql
-- Propósito (DB-009): la pantalla de inicio de sesión (rol `anon`, sin sesión) debe
-- mostrar el nombre y el logo reales del negocio en lugar de la marca por defecto.
-- Concede SOLO las columnas `name` y `logo_url` de la única fila de
-- `business_settings` (id = 1) al rol `anon`. Sin acceso a id, moneda, preferencias
-- ni a ningún otro dato, y solo a nivel de lectura.
-- Idempotente: GRANT + DROP/CREATE POLICY; no crea tablas ni datos.

-- 1. Permiso a nivel de COLUMNAS: `anon` mantiene el REVOKE de SELECT a nivel de
--    tabla sobre business_settings (0002); con este grant solo puede leer name y
--    logo_url. Cualquier otra columna seguirá dando "permission denied".
grant select (name, logo_url) on public.business_settings to anon;

-- 2. RLS: sin política aplicable al rol `anon`, la fila no es visible aunque exista
--    el grant. Se limita a la fila única del negocio (id = 1).
drop policy if exists business_settings_select_login on public.business_settings;
create policy business_settings_select_login on public.business_settings
  for select
  to anon
  using (id = 1);

-- 3. Verificación esperada (desde el SQL Editor con rol anon, o en la pantalla de
--    login tras aplicar):
--    select name, logo_url from business_settings;   -> 1 fila con nombre y logo
--    select currency_symbol from business_settings;  -> error de permisos
