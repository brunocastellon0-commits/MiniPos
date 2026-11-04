# INCIDENTES.md — Plan de incidentes de LILA MARKET

> **Plantilla viva.** Este documento define qué hacer cuando algo sale mal en un cliente
> (fuga de credenciales, datos alterados, caída, intento de fraude). Alimenta también el
> requisito de "terminado" de seguridad (`docs/SECURITY.md` §11).
>
> **Regla general:** primero se protege al cliente y sus datos; después se diagnostica;
> al final se documenta. Nunca se borran registros para "limpiar" un incidente: el
> `audit_log` y las tablas contables son evidencia.

## 1. Clasificación de severidad

| Nivel | Ejemplos | Plazo de respuesta |
|---|---|---|
| **S1 — Crítico** | Fuga de claves/`service_role`, acceso ajeno a datos de un cliente, dinero alterado (ventas/caja), ransomware/borrado | Inmediato; el humano contacta al cliente el mismo día |
| **S2 — Alto** | Cajero con privilegios de dueño por un fallo, venta cobrada sin descuento de stock, sesión ajena activa | Mismo día |
| **S3 — Medio** | Datos visibles a un rol equivocado en UI sin efecto contable, exportación con datos de más | 48 h |
| **S4 — Bajo** | Error de mensaje, fallo cosmético con impacto de seguridad teórico | Siguiente iteración |

## 2. Respuesta inmediata (en orden)

1. **Revocar accesos:** cerrar sesiones del usuario/PC afectado (Supabase Auth → "Sign out"),
   rotar claves si hay sospecha de fuga (API keys en el gestor de secretos del hosting;
   la app no usa `service_role`).
2. **Aislar:** si el proyecto de un cliente está comprometido, pausar el acceso público
   (URL/entorno) sin borrar datos.
3. **Revisar evidencia:** `audit_log` en el SQL Editor (acciones sensibles últimas 72 h),
   vista **Auditoría** en la app, logs del hosting/Next.
4. **Comunicar al cliente** (niveles S1/S2): qué se sabe, qué se está haciendo, plazo de
   siguiente actualización. Nunca prometer plazos sin verificar.
5. **Contener/estabilizar:** aplicar parche, corregir código con tests, o volver a una
   versión anterior si aplica (con registro del motivo).
6. **Post-mortem** en la §4 de este archivo, sin señalar personas, solo hechos.

## 3. Restauración de datos (respaldos)

- El humano configura los respaldos de Supabase por cliente (plan de Supabase) y
  **prueba la restauración al menos una vez por entrega** (`docs/DEPLOY_NEW_CLIENT.md` →
  Seguridad). Un respaldo sin prueba de restauración no cuenta como respaldo.
- Ante pérdida de datos: restaurar al punto de control más reciente y reconciliar el
  efectivo real contra el cierre de caja posterior; **la diferencia se registra, no se corrige**.
- Frecuencia mínima recomendada de prueba de restauración: trimestral, y siempre antes
  de una entrega grande. Quién lo hace y con qué frecuencia exacta: **decisión del humano**
  (quedaría en `docs/CONDICIONES_COMERCIALES.md` si ese documento existe).

## 4. Registro de incidentes (plantilla — copiar por incidente)

```
### INC-YYYY-NN — <título corto>
- Fecha/hora de detección: <AAAA-MM-DD HH:mm - America/La_Paz>
- Cliente afectado: <cliente o "interno">
- Severidad: S1 | S2 | S3 | S4
- Detectado por: <alerta / humano / cliente / revisión de auditoría>
- Descripción: <qué pasó, sin especular sobre causas todavía>

Acciones inmediatas (§2):
- [ ] Accesos revocados / claves rotadas: <cuál, cuándo>
- [ ] Proyecto aislado: <sí/no>
- [ ] Evidencia revisada: <consultas de audit_log y hallazgos>
- [ ] Cliente comunicado: <cuándo, por quién>

Impacto:
- Ventas/caja afectadas: <ids o "ninguno">
- Datos expuestos: <qué tablas/qué tipo de datos o "ninguno">
- Saldo/efectivo: <si hubo diferencia, su importe y registro>

Causa raíz: <confirmada después del diagnóstico>
Corrección: <cambio aplicado + test que lo cubre + migración si aplica>
Post-mortem: <qué habría evitado el incidente; tarea SEC-xx creada si corresponde>
Estado: ABIERTO | RESUELTO | CERRADO (fecha)
```

## 5. Contactos y roles (rellenar por cliente)

| Rol | Nombre | Contacto | Cuándo se le avisa |
|---|---|---|---|
| Dueño del minimarket (cliente) | <…> | <…> | S1, S2 |
| Responsable técnico LILA MARKET | <…> | <…> | Todos |
| Proveedor de hosting/Supabase | <…> | <soporte> | S1 con datos/caída |

## 6. Después de cada incidente

1. Crear/cerrar tareas `SEC-xx` en `BACKLOG.md` para lo que se deba corregir.
2. Si incluyó datos contables: verificar caja, stock y ventas con el dueño y dejar el
   ajuste (si corresponde) con motivo y auditoría.
3. Revisar este plan: si un paso no funcionó, corregirlo aquí mismo (no en la cabeza de nadie).
