# Tareas de mejora – Proyecto Minimarket (Next.js)

> Instrucciones para el agente: ejecuta las tareas en el orden indicado. Primero los **bugs críticos (Parte A)**, porque afectan el uso básico, y luego las **mejoras de diseño/UX (Parte B)**. Antes de modificar, revisa cómo está hecho cada componente actual y respeta el estilo, librerías y convenciones ya existentes en el proyecto (Tailwind, shadcn, etc.). Al terminar cada tarea, verifica que compile (`npm run build` / `tsc`) y que no haya errores de lint.

---

## PARTE A – Bugs y cambios funcionales

### A1. Bug crítico: los inputs solo aceptan UNA letra y pierden el foco

**Síntoma:** al escribir en cualquier input de texto, solo entra un carácter y el campo pierde el foco, como si se hubiera presionado Tab. Hay que hacer clic de nuevo para escribir la siguiente letra.

**Causa probable (revisar en este orden):**

1. **Un componente declarado DENTRO de otro componente** (por ejemplo `const Campo = () => <input .../>` definido dentro del render del formulario o del modal). En cada pulsación el estado cambia, el padre se re-renderiza, React crea un componente "nuevo" y desmonta/monta el input, perdiendo el foco.
2. **Un `key` dinámico** en el input o en su contenedor que cambia con el valor (ej. `key={valor}` o `key={Math.random()}`).
3. **Un wrapper/formulario/modal que se remonta** en cada cambio de estado (ej. condicional que cambia la estructura del árbol, o un componente de layout definido dentro del render).
4. Un `onChange` que dispara navegación, `router.refresh()`, `router.replace` o cambio de URL con cada tecla.
5. Un `useEffect` que hace `focus()`/`blur()` o resetea el estado en cada cambio.

**Qué hacer:**

- Buscar en todo el proyecto componentes definidos dentro de otros componentes que contengan `<input>`, `<textarea>` o `<select>`, y **moverlos fuera** (a nivel de módulo o a su propio archivo), pasándoles los datos por props.
- Eliminar `key` dinámicos innecesarios.
- Revisar los formularios principales (productos, clientes, proveedores, ventas, login, configuración, etc.) y confirmar que se puede escribir texto continuo.
- Si el estado vive en el padre y provoca renders pesados, considerar `react-hook-form` (inputs no controlados) o memoizar los subcomponentes.

**Criterio de aceptación:** en TODOS los inputs del sistema se puede escribir una palabra completa de corrido sin perder el foco.

---

### A2. Rendimiento: la app se "congela" al cambiar de vista

**Síntoma:** cada vez que se cambia de vista/ruta, toda la interfaz se queda trabada un momento y se siente muy lenta.

**Qué revisar y hacer:**

1. **Navegación:** usar `next/link` (`<Link>`) en lugar de `<a>` o `window.location`/`router.push` innecesarios, para aprovechar el prefetch y la navegación del lado del cliente.
2. **Server vs Client Components:** quitar `"use client"` de páginas y componentes que no lo necesiten. Dejar `"use client"` solo en las hojas interactivas (formularios, botones, modales).
3. **Carga de datos:**
   - Evitar `useEffect` + `fetch` en cadena al montar la vista; preferir obtener datos en Server Components o con una librería de cache (TanStack Query / SWR) si ya se usa.
   - Paralelizar peticiones independientes con `Promise.all`.
   - Evitar traer listas completas; paginar o limitar columnas.
4. **Archivos `loading.tsx`:** agregar `loading.tsx` en cada ruta principal (con Skeleton, ver B4) y usar `<Suspense>` para que la navegación responda al instante en lugar de bloquear.
5. **Bundle pesado:** cargar con `next/dynamic` los componentes grandes (gráficos, tablas pesadas, editores, modales con mucho contenido, escáner de códigos, etc.). Revisar imports de librerías enteras (ej. importar solo los íconos usados).
6. **Re-renders:** detectar contextos globales que re-renderizan toda la app, y listas largas sin `key` estable o sin memoización (`React.memo`, `useMemo`, `useCallback` donde aplique).
7. **Imágenes:** usar `next/image` con tamaños definidos.
8. **Probar en producción:** medir con `npm run build && npm start`, porque el modo `dev` siempre es más lento. Reportar qué rutas siguen lentas.

