# TESTING.md — Estrategia de pruebas

Objetivo: que **nada quede sin verificar**, aunque el agente no pueda tocar la BD real.

## Pirámide

| Nivel | Herramienta | Quién ejecuta | Qué cubre |
|---|---|---|---|
| 1. Unit (dominio) | Vitest | Agente (`pnpm test`) | `lib/domain`: totales, descuentos, cantidades, efectivo esperado, stock bajo, formateo de dinero, validaciones Zod |
| 2. Integración (acciones + repos en memoria) | Vitest | Agente | Server Actions y flujos completos usando `repos/memory`: vender → stock baja → caja sube; anular → reversa; recibir compra → stock sube; permisos por rol; idempotencia |
| 3. Componentes | Vitest + Testing Library | Agente | Carrito (agregar, +/-, eliminar, vaciar), búsqueda, estados vacío/agotado/error, accesibilidad básica, atajos F2/F9 |
| 4. Contrato de repositorio | Vitest | Agente (memoria) y **humano** (Supabase) | Una misma suite (`repos/contract.test.ts`) corre contra la implementación en memoria y, con `pnpm test:db`, contra Supabase de pruebas |
| 5. E2E | Playwright | **Solo el humano** (`pnpm test:e2e`) | Recorridos reales con un proyecto Supabase de PRUEBAS (nunca el de un cliente) |
| 6. Estático | tsc, eslint, build | Agente (`pnpm check`) | Tipos, lint, compilación |

El agente **no puede** ejecutar los niveles 4-Supabase ni 5. Cuando una tarea los necesite, escribe los tests, los deja listos y reporta:
`NO VERIFICADO — requiere ejecución del humano: pnpm test:e2e -g "<nombre>"`. La tarea se marca `DONE-PENDING-HUMAN-VERIFY` hasta que el humano confirme.

## Pruebas de seguridad

Matriz completa en `docs/SECURITY.md` §9 (`src/**/security/*.test.ts`). Son parte de `pnpm test`; el script `pnpm check:security` agrega `pnpm audit` y el escaneo de secretos. Un test de seguridad que falla **nunca** se relaja: se corrige el control.

## Reglas

1. Todo bug corregido añade primero un test que lo reproduce.
2. Prohibido borrar, saltar (`.skip`, `.only`) o debilitar un test para que pase. Si un test es incorrecto, justificarlo en el commit.
3. Los tests no dependen del reloj ni del azar: inyectar `now()` e ids.
4. Datos de prueba mediante *factories* en `src/test/factories.ts` (productos, usuarios, ventas). Nada de datos de clientes reales.
5. Cobertura mínima: `lib/domain` ≥ 95 % líneas y ramas; acciones ≥ 85 %. Se mide con `pnpm test --coverage`.
6. Un test por cada invariante de `AGENTS.md` §7 (ver matriz).

## Matriz de invariantes → tests obligatorios

| Invariante | Test (archivo sugerido) |
|---|---|
| Venta atómica (venta+ítems+stock+caja) | `sales/confirm-sale.int.test.ts` (incluye fallo a mitad: no queda nada a medias) |
| Venta fallida no aparece cobrada | `sales/confirm-sale-failure.int.test.ts` |
| Idempotencia (doble clic / reintento) | `sales/idempotency.int.test.ts` (mismo `client_request_id` ⇒ una sola venta, stock descontado una vez) |
| Anulación con reversa y trazabilidad | `sales/void-sale.int.test.ts` |
| Stock solo sube por recepción confirmada | `purchases/receive.int.test.ts` (pedido ≠ recibido; recepción parcial) |
| Efectivo esperado solo con efectivo | `cash/expected-cash.unit.test.ts` (mezcla efectivo/QR/tarjeta, ingresos/egresos) |
| Diferencia de caja se conserva | `cash/close-session.int.test.ts` |
| Cajero sin acceso a lo del dueño | `auth/roles.int.test.ts` + E2E |
| Una sola caja abierta | `cash/open-session.int.test.ts` |
| Venta sin stock suficiente según configuración | `sales/insufficient-stock.int.test.ts` |
| Dinero sin errores de float | `money.unit.test.ts` (0,1+0,2; redondeos; descuentos) |

## E2E obligatorios (Playwright; los ejecuta el humano)

1. Login cajero → abrir turno → vender 3 productos → quitar uno → cobrar efectivo → stock actualizado.
2. Pausar venta → atender otra → recuperar la pausada.
3. Cobro con QR y tarjeta; cierre de caja: el efectivo esperado ignora QR/tarjeta.
4. Dueño: ver panel, alerta de stock bajo → abrir detalle → registrar compra → recibir → stock sube.
5. Anular venta como dueño; el cajero no puede.
6. Cajero intenta abrir `/reportes`, `/usuarios`, `/configuracion` → redirigido/denegado.
7. Cierre con diferencia: se muestra y queda registrada.

## Scripts esperados en package.json

```
"typecheck": "tsc --noEmit",
"lint": "eslint .",
"test": "vitest run",
"check:security": "pnpm audit --audit-level=high && vitest run security",
"test:db": "vitest run --config vitest.db.config.ts",   // humano
"test:e2e": "playwright test",                            // humano
"check": "pnpm typecheck && pnpm lint && pnpm test && pnpm check:security && pnpm build"
```
