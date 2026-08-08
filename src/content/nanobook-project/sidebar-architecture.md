---
title: "Plan de refactorización del SidebarNav"
description: "Resumen de la arquitectura del SidebarNav de nanobook, basada en IDs del DOM."
date: 2026-08-06
author: "Nanobook"
tags: []
draft: false
index: false
---
# Arquitectura del SidebarNav

## Resumen

El `SidebarNav` es un panel lateral de navegación que admite dos modos en escritorio (`expanded` / `collapsed`) y un drawer en mobile. Está compuesto por componentes atómicos que se comunican mediante IDs del DOM y atributos `data-*`.

## Estructura de componentes

```text
SidebarNav/index.astro
├── SidebarHeader.astro
│   ├── CloseSidebar.astro
│   └── SidebarModeToggle.astro
└── SidebarList.astro
    └── ToolTip.astro
```

A nivel de `Layout.astro`:

```text
Layout.astro
├── OpenSidebar.astro
└── SidebarNav/index.astro
```

## Contratos de IDs

| ID del DOM | Propósito | Definido en |
|------------|-----------|-------------|
| `sidebar` | Contenedor raíz del aside. | `SidebarNav/index.astro` |
| `sidebar-backdrop` | Fondo oscuro del drawer mobile. | `SidebarNav/index.astro` |
| `sidebar-open` | Botón para abrir el drawer mobile. | `OpenSidebar.astro` (default) |
| `sidebar-close` | Botón para cerrar el drawer mobile. | `CloseSidebar.astro` (default) |
| `sidebar-mode-toggle` | Botón para alternar expanded/collapsed. | `SidebarNav/index.astro` |
| `sidebar-header` | Cabecera del sidebar. | `SidebarHeader.astro` |

## Estados y atributos `data-*`

### `data-sidebar-mode`

Valores: `expanded` | `collapsed`

- En escritorio determina el ancho del sidebar (16rem o 4rem).
- En modo `collapsed` los textos se ocultan y los tooltips flotan al hacer hover.
- Se persiste en `localStorage` con la clave `sidebar-mode`.

### `data-is-hidden`

Valores: `true` | `false`

- Solo aplica en mobile (`< 768px`).
- Controla la visibilidad del drawer (`display: none` / `display: block`).
- Se setea desde `OpenSidebar`, `CloseSidebar`, el backdrop y los enlaces del sidebar.

### `data-is-active`

Valores: `true` | `false`

- Usado por `ToolTip.astro` para activar el estilo flotante del label.
- El label se revela con `:hover` y `:focus-within` sobre el icono.

## Flujo de datos

### Desktop: cambio de modo

1. El usuario hace click en `SidebarModeToggle`.
2. `SidebarModeToggle` actualiza `data-sidebar-mode` en `#sidebar` y en sí mismo.
3. `SidebarHeader` y `SidebarList` observan el mismo atributo (`#sidebar[data-sidebar-mode="collapsed"]`) y ajustan su presentación.
4. `Layout.astro` observa el atributo mediante `MutationObserver` y ejecuta `enforceSingleExpanded`.

### Mobile: abrir/cerrar drawer

1. El usuario hace click en `OpenSidebar`.
2. `OpenSidebar` setea `data-is-hidden="false"` en `#sidebar` y `#sidebar-backdrop`.
3. El usuario puede cerrar haciendo click en `CloseSidebar`, en el backdrop, o en cualquier enlace del sidebar.

## Componentes

### `SidebarNav/index.astro`

- Define el markup raíz (`#sidebar`, `#sidebar-backdrop`) y los estilos base.
- Inicializa `data-sidebar-mode` desde `localStorage` con un script `is:inline`.
- Agrega listeners para cerrar el drawer al hacer click en el backdrop o en un enlace.

### `SidebarHeader.astro`

- Muestra el enlace al padre y los controles.
- Recibe `toggleId` para sincronizar su propio `data-sidebar-mode` con el toggle.
- En modo `collapsed` oculta el texto del enlace y apila los controles verticalmente.

### `SidebarModeToggle.astro`

- Recibe `toggleId`.
- Inicializa y persiste el modo del sidebar.
- Alterna entre `expanded` y `collapsed` al hacer click.

### `OpenSidebar.astro` / `CloseSidebar.astro`

- Reciben `sidebarId`, `backdropId` y `buttonId`.
- Manejan la apertura/cierre del drawer mobile mutando `data-is-hidden`.
- Incluyen guardas defensivas y están envueltos en IIFE.

### `SidebarList.astro`

- Renderiza la lista de enlaces.
- Recibe `toggleId` para setear `data-is-active` en los tooltips cuando el sidebar se colapsa.

### `ToolTip.astro`

- Renderiza cada ítem con icono y label.
- En modo colapsado el label se oculta y se posiciona como tooltip flotante.
- Se muestra al pasar el cursor o al enfocar con teclado.

## Decisiones clave

- **Lógica del header en `SidebarHeader`**: en lugar de que el contenedor escuche el toggle, `SidebarHeader` sincroniza su propio estado. Esto sigue el mismo patrón que `SidebarList`.
- **Botones mobile parametrizables**: `OpenSidebar` y `CloseSidebar` reciben `buttonId` para permitir reutilización sin colisiones.
- **Cierre al navegar**: en mobile, cualquier click en un enlace del sidebar cierra el drawer, mejorando la experiencia táctil.

## Consideraciones

- El sidebar en mobile usa `position: fixed` y ocupa toda la altura de la pantalla (`inset: 0 auto 0 0`).
- El `z-index` del sidebar (`60`) es mayor que el del backdrop (`50`) y del header (`40`).
- El drawer mobile usa `display: none` / `display: block` para mostrar/ocultar.