**Criterio de aceptación:** al cambiar de vista la UI responde de inmediato (muestra el skeleton) y no se congela.

---

### A3. Logo: quitar el campo de URL editable y usar una imagen fija en `public/`

**Cambio:** el logo ya NO debe ser configurable por el usuario. Será una imagen estática ubicada en la carpeta `public`.

**Qué hacer:**

- Eliminar el campo/input "URL del logo" de la pantalla de configuración (y su label, validación y estado asociado).
- Eliminar del modelo de datos / base de datos / API / tipos TypeScript el campo `logoUrl` (o como se llame), o al menos dejar de leerlo y escribirlo. Si hay una migración involucrada, crearla.
- Reemplazar todos los usos del logo (sidebar, header, login, tickets/boletas, impresiones, PDF, favicon si aplica) por la imagen estática, por ejemplo `/logo.png`, usando `next/image`:

```tsx
import Image from "next/image";

<Image src="/logo.png" alt="Logo del minimarket" width={160} height={48} priority />
```

- Centralizar la ruta en una constante (ej. `const LOGO_SRC = "/logo.png"`) para no repetirla en muchos archivos.
- Confirmar el nombre y formato real del archivo que está en `public/` y usar ese. Si no existe, avisar y no inventar uno.
- Agregar `alt` descriptivo y evitar que el logo cause layout shift (definir `width` y `height`).

**Criterio de aceptación:** no existe ningún input para cambiar el logo y todas las vistas muestran la imagen de `public/`.

---

## PARTE B – Mejoras de diseño y UX

### B1. Formularios e inputs de texto

#### B1.1 Placeholders usados como etiquetas

- **Problema:** el placeholder desaparece al escribir y el usuario pierde el contexto del campo.
- **Solución:** todos los campos deben tener un `<label>` **siempre visible** (arriba del input, o etiqueta flotante), vinculado con `htmlFor`/`id`. El placeholder solo sirve como ejemplo de formato (ej. "Ej: 70012345"), nunca como único nombre del campo.

```tsx
<div className="space-y-1.5">
  <label htmlFor="nombre" className="text-sm font-medium">Nombre del producto</label>
  <input id="nombre" placeholder="Ej: Arroz Grano de Oro 1 kg" ... />
  <p id="nombre-ayuda" className="text-xs text-muted-foreground">Máximo 60 caracteres.</p>
</div>
```

- Aplicar en TODOS los formularios del sistema. Crear (o reutilizar) un componente `FormField` común para no repetir código.

#### B1.2 Campos de nombre ambiguos

- Cuando se pida el apellido, **desglosar los campos**:
  - "Apellido paterno"
  - "Apellido materno (opcional)"
- Revisar formularios de clientes, proveedores, empleados/usuarios, y ajustar la base de datos / tipos / API si es necesario (con migración).
- Marcar claramente los campos opcionales con "(opcional)" en la etiqueta.

#### B1.3 Retroalimentación y validación

- Mostrar el error **debajo del campo afectado** (no como toast flotante genérico), en texto claro y con `aria-describedby` / `aria-invalid`.
- Agregar **microcopia de ayuda** con el formato esperado antes de que el usuario se equivoque (ej. "Solo números, 8 dígitos", "Formato: dd/mm/aaaa", "Mínimo 6 caracteres").
- Mensajes de error específicos y accionables:
  - Mal: "Campo inválido".
  - Bien: "El precio debe ser un número mayor a 0. Ejemplo: 12.50".
- Validar al salir del campo (`onBlur`) y al enviar; no mostrar errores mientras el usuario aún está escribiendo por primera vez.
- Si se usa `zod`/`react-hook-form`, centralizar los mensajes en el esquema.

---

### B2. Botones de acción (checkout / pagos / transacciones)

#### B2.1 Estado de carga inmediato

Al presionar "Pagar" (y otros botones críticos: guardar venta, registrar compra, confirmar pedido):

1. El botón pasa **al instante** a `disabled` y muestra "Procesando pago..." con un spinner pequeño.
2. Al terminar con éxito, mostrar confirmación visual clara: "Pago completado" (con ícono de check) y luego continuar el flujo (imprimir ticket, limpiar carrito, etc.).
3. Si falla, restaurar el botón, mostrar el error con claridad y permitir reintentar.

#### B2.2 Evitar cobros/registros duplicados

