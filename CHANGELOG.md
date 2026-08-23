# Changelog

Todos los cambios notables de este proyecto se documentarán en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

### Fixed
- `resolveReference` en `src/document/core/proxy.ts` resolvía mal las referencias relativas de documentos no índice porque usaba el propio ID como directorio base. Ahora usa el directorio padre para archivos normales y el propio ID para índices, alineado con el campo `index` del frontmatter.
- Editor cargaba siempre el documento staged anterior porque `sessionStorage` usaba una clave global compartida. Ahora el stage se valida por ID de documento y se limpia al salir del flujo edit/preview.

### Added
- Sistema extensible de resolutores de referencias en `src/document/core/reference/`.
- `ref` ahora soporta referencias locales fuera de `src/content/` (`ref: /README.md` o `ref: { source: "local", path: "README.md" }`).
- `ref` ahora soporta referencias a documentos en repositorios de GitHub (`ref: github:owner/repo/path.md` o `ref: { source: "github", owner, repo, path, branch? }`).
- `parseFrontmatter` extraído a `src/document/core/frontmatter.ts` para compartirlo entre loaders y resolutores.

### Docs
- Nueva sección de documentación del módulo `src/rendering/` en `src/content/nanobook-project/editor/rendering/`.

## [0.2.0-alpha.1] - 2026-08-22

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
- Refactor de `DocumentEditor` a una arquitectura componentizada:
  - Extracción de `src/editor/core/stage-document.ts` para gestionar `sessionStorage` del documento en edición.
  - Extracción de `src/editor/core/parse-staged-document.ts` para reconstruir `Document` desde el contenido del editor.
  - Extracción de `src/editor/core/save-document.ts` para centralizar la llamada `PATCH` a `/api/:id`.
  - Nuevos componentes visuales `EditorToolbar.astro` y `EditorStatus.astro` bajo `src/editor/components/`.
  - `DocumentEditor.astro` ahora solo orquesta los módulos anteriores y la instancia de CodeMirror.
- Reubicación de `TableOfContents` e `IndexList` dentro del dominio de documentos:
  - `src/tableOfContents/` → `src/document/components/TableOfContents/`
  - `src/documentIndex/` → `src/document/components/IndexList/`
  - `src/tableOfContents/core/scroll-spy.ts` → `src/document/core/scroll-spy.ts`
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
- `MarkdownItRenderer` ahora usa el motor de regex de JavaScript de Shiki (`createJavaScriptRegexEngine`) en lugar del motor Oniguruma/WASM, evitando errores de carga dinámica de WASM dentro del Web Worker de preview.
- `MarkdownRenderClient` vuelve a usar IDs de petición y un `Map` de promesas pendientes, eliminando la cancelación por terminación del worker que perdía respuestas.
- Nuevo servicio compartido `src/services/render.ts` que coordina el renderizado entre editor y preview: evita duplicados, descarta renders obsoletos y notifica por `BroadcastChannel` cuando el HTML está listo.
- `DocumentEditor` fuerza un render en `astro:before-swap` para que el preview funcione incluso si el usuario navega antes de que termine el debounce de 1 s.
- `preview.astro` ahora inicia el render como respaldo si no hay contenido renderizado, muestra "Generando preview..." mientras espera y se actualiza por `BroadcastChannel` cuando termina cualquier render en curso.

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

[Unreleased]: https://github.com/usuario/nanobook/compare/v0.2.0-alpha.1...HEAD
[0.2.0-alpha.1]: https://github.com/usuario/nanobook/compare/v0.1.0...v0.2.0-alpha.1
[0.1.0]: https://github.com/usuario/nanobook/releases/tag/v0.1.0
