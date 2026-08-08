# Arquitectura de componentes basada en IDs

## Resumen

Durante la refactorización del `SidebarNav` se adoptó un enfoque en el que cada componente encapsula su propia lógica de presentación y comportamiento, y se comunica con otros componentes a través del DOM usando IDs explícitos. Este documento describe los principios, la estructura resultante, sus fortalezas, decisiones arquitectónicas y áreas pendientes.

## Principios del enfoque

### 1. Atomización de la lógica

Cada componente Astro es responsable de:

- Renderizar su propio markup.
- Adjuntar los listeners que necesita.
- Mantener su estado local mediante atributos `data-*`.

Ejemplos:

- `OpenSidebar.astro`: abre el sidebar mobile al hacer click.
- `CloseSidebar.astro`: cierra el sidebar mobile al hacer click.
- `SidebarModeToggle.astro`: alterna entre `expanded`/`collapsed` y persiste en `localStorage`.
- `SidebarNav/index.astro`: orquesta la inicialización desde `localStorage` y el backdrop mobile.

### 2. Comunicación por IDs

Los componentes no reciben callbacks ni estado compartido mediante props complejas. En su lugar, reciben el `id` del elemento del DOM que necesitan manipular y usan `document.getElementById` para leer/escribir atributos.

Ejemplos de contratos:

| Componente          | Props de entrada                          | Elementos que manipula / observa                  |
| ------------------- | ----------------------------------------- | ------------------------------------------------- |
| `OpenSidebar`       | `sidebarId`, `backdropId`, `buttonId`     | `#sidebar`, `#sidebar-backdrop`, botón propio     |
| `CloseSidebar`      | `sidebarId`, `backdropId`, `buttonId`     | `#sidebar`, `#sidebar-backdrop`, botón propio     |
| `SidebarModeToggle` | `toggleId`                                | `#sidebar-mode-toggle`, `#sidebar`                |
| `SidebarHeader`     | `toggleId`                                | `#sidebar-header` (sincroniza con el toggle)      |
| `SidebarList`       | `toggleId`                                | `#sidebar-mode-toggle` (escucha su estado)        |

### 3. Estado declarativo mediante `data-*`

El estado se expresa en el DOM como atributos de datos:

- `data-sidebar-mode="expanded | collapsed"`
- `data-is-hidden="true | false"`
- `data-is-active="true | false"` — usado por `ToolTip.astro` para activar el estilo flotante del label; el label se revela con `:hover` y `:focus-within`.

El CSS responde a estos atributos, manteniendo separadas las reglas visuales de la lógica de JavaScript.

## Estructura de componentes

```text
SidebarNav/index.astro
├── SidebarHeader.astro
│   ├── CloseSidebar.astro
│   └── SidebarModeToggle.astro
└── SidebarList.astro
    └── ToolTip.astro
```

A nivel de layout:

```text
Layout.astro
├── OpenSidebar.astro
└── SidebarNav/index.astro
```

## Decisiones arquitectónicas

### Layout como coordinador de Sidebar y TOC

La lógica que comparten el sidebar y la tabla de contenidos (`enforceSingleExpanded`, observers, etc.) permanece en `Layout.astro`. Esto es intencional: `Layout` actúa como contenedor de ambos componentes y como canal de comunicación entre ellos. Ninguno de los dos tiene autoridad directa sobre el otro; ambos leen y escriben atributos `data-*` que `Layout` observa y coordina.

## Fortalezas

1. **Bajo acoplamiento superficial**: los componentes no dependen de la estructura interna de otros, solo de un contrato de IDs.
2. **Fácil de leer**: cada archivo es pequeño y su responsabilidad está clara.
3. **Reutilizable en teoría**: `OpenSidebar` y `CloseSidebar` pueden usarse en otros contextos si se les pasa otros IDs.
4. **Estado visible y depurable**: los atributos `data-*` se pueden inspeccionar directamente en el DevTools.
5. **CSS declarativo**: las transiciones y estilos condicionales están centralizados en las hojas de estilo.

## Riesgos y áreas a pulir

### Validación de elementos nulos

Algunos scripts asumían que `document.getElementById` siempre devuelve un elemento. Se agregaron guardas `if (!el) return;` en `OpenSidebar` y `CloseSidebar`; conviene revisar el resto de componentes para mantener la misma robustez.

### IDs hardcodeados en componentes reutilizables — RESUELTO

`OpenSidebar` y `CloseSidebar` usaban IDs fijos para sus botones (`sidebar-open`, `sidebar-close`). Ahora ambos reciben `buttonId` como prop con un valor por defecto, lo que permite reutilizarlos sin colisiones.

### Lógica cruzada del header — RESUELTO

`SidebarNav/index.astro` escuchaba clicks del toggle para actualizar `#sidebar-header`. Esa responsabilidad ahora vive dentro de `SidebarHeader.astro`, siguiendo el mismo patrón que `SidebarList.astro`.

### `console.log` residuales — RESUELTO

Se eliminaron los `console.log(toggleId)` de `SidebarHeader.astro` y `SidebarModeToggle.astro`.

## Recomendaciones para la siguiente iteración

1. **Contrato de IDs explícito**: documentar en cada componente qué IDs espera y qué atributos modifica.
2. **Guardas defensivas**: validar existencia de elementos antes de manipularlos en todos los scripts.
3. **Considerar un store liviano**: si la coordinación en `Layout.astro` crece, evaluar una pequeña utilidad de estado global basada en eventos personalizados en lugar de mutar atributos desde múltiples lugares.
4. **Tests visuales manuales**: verificar el comportamiento en mobile/desktop, especialmente la apertura/cierre del sidebar y el modo colapsado con tooltips.

## Conclusión

El enfoque es prometedor porque reduce el tamaño de los componentes y establece un contrato claro de comunicación mediante IDs. Su principal riesgo es que el acoplamiento por ID puede volverse frágil si no se documenta y parametriza bien. Con los ajustes aplicados, la arquitectura refleja mejor la separación de responsabilidades y el papel de `Layout` como coordinador de componentes independientes.
