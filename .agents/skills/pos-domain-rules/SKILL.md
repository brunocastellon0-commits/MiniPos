---
name: pos-domain-rules
description: Úsala al implementar o modificar ventas, carrito, cobro, caja/turnos, inventario, compras, anulaciones, descuentos o reportes de LILA MARKET. Contiene las reglas de negocio y los cálculos que deben cumplirse siempre.
---

# pos-domain-rules

## Dinero
- Centavos enteros. `total = subtotal - descuento`, nunca negativo. Porcentajes: calcular en centavos y redondear con una única función (`roundHalfUp`) documentada en `lib/money.ts`.
- Formato UI: `Bs 1.234,50` (es-BO). Nunca mostrar floats ni `NaN`.

## Carrito (lógica pura en `lib/domain/cart.ts`)
- Agregar producto existente ⇒ incrementa cantidad. Cantidad mínima 1; llegar a 0 con "−" elimina la línea (o pide confirmar).
- No superar stock disponible salvo `allow_negative_stock` (D-002). Producto agotado ⇒ no agregable, con mensaje.
- El total se recalcula tras **cada** cambio. El precio unitario de la línea se toma al agregar y se **congela** en la venta.
- Pausar ≠ vender: una venta pausada no afecta stock ni caja.

## Confirmar venta (RPC `confirm_sale`, atómica)
Dentro de una sola transacción: verificar turno abierto y rol → bloquear/validar stock → crear `sales` + `sale_items` (nombre y precio congelados) → `stock_movements` (kind `sale`, delta negativo) → actualizar `products.stock_qty` → si efectivo, reflejar en el turno. Idempotencia por `client_request_id` único: repetir devuelve la venta original sin duplicar.
El cliente **no envía precios ni totales confiables**: el servidor recalcula desde `product_id` y `quantity`.
Efectivo: `cash_received_cents >= total`; vuelto = recibido − total.

## Anulación (dueño)
Motivo obligatorio. Estado `voided` + `voided_by/at/reason`. Genera `stock_movements` kind `void_return` (+) y revierte el efecto en caja. No se elimina nada. Idempotente (anular dos veces no duplica la reversa).

## Caja/turno
- Un solo turno abierto a la vez. No se vende sin turno abierto.
- `expected_cash = opening + Σ ventas efectivo (no anuladas) + Σ ingresos − Σ egresos`. QR/tarjeta se reportan aparte y **no** suman al efectivo físico.
- `difference = counted − expected`. Se guarda y muestra (sobrante/faltante con texto e ícono). Nunca se "corrige" automáticamente.
- Un turno cerrado es inmutable y consultable.

## Inventario
- Todo cambio de stock tiene un `stock_movements` con origen y usuario. `stock_qty` = suma de movimientos (la RPC mantiene ambos coherentes).
- Ajuste manual: motivo obligatorio. Merma: motivo (dañado, vencido, robo, otro).
- Estados: `agotado` (0), `bajo` (`<= min_stock`), `ok`. Distintos en texto e ícono.
- Alerta de stock bajo **informa**; no genera compras automáticas.

## Compras
- `qty_ordered` ≠ `qty_received`. Solo `qty_received` confirmada suma stock. Recepción parcial permitida; completar después suma solo la diferencia. Registrar costo unitario; opcionalmente actualizar `cost_cents` del producto.

## Reportes
- Ventas brutas = Σ subtotales de ventas no anuladas; descuentos; neto cobrado = brutas − descuentos. Anuladas se muestran aparte.
- Margen bruto estimado = Σ (precio − costo) × cantidad **solo** de líneas con costo registrado; indicar cuántas líneas quedaron fuera. Prohibido titularlo "ganancia".
- Toda cifra debe poder rastrearse a registros de origen (test que compare reporte vs. suma directa).

## Roles
Cajero: caja, sus ventas, su turno, consultar precio/stock. Dueño: todo lo demás. Ver matriz en `docs/ARCHITECTURE.md` §3 (RLS).
