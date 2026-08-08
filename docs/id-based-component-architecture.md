# Arquitectura de componentes basada en IDs

## Resumen

Durante la refactorización del `SidebarNav` se adoptó un enfoque en el que cada componente encapsula su propia lógica de presentación y comportamiento, y se comunica con otros componentes a través del DOM usando IDs explícitos. Este documento describe los principios, la estructura resultante, sus fortalezas, riesgos y recomendaciones para seguir evolucionándola.

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

| Componente          | Props de entrada          | Elementos que manipula                        |
| ------------------- | ------------------------- | --------------------------------------------- |
| `OpenSidebar`       | `sidebarId`, `backdropId` | `#sidebar`, `#sidebar-backdrop`               |
| `CloseSidebar`      | `sidebarId`, `backdropId` | `#sidebar`, `#sidebar-backdrop`               |
| `SidebarModeToggle` | `toggleId`                | `#sidebar-mode-toggle`, `#sidebar`            |
| `SidebarList`       | `toggleId`                | `#sidebar-mode-toggle` (escucha su estado)    |

### 3. Estado declarativo mediante `data-*`

El estado se expresa en el DOM como atributos de datos:

- `data-sidebar-mode="expanded | collapsed"`
- `data-is-hidden="true | false"`
- `data-is-active="true | false"` (actualmente en desuso)

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

## Fortalezas

1. **Bajo acoplamiento superficial**: los componentes no dependen de la estructura interna de otros, solo de un contrato de IDs.
2. **Fácil de leer**: cada archivo es pequeño y su responsabilidad está clara.
3. **Reutilizable en teoría**: `OpenSidebar` y `CloseSidebar` podrían usarse en otros contextos si se les pasa otros IDs.
4. **Estado visible y depurable**: los atributos `data-*` se pueden inspeccionar directamente en el DevTools.
5. **CSS declarativo**: las transiciones y estilos condicionales están centralizados en las hojas de estilo.

## Riesgos y áreas a pulir

### IDs hardcodeados dentro de los componentes

`OpenSidebar` y `CloseSidebar` reciben IDs externos (`sidebarId`, `backdropId`) pero usan IDs fijos para sus propios botones (`sidebar-open`, `sidebar-close`). Si se reutilizaran varias instancias, colisionarían. Recomendación: recibir también `buttonId` como prop o generar IDs únicos.

### Lógica duplicada / cruzada

- `SidebarModeToggle.astro` ya actualiza `#sidebar` y el botón.
- `SidebarNav/index.astro` agrega un listener adicional al mismo botón para actualizar `#sidebar-header`.

Esto fragmenta la responsabilidad. Recomendación: mover la actualización de `#sidebar-header` dentro de `SidebarHeader.astro` o dentro de `SidebarModeToggle.astro`, no en el script del contenedor.

### `data-is-active` sin efecto visual

`SidebarList.astro` setea `data-is-active` en cada `ToolTip`, pero el estilo actual de `ToolTip.astro` ya no lo usa (responde a `#sidebar[data-sidebar-mode="collapsed"]`). Esto genera código muerto. Recomendación: eliminar el script de `SidebarList.astro` o restaurar su uso si era intencional.

### `console.log` residuales

Hay `console.log(toggleId)` en `SidebarHeader.astro` y `SidebarModeToggle.astro`.

### Validación de elementos nulos

Algunos scripts asumen que `document.getElementById` siempre devuelve un elemento. Conviene agregar guardas `if (!el) return;`.

### Layout como coordinador

`Layout.astro` aún contiene la lógica de coordinación entre sidebar y TOC (`enforceSingleExpanded`, observers, etc.). Para ser consistentes con el enfoque, se podría extraer a un componente `SidebarTocCoordinator.astro` que reciba los IDs necesarios.

## Recomendaciones para la siguiente iteración

1. **Contrato de IDs explícito**: documentar en cada componente qué IDs espera y qué atributos modifica.
2. **Parametrizar todos los IDs**: evitar IDs fijos dentro de componentes reutilizables.
3. **Eliminar código muerto**: quitar `data-is-active` y los `console.log`.
4. **Centralizar coordinación**: extraer la lógica de `Layout.astro` a un componente dedicado.
5. **Guardas defensivas**: validar existencia de elementos antes de manipularlos.
6. **Considerar un store liviano**: si la coordinación crece, evaluar una pequeña utilidad de estado global basada en eventos personalizados en lugar de mutar atributos desde múltiples lugares.

## Conclusión

El enfoque es prometedor porque reduce el tamaño de los componentes y establece un contrato claro de comunicación mediante IDs. Su principal riesgo es que el acoplamiento por ID puede volverse frágil si no se documenta y parametriza bien. Con los ajustes sugeridos, puede escalar de forma sostenible.
