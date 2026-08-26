# Changelog

Todos los cambios notables de este proyecto se documentarán en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

## [0.4.2] - 2026-08-26

### Fixed
- `GitHubRepository` ahora cachea el tree de GitHub en Redis con TTL de 5 minutos, reduciendo las llamadas a la API de GitHub a una cada 5 minutos.
- Aumentado el TTL del cache en memoria de documentos de `GitHubRepository` a 5 minutos.
- Creado helper compartido `src/shared/utils/redis.ts` para conexiones Redis.

## [0.4.1] - 2026-08-26

### Fixed
- `GitHubRepository` ahora descarga archivos Markdown desde `raw.githubusercontent.com` en lugar de la API de GitHub, evitando errores 403 por rate limit en producción.
- Actualizados tests de `GitHubRepository` para reflejar el nuevo formato de respuesta de archivos raw.

## [0.4.0] - 2026-08-26

### Added
- `RedisRenderedPageCache` en `src/rendering/adapters/cache/redis-page-cache.ts` para persistir cuerpos renderizados en cualquier servidor Redis compatible.
- Soporte de `CACHE_BACKEND=redis` en `src/rendering/adapters/cache/factory.ts`.
- `MemoryRepository` en `src/document/adapters/repository/memory-repository.ts` para tests y desarrollo.
- `resolveProxies()` en `src/document/parse/proxy.ts` para resolver referencias `ref` sobre listas de `Document` sin depender de `astro:content`.

### Changed
- **SSR puro**: Astro siempre usa `output: "server"`; eliminado `OUTPUT_MODE` y el modo estático/dinámico.
- `content.config.ts` carga solo archivos locales de `src/content/`; GitHub ya no pasa por Astro Content Collections.
- `createContentRepository()` ahora usa `CONTENT_SOURCE` (`filesystem` default, `github`) y eliminó la opción `astro`.
- Eliminados `AstroCollectionRepository` y `astro-cache.ts`; la carga pasa exclusivamente por `ContentRepository`.
- `ReferenceResolver`, `CompositeReferenceResolver` e `InternalReferenceResolver` trabajan con `Document` en lugar de `CollectionEntry`.
- `FileSystemRepository` y `GitHubRepository` resuelven proxies en `list()`.
- `GitHubRepository` ahora acepta un `pattern` opcional y excluye `README.md` por defecto.
- `GitHubRepository` cachea la lista de documentos en memoria compartida con TTL configurable (default 60s), reduciendo drásticamente las llamadas a la API de GitHub por petición.

### Removed
- Variable de entorno `OUTPUT_MODE` y modos `static`/`dynamic`.
- `src/document/adapters/repository/astro-collection-repository.ts`.
- `src/document/adapters/cache/astro-cache.ts`.
- `toDocument()` basado en `CollectionEntry` de `src/document/parse/document.ts`.

### Fixed
- Eliminados los warnings `Missing required field "title" in document "readme"` al usar `CONTENT_SOURCE=github` con un repo que contiene `README.md` sin frontmatter.
- Reducida la latencia de navegación cuando `CONTENT_SOURCE=github` evitando múltiples fetches del árbol y contenido de GitHub en cada petición.

### Docs
- Actualizada guía de despliegue en Vercel (`despliegue-vercel.md`) para recomendar Upstash Redis en lugar de Vercel KV (deprecado).
- Actualizado `plan-fase-7-isr-modo-dinamico.md` con el backend Redis y variables de entorno.
- Añadida sección de pruebas locales con `vercel dev` y Redis en `despliegue-vercel.md`.
- Actualizado `content-model-architecture.md` para reflejar el modelo SSR puro y `ContentRepository` como única fuente de verdad.
- Actualizado `README.md` con el modelo SSR puro y `CONTENT_SOURCE`.
- Nuevo plan de transición a SSR puro en `src/content/nanobook-project/arquitectura/plan-transicion-ssr-puro.md`.

## [0.3.0] - 2026-08-25

### Fixed
- `resolveReference` en `src/document/core/proxy.ts` resolvía mal las referencias relativas de documentos no índice porque usaba el propio ID como directorio base. Ahora usa el directorio padre para archivos normales y el propio ID para índices, alineado con el campo `index` del frontmatter.
- Editor cargaba siempre el documento staged anterior porque `sessionStorage` usaba una clave global compartida. Ahora el stage se valida por ID de documento y se limpia al salir del flujo edit/preview.

### Added
- Sistema extensible de resolutores de referencias en `src/document/core/reference/`.
- `ref` ahora soporta referencias locales fuera de `src/content/` (`ref: /README.md` o `ref: { source: "local", path: "README.md" }`).
- `ref` ahora soporta referencias a documentos en repositorios de GitHub (`ref: github:owner/repo/path.md` o `ref: { source: "github", owner, repo, path, branch? }`).
- `parseFrontmatter` extraído a `src/document/core/frontmatter.ts` para compartirlo entre loaders y resolutores.
- Vitest como runner de tests con scripts `test` y `test:watch`.
- Suite inicial de tests de contrato para `src/navigation/core/builder.ts` y sus helpers (`getBreadcrumbs`, `getSidebarEntries`, `getImmediateChildren`, `getParentEntry`).

