---
title: "Evolución del layout principal: de Grid a Flex y mejora del TOC"
description: "Descripción detallada de la evolución del layout principal de `nanobook`, incluyendo cambios en la estructura y funcionalidades."
date: 2026-08-03
author: "Nanobook"
tags: ["estructura", "table-of-contents", "scroll-spy", "astro", "frontend"]
draft: false
index: false
---

# Evolución del layout principal: de Grid a Flex y mejora del TOC

## 1. Introducción

La página principal de `nanobook` se compone de tres elementos fundamentales:

1. **SidebarNav** (barra lateral izquierda): navegación contextual del directorio actual.
2. **Main content** (contenido central): el artículo o índice propiamente dicho.
3. **TableOfContents** (panel derecho): mapa de encabezados de la página actual.

En las últimas iteraciones, la arquitectura de estos tres componentes cambió de un enfoque basado en **CSS Grid** a uno basado en **Flexbox**, y el TOC pasó de ser una simple lista de enlaces a un componente interactivo con dos modos de visualización. Este documento describe esos cambios, el porqué de las reglas de Flex que los hacen posibles y cómo se mejoró la experiencia del TOC.

---

## 2. Layout anterior: Grid de tres columnas

El layout anterior en `Layout.astro` usaba una rejilla fija:

```astro
<div class="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-12 md:grid-cols-[16rem_1fr_16rem]">
  {sidebarEntries && <SidebarNav ... />}
  <main class="border-x border-[var(--grid-line)] px-6">
    ...
  </main>
  {headings && <TableOfContents ... />}
</div>
```

### Características

- En escritorio se reservaban **16 rem** para la barra lateral, **1 fr** para el contenido y **16 rem** para el TOC.
- En móvil se colapsaba a una sola columna (`grid-cols-1`).

### Limitaciones

1. **Rigidez dimensional**: las columnas laterales tenían un ancho fijo de `16rem`. Si en alguna página no había `sidebarEntries` o `headings`, la cuadrícula seguía reservando ese espacio, dejando huecos o forzando a que los componentes llenaran celdas vacías.
2. **Condicionalidad incómoda**: cuando un componente no se renderizaba, Grid seguía generando la celda correspondiente. Había que compensar con clases condicionales o dejar que el contenido quedara desbalanceado.
3. **Sidebar en móvil**: el `SidebarNav` usaba `fixed` para el panel móvil, lo que lo sacaba del flujo normal y complicaba la alineación con el resto del layout.
4. **TOC estático**: el TOC solo ofrecía una lista de enlaces; no había una versión reducida o un indicador visual de progreso de lectura.

---

## 3. Layout actual: Flexbox

El nuevo layout utiliza Flexbox:

```astro
<div class="z-10 mx-auto flex max-w-6xl gap-6 px-6 py-12">
  {sidebarEntries && <SidebarNav ... />}
  <main class="border-x border-[var(--grid-line)] px-6 flex-1 min-w-0">
    ...
  </main>
  {headings && <TableOfContents ... />}
</div>
```

### Ventajas principales

1. **Columnas condicionales sin huecos**: si no hay entradas para el sidebar o no hay encabezados para el TOC, esos elementos simplemente no se renderizan. El contenido central, gracias a `flex-1`, ocupa todo el espacio disponible sin dejar columnas vacías.
2. **Anchos adaptativos**: los componentes laterales controlan su propio ancho (`max-w-64`, `width: 18rem`, etc.), mientras que el contenido central crece para llenar el espacio restante.
3. **Flujo coherente en móvil**: en pantallas pequeñas, los elementos se apilan o se muestran como paneles superpuestos sin romper la estructura de contenedor principal.

---

## 4. Reglas de Flex clave para el comportamiento esperado

### 4.1 `flex-shrink-0` en los componentes laterales

Tanto `SidebarNav` como `TableOfContents` declaran `flex-shrink-0` (directamente o a través de sus contenedores).

```astro
<!-- SidebarNav -->
<aside class="sticky flex-shrink-0 max-w-64 ...">

<!-- TableOfContents -->
<div class="h-[calc(100vh-10rem)] sticky top-32 flex-shrink-0">
```

**Por qué importa**: sin `flex-shrink-0`, Flexbox puede encoger esos elementos cuando el contenido central necesita más espacio. Esto haría que el sidebar o el TOC se volvieran demasiado estrechos o incluso invisibles. Con `flex-shrink-0`, sus anchos mínimos se respetan.

### 4.2 `flex-1` y `min-w-0` en el contenido principal

```astro
<main class="border-x border-[var(--grid-line)] px-6 flex-1 min-w-0">
```

- **`flex-1`**: le dice al `main` que ocupe todo el espacio restante del contenedor flex.
- **`min-w-0`**: es crítico. Por defecto, un flex item no puede ser más estrecho que su contenido natural (`min-width: auto`). Si el contenido principal incluye bloques de código, tablas o palabras largas, el `main` forzaría al layout a crecer más allá del viewport, provocando scroll horizontal. `min-w-0` permite que el `main` se encoja y respete los límites del contenedor.

### 4.3 `sticky` en lugar de `fixed` para la barra lateral y el TOC

- **`fixed`** saca al elemento del flujo normal y lo posiciona respecto al viewport. Eso obliga a calcular manualmente márgenes y z-index, y puede tapar otros elementos.
- **`sticky`** mantiene al elemento en el flujo del documento pero lo "pega" al viewport cuando se alcanza su punto de anclaje (`top-32`). Así, el layout respeta su ancho y posición natural, y no es necesario reservar espacio artificialmente.

