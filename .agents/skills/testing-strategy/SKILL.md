---
name: testing-strategy
description: Úsala al escribir o revisar pruebas, al cerrar una tarea o cuando pnpm check falle. Define qué probar, cómo usar repositorios en memoria, qué corre el agente y qué corre el humano.
---

# testing-strategy (ver `docs/TESTING.md` para la matriz completa)

## Qué corres tú
`pnpm test` (Vitest) y `pnpm check`. **No** puedes correr `pnpm test:db` ni `pnpm test:e2e` (requieren Supabase real): escribe los tests y deja el comando para el humano.

## Cómo escribir buenos tests
- Nombra por comportamiento: `it('no descuenta stock dos veces si se reintenta la misma venta')`.
- Estructura Arrange-Act-Assert; factories de `src/test/factories.ts`; reloj e ids inyectados.
- Prueba **invariantes y bordes**: cantidad 0, stock exacto, descuento mayor al subtotal, doble envío, rol equivocado, turno cerrado, centavos con redondeo.
- Prueba **fallos**: si el repo lanza a mitad de `confirm`, el estado en memoria queda intacto (la implementación en memoria debe simular atomicidad con copia/rollback).
- Componentes: Testing Library por rol/etiqueta accesible (`getByRole`), no por clases CSS. Simula teclado (F2, F9, Enter).
- Un test que no puede fallar no sirve: verifica que falla antes de implementar (rojo → verde).

## Repositorios en memoria
Misma interfaz que Supabase; semántica equivalente (unicidad de barcode, `client_request_id`, un turno abierto, RLS simulada por rol). La **suite de contrato** corre contra ambos; si divergen, el bug está en uno de los dos.

## Cuando `pnpm check` falla
1. Lee el primer error (los demás suelen derivar). 2. Reproduce con el comando mínimo (`pnpm vitest run ruta`). 3. Arregla la causa. 4. Repite `pnpm check` completo. Nunca `.skip`, `// @ts-ignore`, ni bajar umbrales.

## Antes de marcar DONE
Cada criterio de aceptación ↔ al menos un test. Escribe en `Evidencia:` los nombres de tests. Si algo solo lo prueba el humano: `DONE-PENDING-HUMAN-VERIFY` + comando.
