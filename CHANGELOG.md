# Changelog

Todos los cambios notables de este proyecto se documentarán en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

### Added
- Editor integrado por documento: vista de edición en `/{slug}/edit` usando CodeMirror 6.
- `src/components/DocumentEditor/` con componente Astro y módulo de setup de CodeMirror, diseñado para permitir cambiar de editor en el futuro.
- `src/lib/editor/document.ts` para leer y escribir archivos Markdown de `src/content/`.
- `src/lib/editor/vite-plugin.ts` para exponer endpoints de edición solo en el servidor de desarrollo.
- Botón "Editar" en el header de páginas de documento y botón "Ver" en la vista de edición.
- Prop `hideToc` en `Layout.astro` para ocultar el TOC en la vista de edición.
- `parseDocument(entry)` en `src/lib/document.ts` para extraer headings del contenido sin depender del loader ni de la extensión del archivo.
- Loader `github` en `src/loaders/github/` para cargar contenido Markdown desde un repositorio de GitHub.
- Loader `mixed` en `src/loaders/mixed.ts` para combinar múltiples loaders en una sola colección.
- Script `scripts/push-content-to-github.mjs` para poblar el repositorio `nanobook-content` desde el contenido local.
- Capa de dominio `src/core/` con tipos `Document`, `DocumentMetadata` y `ContentRepository`.
- `AstroCollectionRepository` en `src/core/content/repository.ts` como adapter storage-agnostic para Astro.
- `NavigationBuilder` en `src/core/navigation/builder.ts` con `NavigationTree` cacheado.
- Interfaz `DocumentRenderer` en `src/core/rendering/types.ts` para separar renderizado de almacenamiento.
- Campo `position` en el frontmatter para controlar el orden de documentos en índices y sidebar.
- Documentación de arquitectura en `src/content/nanobook-project/arquitectura/content-model-architecture.md`.
- Documentación de la API de navegación en `src/content/nanobook-project/navigation-api.md`.
- `MemoryRepository` en `src/core/content/adapters/memory-repository.ts` para tests y desarrollo.
- Stub `DatabaseRepository` en `src/core/content/adapters/database-repository.ts` para el futuro adapter de base de datos.
- Documentación de storage adapters en `src/content/nanobook-project/arquitectura/storage-adapters.md`.

### Changed
- Reorganización de `src/content/nanobook-project/` en subcarpetas temáticas (`general`, `arquitectura`, `layout`, `sidebar`, `table-of-contents`, `versionado`) con índices propios y referencias internas actualizadas.
- Refactor de `src/lib/content.ts`: elimina `getHeadings()` y su dependencia del filesystem.
- `src/pages/[...slug].astro` ahora consume headings a través de `parseDocument(entry)`.

- Loader de GitHub: pre-renderiza el Markdown con `renderMarkdown()` para que `render(entry)` muestre el cuerpo del documento.
- Loader de GitHub: excluye `README.md` del patrón para evitar errores de validación de schema.
- Modo de despliegue configurable mediante `OUTPUT_MODE` (`static` / `dynamic`) en `astro.config.mjs`.
- Adapter de servidor `@astrojs/node` para el modo dinámico.
- `src/content.config.ts` ahora usa solo `glob` en modo estático y solo `github` en modo dinámico; no se mezclan fuentes.

### Fixed
- Renderizado de listas de tareas (checkboxes) al usar `remark`/`unified` añadiendo `remark-gfm` al pipeline.
- TOC no resaltaba la sección visible porque los headings renderizados no tenían `id`; se añadió `rehype-slug` al pipeline.
- Build fallaba al usar `OUTPUT_MODE`: `astro.config.mjs` ahora lee `process.env.OUTPUT_MODE` y las rutas server-only (`preview`, `api`) ajustan `prerender` según el modo.
- Tooltips del sidebar no se mostraban al hacer hover en modo colapsado.
- Loader de GitHub: coerción de fechas ISO a `Date`, soporte para saltos de línea CRLF, generación de IDs alineada con la convención de Astro (`index.md`) y uso de `picomatch` para soportar archivos en la raíz del repositorio.
- Botones de toggle (ancho de contenido, tema, TOC, sidebar) y listeners globales ahora funcionan correctamente tras navegar con `ClientRouter` de Astro; se migraron a scripts tipo módulo bajo `astro:page-load` y se añadieron scripts de restauración de estado en `astro:after-swap`.
- `DocumentEditor` ahora se reinicializa correctamente al volver de la vista preview con `ClientRouter`; se destruye la instancia de CodeMirror en `astro:before-swap` y se vuelve a crear en `astro:page-load` consultando el DOM actual.
- Vista `preview` ahora se renderiza correctamente en cada transición de `ClientRouter` (editor → preview → editor → preview), escuchando `astro:page-load` y manejando el caso de `sessionStorage` vacío.

## [0.1.0] - 2026-08-09

### Added
- Layout base con modo de ancho de contenido `constrained` / `full`.
- Header sticky que se adapta al ancho del modo de contenido.
- `SidebarNav` atómico con modo expandido/colapsado, tooltips y toggle.
- `TableOfContents` atómico con scroll spy, indicador visual y modo estándar/compacto.
- `ContentWidthToggle` para alternar entre ancho constrained y full.
- `ThemeToggle` con iconos SVG de sol/luna y brillo en modo oscuro.
- Íconos SVG consistentes con la identidad visual minimalista.
- Scroll vertical en `SidebarNav` con header fijo.
- Estilo global de scrollbar para el proyecto.
- Documentación del proyecto en `src/content/nanobook-project/`.

### Changed
- Migración del layout principal de grid a flex.
- Sidebar declarado con estilos condicionales en componentes hijos mediante `data-sidebar-mode`.
- TOC refactorizado a componentes atómicos basados en IDs y eventos personalizados.
- TOC en modo compacto: fondo con blur, índices más compactos, scrollbar estilizado, animación de despliegue y header sticky con borde inferior.
- Scrollbar de `SidebarNav` oculto para evitar que ocupe espacio en el contenedor.

### Fixed
- Ciclo infinito entre eventos `sidebar:mode` y `toc:mode` en `ContentWidthToggle`.
- Flash inicial del TOC al restaurar el modo guardado desde `localStorage`.
- Truncamiento de ítems largos en la lista del sidebar.
- Comportamiento responsive del header, breadcrumb y TOC en mobile.
- Sidebar en mobile: ahora muestra el texto completo en el drawer, independientemente del modo `collapsed` guardado.

[Unreleased]: https://github.com/usuario/nanobook/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/usuario/nanobook/releases/tag/v0.1.0