### 4.4 `max-w-64` y `max-w-6xl`

- `max-w-64` en el sidebar limita su ancho máximo para que no desproporcione el layout.
- `max-w-6xl` en el contenedor principal evita que la fila de tres componentes se extienda demasiado en pantallas muy grandes, manteniendo la legibilidad.

---

## 5. Evolución del TableOfContents (TOC)

### 5.1 Estado anterior

El TOC era simplemente una lista de enlaces dentro de un `nav` sticky:

```astro
<nav class="toc-nav hidden md:block" aria-label="En esta página">
  <div class="sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto border border-[var(--grid-line-strong)] bg-[var(--layer-1)] p-4">
    <ul ...>
      <li ...><a href="#slug">...</a></li>
    </ul>
  </div>
</nav>
```

### 5.2 Estado actual: TOC dual

Ahora el TOC está envuelto en un contenedor con dos modos controlados por `data-toc-mode`:

- **Modo `standard`**: lista completa de encabezados, igual que antes.
- **Modo `compact`**: indicador visual reducido compuesto por pequeñas líneas horizontales que representan la posición de cada encabezado en el documento.

```astro
<div class="h-[calc(100vh-10rem)] sticky top-32 flex-shrink-0">
  <div class="toc-root md:block" data-toc-mode="standard">
    <div class="toc-indicator" aria-hidden="true">
      {headings.map((heading) => <div class="toc-indicator-line" data-slug={heading.slug} />)}
    </div>

    <nav class="toc-nav" aria-label="En esta página">
      ...
    </nav>
  </div>
</div>
```

El cambio de modo se controla desde el header mediante un botón y se persiste en `localStorage`:

```js
const saved = localStorage.getItem("toc-mode");
const mode = saved === "compact" ? "compact" : "standard";
root.setAttribute("data-toc-mode", mode);
```

### 5.3 Mejora de la experiencia

1. **Progreso visual compacto**: en modo compacto, el usuario ve de un vistazo dónde está y cuánto le queda por leer.
2. **Acceso rápido al menú**: al pasar el mouse o enfocar el indicador, aparece el menú completo (`:hover` / `:focus-within`).
3. **Persistencia**: el modo elegido se guarda entre navegaciones.
4. **Accesibilidad**: se actualizan atributos como `aria-pressed` y `aria-label` en el botón de cambio de modo.

### 5.4 Posicionamiento correcto de las líneas indicadoras

Inicialmente se intentó posicionar las líneas usando `margin` porcentual:

```js
line.style.margin = `${percent}%`;
```

Esto fue incorrecto porque **CSS resuelve los márgenes verticales en porcentaje contra el ancho del contenedor**, no contra su alto. La solución fue usar `position: absolute` con `top: X%`:

```css
.toc-indicator {
  position: relative;
  height: 100%;
}

.toc-indicator-line {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
}
```

```js
line.style.top = `${percent}%`;
```

Así, `top: X%` se resuelve correctamente contra la altura del contenedor `.toc-indicator`, logrando la correspondencia visual deseada entre la posición del encabezado en el documento y la posición de la línea en el indicador.

---

## 6. Cambios en SidebarNav

El componente también evolucionó para integrarse mejor con Flexbox:

### De `fixed` a `sticky`

```astro
<!-- Antes -->
<aside class="fixed inset-y-0 left-0 z-50 hidden w-64 -translate-x-full ...">

<!-- Ahora -->
<aside class="sticky flex-shrink-0 max-w-64 inset-y-0 left-0 z-50 hidden -translate-x-full ...">
```

- En escritorio, el sidebar es `sticky` y ocupa su lugar natural dentro del flujo flex.
- En móvil, el mismo elemento se convierte en un panel deslizable controlado por JavaScript, manteniendo una única estructura de markup.

### Control del ancho

- `max-w-64` limita el crecimiento del sidebar.
- `md:w-full` permite que ocupe el ancho disponible dentro de su celda flex en escritorio.

---

## 7. Conclusión

La migración de Grid a Flexbox resolvió dos problemas principales:

1. **Layout condicional limpio**: los tres componentes principales ahora se muestran solo cuando son necesarios, y el contenido central se adapta automáticamente al espacio disponible.
2. **Control refinado del dimensionamiento**: combinando `flex-shrink-0`, `flex-1` y `min-w-0`, cada pieza respeta su rol sin provocar desbordamientos ni encogimientos indebidos.

Paralelamente, el TOC evolucionó de un simple listado a una herramienta de navegación dual, mejorando la densidad de información y la experiencia de lectura, especialmente en modo compacto con el indicador visual de progreso.

### Reglas y técnicas clave utilizadas

| Regla / técnica | Función en el layout |
|---|---|
| `display: flex` | Distribuye los tres componentes en una fila adaptable. |
| `flex-shrink-0` | Impide que el sidebar y el TOC se encojan. |
| `flex-1` | Hace que el contenido principal ocupe el espacio sobrante. |
| `min-w-0` | Permite que el contenido principal se ajuste sin desbordar el viewport. |
| `sticky` | Mantiene sidebar y TOC visibles durante el scroll sin sacarlos del flujo. |
| `position: absolute` + `top: X%` | Posiciona las líneas del indicador del TOC proporcionalmente a la altura del contenedor. |
| `data-toc-mode` + `localStorage` | Alterna entre modo estándar y compacto de forma persistente. |
