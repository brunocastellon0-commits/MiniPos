---
name: new-client-delivery
description: Úsala al tocar configuración por cliente, esquema consolidado, seeds, importación de productos, documentación de entrega, manual de usuario, capacitación o condiciones comerciales; asegura que LILA MARKET se pueda vender y desplegar una y otra vez.
---

# new-client-delivery — Producto repetible

## Principios
1. **Un solo código para todos los clientes.** Nada de forks. Diferencias = datos en `business_settings` y variables de entorno.
2. Cero hardcode de cliente: nombre, logo, moneda, textos de comprobante, umbrales.
3. **Migraciones inmutables.** Un cliente entregado se actualiza aplicando migraciones nuevas en orden. Mantén `db/schema.sql` = resultado de aplicar todas las migraciones desde cero, y compruébalo (comparar manualmente la lista de objetos; el humano lo valida en un proyecto vacío).
4. Entrega rápida: onboarding guiado (E10-03) + importación CSV (E2-03) + checklist de `docs/DEPLOY_NEW_CLIENT.md`.
5. Toda pantalla debe funcionar con un negocio recién creado (sin productos, sin ventas): estados vacíos útiles.
6. Datos demo solo en `db/seed_demo.sql` (opcional, el humano lo ejecuta); nunca mezclados con el esquema.

## Documentos que mantienes
`docs/DEPLOY_NEW_CLIENT.md`, `docs/MANUAL_USUARIO.md`, `docs/GUIA_CAPACITACION.md`, `docs/CONDICIONES_COMERCIALES.md` (**borrador**; las decisiones comerciales las toma el humano), `CHANGELOG.md`, `docs/plantilla_productos.csv`.

## Lenguaje comercial honesto (plan §6.3 y §17)
No documentes como incluido nada que no exista (soporte ilimitado, facturación electrónica, integraciones de pago, app móvil). Si una función es parcial, dilo en el manual.

## Al publicar una versión
Actualizar `CHANGELOG.md` con: cambios para usuarios, **migraciones nuevas necesarias para clientes existentes** (IDs `DB-xxx`), y pasos manuales. Etiqueta `vX.Y.Z` la crea el humano.
