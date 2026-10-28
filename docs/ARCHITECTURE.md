# ARCHITECTURE.md

## 1. Modelo de despliegue (decisión D-001, ver BACKLOG.md)

**Una instalación por cliente (single-tenant):** cada minimarket tiene **su propio proyecto Supabase** y su propio despliegue
del mismo código. No hay `tenant_id` en las tablas.

Ventajas para un producto de pago único accesible: datos aislados por cliente, sin riesgo de fuga cruzada, RLS más simple,
cada cliente se entrega con un SQL consolidado + variables de entorno. Se personaliza solo con `business_settings`.
Consideración: los proyectos del plan gratuito de Supabase pueden pausarse por inactividad; para clientes reales hay que definir plan y
condiciones (ver `docs/DEPLOY_NEW_CLIENT.md`).

## 2. Estructura de carpetas

```
/
├─ AGENTS.md  BACKLOG.md  DB_REQUESTS.md
├─ .agents/skills/*/SKILL.md   # guías para agentes de IA (neutrales)
├─ db/
│  ├─ migrations/          # SQL numerado. Lo aplica el HUMANO
│  └─ schema.sql           # esquema consolidado para clientes nuevos (se regenera desde migraciones)
├─ docs/
├─ e2e/                    # Playwright (lo corre el humano)
├─ proxy.ts                # refresca sesión (Next 16). Delgado: delega en src/lib/supabase/proxy.ts
└─ src/
   ├─ app/
   │  ├─ (auth)/login/
   │  ├─ (app)/            # layout autenticado con navegación por rol
   │  │  ├─ caja/          # POS (cajero y dueño)
   │  │  ├─ ventas/        # historial
   │  │  ├─ turno/         # apertura/cierre de caja
   │  │  ├─ panel/         # dashboard dueño
   │  │  ├─ productos/  inventario/  compras/  reportes/  configuracion/  usuarios/
   │  └─ api/              # Route Handlers solo si Server Actions no bastan
   ├─ components/ui/       # primitivas (Button, Input, Badge, Dialog, EmptyState...)
   ├─ components/<modulo>/ # componentes por módulo
   ├─ lib/
   │  ├─ domain/           # lógica PURA (sin React/Next/Supabase)
   │  ├─ repos/            # interfaces + supabase/ + memory/
   │  ├─ supabase/         # client.ts, server.ts, proxy.ts
   │  ├─ auth/             # getCurrentUser, requireRole
   │  ├─ money.ts          # centavos <-> "Bs 46,50"
   │  └─ validation/       # esquemas Zod
   └─ types/database.ts    # tipos de BD escritos a mano según migraciones
```

## 3. Modelo de datos objetivo (referencia para migraciones)

Dinero en **centavos enteros** (`*_cents bigint`). Timestamps `timestamptz` (UTC); mostrar en `America/La_Paz`.

| Tabla | Campos clave |
|---|---|
| `business_settings` (1 fila) | name, legal_name, currency_code='BOB', currency_symbol='Bs', logo_url, allow_negative_stock=false, low_stock_default |
| `profiles` | id (= auth.users.id), full_name, role (`owner`\|`cashier`), active |
| `categories` | id, name, sort_order, active |
| `products` | id, name, barcode (unique, nullable), internal_code, category_id, unit_label, price_cents, cost_cents (nullable), stock_qty, min_stock, active |
| `suppliers` | id, name, phone, notes, active |
| `cash_sessions` | id, opened_by, opened_at, opening_cents, closed_by, closed_at, expected_cash_cents, counted_cash_cents, difference_cents, status (`open`\|`closed`), notes. **Máximo una abierta** (índice único parcial) |
| `cash_movements` | id, session_id, kind (`in`\|`out`), amount_cents, reason, user_id, created_at |
| `sales` | id, number (secuencial), session_id, cashier_id, status (`paid`\|`voided`), subtotal_cents, discount_cents, total_cents, payment_method (`cash`\|`qr`\|`card`), cash_received_cents, client_request_id (**unique**, idempotencia), voided_by, voided_at, void_reason, created_at |
| `sale_items` | id, sale_id, product_id, name_snapshot, unit_price_cents, quantity, line_total_cents |
| `held_sales` | id, cashier_id, label, items (jsonb), created_at |
| `stock_movements` | id, product_id, kind (`sale`\|`purchase`\|`adjustment`\|`waste`\|`void_return`), delta, reason, ref_type, ref_id, user_id, created_at |
| `purchases` | id, supplier_id, status (`draft`\|`ordered`\|`partial`\|`received`\|`cancelled`), notes, total_cents, created_by, created_at |
| `purchase_items` | id, purchase_id, product_id, qty_ordered, qty_received, unit_cost_cents |
| `audit_log` | id, at, user_id, action, entity, entity_id, summary (jsonb), reason. **Solo INSERT** (sin update/delete para roles de la app) |

**Funciones RPC (atómicas, `security definer` con chequeo de rol y `search_path` fijo):**
`confirm_sale(client_request_id, items, payment_method, discount_cents, cash_received_cents)`,
`void_sale(sale_id, reason)`, `open_cash_session(opening_cents)`, `close_cash_session(session_id, counted_cents, notes)`,
`add_cash_movement(...)`, `receive_purchase(purchase_id, received_items)`, `adjust_stock(product_id, delta, kind, reason)`.

**Seguridad de BD:** ver `docs/SECURITY.md` §4 (RLS + GRANT explícito + `security definer` seguro + inmutabilidad + auditoría). Helpers de permisos en esquema `private` (no expuesto).

**RLS:** activada en TODAS las tablas. Reglas: `owner` todo; `cashier` lee productos activos y categorías, crea ventas solo vía RPC,
lee sus propias ventas y el turno abierto; sin acceso a costos, reportes, `profiles` ajenos, `suppliers`, `purchases` ni
`business_settings` (salvo nombre/logo). `cost_cents` no se expone al cajero: usar una vista `products_pos` sin costo para el POS.

## 4. Flujo de datos

```
Componente (UI) → Server Action (Zod + requireRole) → Repositorio (interfaz) → Supabase (RPC/tablas con RLS)
                                          └─ lógica pura en lib/domain (testeada sin BD)
```

## 5. Autenticación

- Email + contraseña. Usuarios creados por el dueño; no hay registro público.
- `proxy.ts` refresca el token con `supabase.auth.getClaims()`; los Server Components solo leen la sesión.
- En acciones que escriben: validar usuario con `supabase.auth.getUser()` y rol desde `profiles`.
- Redirecciones: sin sesión → `/login`; cajero → `/caja`; dueño → `/panel`; rutas de dueño inaccesibles al cajero (proxy + layout + RLS).
- Crear usuarios requiere privilegios de administración de Auth: **el agente no usa service_role**. Ver tarea E1-04 (el flujo lo define el humano: alta manual en el Dashboard + asignación de rol, o una Edge Function que el humano despliega).

## 6. Variables de entorno (solo `.env.example` en el repo)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```
Prohibido `NEXT_PUBLIC_` en cualquier secreto. La app no necesita `service_role` en el navegador ni en el repo.

## 7. Errores

- Las Server Actions devuelven `{ ok: true, data } | { ok: false, code, message }` (mensaje en español para el usuario).
- Errores inesperados: registrar en servidor sin datos sensibles. Nunca mostrar errores crudos de Postgres al usuario.