### Docs
- Actualizada la documentación de carga, mapeo y navegación en `src/content/nanobook-project/arquitectura/content-model-architecture.md`, `src/content/nanobook-project/arquitectura/api-de-navegacion.md` y `src/content/nanobook-project/arquitectura/storage-adapters.md`.
- `src/content/nanobook-project/navigation-api.md` ahora enlaza al documento canónico en `arquitectura/api-de-navegacion.md`.
- Nueva sección de documentación del módulo `src/rendering/` en `src/content/nanobook-project/editor/rendering/`.
- Nueva documentación de documentos proxy en `src/content/nanobook-project/arquitectura/proxy-documents.md`.
- Nuevo informe de factibilidad sobre recompilado incremental en `src/content/nanobook-project/arquitectura/informe-factibilidad-recompilado-incremental.md`.
- Nuevo plan de preparación para el grafo de dependencias en `src/content/nanobook-project/arquitectura/plan-preparacion-grafo-dependencias.md`.

### Changed
- `src/navigation/core/builder.ts` ya no filtra borradores; el filtrado es responsabilidad de `ContentRepository`.
- `src/navigation/core/builder.ts` ahora delega la construcción del árbol en `buildDocumentGraph()` de `src/navigation/core/graph.ts`; `NavigationTree` sigue siendo la interfaz pública.
- `src/pages/[...slug]/index.astro` y `src/pages/[...slug]/edit.astro` ahora usan `NavigationService` en lugar de construir `nodeMap` manualmente.
- `DocumentGraph` ahora modela aristas de dependencia: `parent-child`, `sibling-order`, `proxy-target` e `internal-link`, con métodos `getDependencies(id)` y `getDependents(id)`.
- Nuevo extractor de links internos en `src/document/core/link-extractor.ts`.
- Lógica de resolución de referencias relativas extraída a `src/document/core/reference/path-resolver.ts` y reutilizada por `InternalReferenceResolver`.
- Nuevo motor de invalidación en `src/navigation/core/invalidation.ts` con `computeInvalidatedIds()`; soporta scopes `content`, `metadata` y `all` para `DocumentChange`.
- `DocumentGraph` expone `getIncomingEdges(id)` para permitir la propagación de invalidaciones.
- Nuevo `ContentChangeService` en `src/document/core/change-service.ts` que orquesta detección de cambios, grafo de dependencias e invalidación.
- Nuevo `FileSystemRepository` en `src/document/adapters/file-system-repository.ts` para leer contenido sin depender de Astro.
- Nuevo sistema de snapshots con hashes (`src/document/core/snapshot.ts`): `hashDocument()` y `computeDocumentChanges()` detectan `added`, `removed` y `modified` con scope `content`/`metadata`/`all`.
- Nuevo script `pnpm content:changes` (`scripts/detect-content-changes.ts`) que compara contra `.nanobook/content-snapshot.json` e imprime el `ChangeSet` y los documentos invalidados.
- Nuevo `RenderedPageCache` en `src/rendering/core/page-cache.ts` e implementación filesystem en `src/rendering/adapters/file-system-page-cache.ts`.
- Nuevo `PageRenderer` en `src/rendering/core/page-renderer.ts` para renderizar cuerpos de documentos fuera del pipeline de Astro.
- Nuevo script `pnpm content:render` (`scripts/render-invalidated.ts`) que detecta cambios y regenera solo los cuerpos de los documentos invalidados, guardándolos en cache.
- `.nanobook/` añadido a `.gitignore` para excluir snapshots y caches locales.
- Nueva documentación del estado actual del recompilado incremental en `src/content/nanobook-project/arquitectura/recompilado-incremental-estado-actual.md`, incluyendo flujo de principio a fin.
- Unificación de scripts `content:changes` y `content:render` bajo `scripts/content.ts` con subcomandos `status` y `render`; `content:changes` pasa a ser `content:status`.
- Nueva utilidad `shouldRebuildNavigationTree()` en `src/navigation/graph/invalidation.ts` para decidir si un cambio requiere recalcular el árbol de navegación o solo re-renderizar contenido.
- Reorganización estructural de `src/` por dominios: `document/`, `navigation/`, `rendering/`, `edition/` divididos en `model/`, `parse/`, `change/`, `reference/`, `graph/`, `service/`, `page/`, `adapters/`, `client/` y `ui/`.
- Consolidación de persistencia de snapshots en `src/document/change/snapshot.ts`.
- Agrupación de implementaciones de `ContentRepository` en `src/document/adapters/repository/`.
- Agrupación de resolutores de referencias en `src/document/adapters/reference/`.
- Reubicación de utilidades de cliente (`scroll-spy`, `render-service`, workers, CodeMirror) a `shared/client` o `edition/client` según corresponda.

### Fixed
- `src/content/nanobook-project/meta/readme.md` restaurado como proxy a `README.md` de la raíz del proyecto.

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

[Unreleased]: https://github.com/usuario/nanobook/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/usuario/nanobook/compare/v0.2.0-alpha.1...v0.3.0
[0.2.0-alpha.1]: https://github.com/usuario/nanobook/compare/v0.1.0...v0.2.0-alpha.1
[0.1.0]: https://github.com/usuario/nanobook/releases/tag/v0.1.0
