-- RLS_VERIFICATION.sql — SOLO LECTURA. Lo ejecuta el HUMANO en el SQL Editor tras aplicar migraciones.
-- Pega los resultados al agente. Cualquier fila devuelta en las consultas 1-4 es un hallazgo a corregir.
-- (Consultas de nuestro diseño; contrástalas con el Security Advisor de Supabase.)

-- 1) Tablas de public SIN RLS activada
select schemaname, tablename from pg_tables
where schemaname = 'public' and not rowsecurity;

-- 2) Tablas con RLS pero SIN ninguna política
select c.relname as tabla
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename = c.relname);

-- 3) Privilegios concedidos a anon en public (esperado: ninguno)
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon';

-- 4) Funciones SECURITY DEFINER en public sin search_path fijado
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%');

-- 5) Quién puede ejecutar funciones de public (revisar que anon/PUBLIC no esté en funciones sensibles)
select p.proname, pg_get_userbyid(a.grantee) as rol, a.privilege_type
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
where n.nspname = 'public' and a.privilege_type = 'EXECUTE'
order by p.proname;

-- 6) Grants a authenticated por tabla (revisar que solo existan los necesarios)
select table_name, string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'authenticated'
group by table_name order by table_name;