- Bloquear nuevas interacciones desde el primer clic hasta que la API responda (estado `isSubmitting`/`isPending`, ej. con `useTransition` o `useMutation`).
- Proteger también contra doble envío con **Enter** en el formulario y doble clic rápido (usar un `useRef` como candado además del estado, porque el estado puede tardar en reflejarse).
- Del lado del servidor: usar una **clave de idempotencia** (ej. `idempotencyKey` generado al abrir el checkout) para que, aunque llegue dos veces la petición, se registre una sola venta/cobro.
- Aplicar el mismo patrón a todas las acciones que crean registros (ventas, compras, movimientos de caja, ajustes de stock).

Ejemplo base:

```tsx
const [estado, setEstado] = useState<"idle" | "loading" | "success" | "error">("idle");
const enviando = useRef(false);

async function pagar() {
  if (enviando.current) return;
  enviando.current = true;
  setEstado("loading");
  try {
    await procesarPago();
    setEstado("success");
  } catch {
    setEstado("error");
  } finally {
    enviando.current = false;
  }
}

<button disabled={estado === "loading" || estado === "success"} onClick={pagar}>
  {estado === "loading" && "Procesando pago..."}
  {estado === "success" && "Pago completado"}
  {(estado === "idle" || estado === "error") && "Pagar"}
</button>
```

---

### B3. Agrupamiento visual en tablas y métricas

#### B3.1 Reducir bordes y rejillas

- Quitar cuadrículas completas y bordes en cada celda/tarjeta cuando hay pocos datos (dashboard, resúmenes, métricas).
- **Ley de proximidad (Gestalt):** agrupar etiqueta y valor con poco espacio entre ellos y separar los grupos distintos con más espacio en blanco, sin depender de líneas.
- En tablas: dejar como máximo una línea sutil entre filas (o ninguna, usando hover/zebra muy suave), sin bordes verticales, encabezados con peso tipográfico en vez de cajas.

#### B3.2 Barras comparativas en métricas

- En el dashboard, reemplazar las cajas rígidas con borde por métricas con **una barra fina de progreso/comparación debajo del valor** (ej. ventas por categoría, productos más vendidos, stock vs. stock mínimo).
- Las barras deben ser sutiles (altura 4–6 px, esquinas redondeadas, color suave) y proporcionales al valor máximo del conjunto.
- Incluir texto accesible (valor numérico visible; no depender solo del color).

---

### B4. Estados de carga: Skeleton Screens en lugar de spinners

- **Problema:** un spinner centrado sobre una pantalla vacía genera incertidumbre y provoca saltos de diseño (layout shift) cuando aparece el contenido.
- **Solución:** reemplazar los spinners de página completa por **Skeletons** que imiten la forma del contenido final (tarjetas de métricas, filas de tabla, formularios, listas de productos).
- Implementación en Next.js:
  - Crear `loading.tsx` por ruta con el skeleton de esa vista.
  - Usar `<Suspense fallback={<SkeletonX />}>` para las secciones que cargan datos.
  - Mantener las **mismas dimensiones** que el contenido real para evitar layout shift.
  - Usar una animación suave (`animate-pulse`) y respetar `prefers-reduced-motion`.
- Dejar el spinner pequeño solo dentro de botones (ver B2) o acciones puntuales.

---

## Orden sugerido de ejecución

1. A1 – Inputs que pierden el foco (bloqueante).
2. A2 – Rendimiento al cambiar de vista (junto con B4: `loading.tsx` + skeletons).
3. A3 – Logo estático desde `public/`.
4. B1 – Formularios (labels, apellidos, validación) con un `FormField` reutilizable.
5. B2 – Botones de pago con estados y protección contra duplicados.
6. B3 – Tablas y métricas más limpias.

## Reglas generales para el agente

- No romper funcionalidades existentes; hacer cambios pequeños y verificables.
- Reutilizar componentes (FormField, Skeletons, BotónConEstado) en lugar de duplicar código.
- Mantener accesibilidad: labels asociados, `aria-*`, contraste suficiente, foco visible, navegación por teclado.
- Si algo del plan choca con la estructura real del proyecto, explicar el conflicto y proponer la alternativa antes de aplicar cambios grandes.
- Al final, entregar un resumen de qué archivos se modificaron y qué quedó pendiente.