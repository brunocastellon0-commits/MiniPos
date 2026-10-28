---
name: nextjs-conventions
description: Úsala al crear o modificar páginas, layouts, Server Actions, Route Handlers, componentes o configuración de Next.js 16 (App Router) en LILA MARKET. Contiene convenciones y errores comunes a evitar.
---

# nextjs-conventions (Next.js 16, App Router)

> Verifica en https://nextjs.org/docs cualquier API de la que no estés 100 % seguro. Las APIs cambian entre versiones.

## Archivos clave
- `proxy.ts` (raíz o `src/`) reemplaza a `middleware.ts` desde Next 16; exporta función `proxy` y `config.matcher`. Mantenlo delgado: sesión y redirecciones simples. No pongas lógica de negocio ni consultas pesadas.
- `app/**/page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`: crea `loading` y `error` en cada segmento con datos.
- Route groups `(auth)` y `(app)` para separar layouts sin afectar la URL.

## Componentes
- **Server Components por defecto.** `'use client'` solo para estado, efectos, eventos del navegador (carrito, atajos F2/F9, diálogos).
- Lleva el `'use client'` lo más abajo posible del árbol. Pasa datos ya resueltos por props.
- `cookies()`, `headers()`, `params` y `searchParams` son **asíncronos** en versiones recientes: `await` antes de usar.
- Nunca importes módulos de servidor (repos Supabase server, `next/headers`) desde un Client Component.

## Mutaciones: Server Actions
```ts
'use server'
export async function confirmSaleAction(input: unknown): Promise<ActionResult<SaleDTO>> {
  const user = await requireRole(['owner', 'cashier'])   // 1. autenticar/autorizar en servidor
  const parsed = confirmSaleSchema.safeParse(input)       // 2. validar con Zod
  if (!parsed.success) return fail('INVALID_INPUT', 'Revisa los datos de la venta.')
  const res = await salesRepo(user).confirm(parsed.data)  // 3. repositorio (RPC atómica)
  revalidatePath('/caja') ; return res                    // 4. invalidar cache afectada
}
```
- Siempre devuelve `{ ok, ... }`, no lances errores para flujos esperados.
- Tras mutar, `revalidatePath`/`revalidateTag` de lo que cambió (stock, panel, historial).
- No confíes en datos del cliente: **recalcula totales y precios en el servidor/RPC** a partir de ids y cantidades.

## Datos y caché
- Páginas autenticadas son dinámicas: no cachees datos por usuario en caché compartida.
- Evita `fetch` en cadena (waterfalls): `Promise.all` para consultas independientes.
- Paginación en servidor para listas largas (productos, ventas).

## Formularios
- `useActionState`/`useFormStatus` para estados de envío; deshabilita el botón mientras envía; muestra errores por campo en español.

## Errores comunes a evitar
- `middleware.ts` en Next 16 (usar `proxy.ts`). · Usar `useEffect` para cargar datos que podrían cargarse en el servidor. · Olvidar `await cookies()`. · Poner secretos en `NEXT_PUBLIC_*`. · Mezclar lógica de negocio dentro de componentes (va en `lib/domain`). · Usar `<img>` sin dimensiones (usar `next/image` o fijar tamaño).
