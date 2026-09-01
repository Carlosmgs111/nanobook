# Refactorización modular con composición raíz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar Nanobook en módulos explícitos con dependencias invertidas y una composición raíz de servidor, sin cambiar su comportamiento observable.

**Architecture:** Los dominios conservan las carpetas definidas en `AGENTS.md`. Los casos de uso dependen de puertos locales y reciben implementaciones desde `src/composition/server.ts`; Astro, GitHub, filesystem, Redis y Markdown quedan en adaptadores. Las rutas Astro sólo adaptan la solicitud a un caso de uso ya compuesto.

**Tech Stack:** TypeScript estricto, Astro 7, Vitest 4, Redis, GitHub API, Unified/Markdown-it.

**Spec:** `docs/superpowers/specs/2026-08-31-modular-composition-root-design.md`

## Global Constraints

- Mantener URLs, contratos HTTP, formato Markdown y variables de entorno actuales.
- No introducir `core/`, un contenedor DI de terceros ni imports de Astro/I/O en `model`, `ports` o `application`.
- Usar `git mv` para movimientos; actualizar `CHANGELOG.md` bajo `[Unreleased]`.
- Ejecutar `pnpm test` y `pnpm build` antes de cada commit; los commits siguen Conventional Commits.
- Conservar `src/pages/` y `src/layouts/` como bordes Astro, y la estructura de dominio de `AGENTS.md`.

---

## Mapa de archivos final

| Ruta | Responsabilidad |
|---|---|
| `src/composition/server.ts` | Lee entorno, crea adaptadores y exporta la aplicación compuesta. |
| `src/composition/server-config.ts` | Traduce `astro:env/server` a una configuración tipada. |
| `src/document/ports/document-view-invalidater.ts` | Puerto semántico para invalidar vistas tras escrituras. |
| `src/document/application/create-document.ts` | Caso de uso de creación y validación de jerarquía. |
| `src/document/application/update-document.ts` | Caso de uso de actualización e invalidación. |
| `src/document/application/content-change-service.ts` | Consultas de cambios e invalidación de contenido. |
| `src/document/adapters/cache/rendered-page-invalidater.ts` | Adaptador del puerto de invalidación sobre `RenderedPageCache`. |
| `src/rendering/page/render-document-page.ts` | Caso de uso de lectura que ensambla una vista, sin crear adaptadores. |
| `src/rendering/page/page-renderer.ts` | Renderizado y caché de HTML a partir de contratos inyectados. |
| `src/navigation/service/service.ts` | Fachada de consultas de navegación para UI. |
| `src/pages/**` | Adaptadores Astro mínimos; importan sólo la aplicación compuesta. |

### Task 1: Establecer el baseline y pruebas de caracterización

**Files:**
- Modify: `CHANGELOG.md`
- Test: `src/document/service/__tests__/document-service.test.ts` (crear)
- Test: `src/rendering/page/__tests__/render-document-page.test.ts` (crear)

**Interfaces:**
- Consumes: `ContentRepository`, `DocumentService`, `RenderedPageCache`, `DocumentRenderer` actuales.
- Produces: pruebas que fijan creación, actualización, invalidación y reutilización de caché antes de mover código.

- [ ] **Step 1: Registrar el estado previo y la intención del refactor**

  Añadir a `[Unreleased]` de `CHANGELOG.md`:

  ```md
  ### Changed
  - Refactorización interna hacia módulos por dominio, puertos y composición raíz; sin cambios en la API pública.
  ```

- [ ] **Step 2: Escribir pruebas de caracterización**

  Probar que una creación invalida el documento creado y su padre, que una actualización invalida el documento, y que una página con el mismo `contentHash` no invoca dos veces al renderer.

  ```ts
  expect(cache.invalidate).toHaveBeenCalledWith(["guias/index"]);
  expect(renderer.render).toHaveBeenCalledTimes(1);
  ```

- [ ] **Step 3: Ejecutar el baseline**

  Run: `pnpm test`

  Expected: todas las pruebas existentes y las nuevas pasan sin cambios de comportamiento.

- [ ] **Step 4: Verificar la compilación**

  Run: `pnpm build`

  Expected: Astro compila rutas y tipos sin errores.

- [ ] **Step 5: Commit**

  ```bash
  git add CHANGELOG.md src/document/service/__tests__ src/rendering/page/__tests__
  git commit -m "test(architecture): characterize document and page behavior"
  ```

### Task 2: Extraer los puertos semánticos de documentos

**Files:**
- Create: `src/document/ports/content-repository.ts`
- Create: `src/document/ports/document-view-invalidater.ts`
- Create: `src/document/adapters/cache/rendered-page-invalidater.ts`
- Modify: `src/document/model/types.ts`
- Modify: `src/document/service/document-service.ts`
- Test: `src/document/service/__tests__/document-service.test.ts`

**Interfaces:**
- Consumes: `RenderedPageCache` de `src/rendering/model/types.ts`.
- Produces:

  ```ts
  export interface DocumentViewInvalidater {
    invalidateDocumentViews(documentIds: readonly string[]): Promise<void>;
  }
  ```

- [ ] **Step 1: Escribir la prueba de la nueva frontera**

  Sustituir el doble de `RenderedPageCache` por un `DocumentViewInvalidater` y comprobar que el caso de uso lo llama sin importar rendering.

  ```ts
  const invalidater = { invalidateDocumentViews: vi.fn() };
  expect(invalidater.invalidateDocumentViews).toHaveBeenCalledWith([id]);
  ```

- [ ] **Step 2: Mover el contrato de repositorio a un puerto**

  Crear `content-repository.ts` con la interfaz actual y reexportarla temporalmente desde `document/model/types.ts`. Actualizar los consumidores de aplicación para importar desde `document/ports`.

- [ ] **Step 3: Implementar el adaptador de invalidación**

  Crear `RenderedPageInvalidater` que reciba un `RenderedPageCache` y delegue en `cache.invalidate([...ids])`. El adaptador absorbe el error de caché, preservando la semántica actual de escritura no bloqueante.

- [ ] **Step 4: Cambiar DocumentService para depender del puerto**

  Reemplazar el tipo `RenderedPageCache` por `DocumentViewInvalidater`; en `invalidateCache` llamar `invalidateDocumentViews` y renombrar el método privado a `invalidateViews`.

- [ ] **Step 5: Ejecutar pruebas y compilación**

  Run: `pnpm test -- src/document/service/__tests__/document-service.test.ts`

  Expected: PASS.

  Run: `pnpm test && pnpm build`

  Expected: PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add src/document src/rendering
  git commit -m "refactor(document): depend on semantic invalidation port"
  ```

### Task 3: Nombrar los casos de uso de escritura

**Files:**
- Create: `src/document/application/create-document.ts`
- Create: `src/document/application/update-document.ts`
- Create: `src/document/application/types.ts`
- Modify: `src/document/service/document-service.ts`
- Modify: `src/document/api/document.ts`
- Test: `src/document/application/__tests__/create-document.test.ts`
- Test: `src/document/application/__tests__/update-document.test.ts`

**Interfaces:**
- Consumes: `ContentRepository`, `DocumentViewInvalidater`, `CreateDocumentInput`.
- Produces:

  ```ts
  export type CreateDocument = (input: CreateDocumentInput) => Promise<Result<Document, DocumentServiceError>>;
  export type UpdateDocument = (document: Document) => Promise<Result<void, DocumentServiceError>>;
  ```

- [ ] **Step 1: Copiar las pruebas de creación y actualización a los casos de uso**

  Las pruebas deben cubrir ID inválido, documento existente, padre inexistente, padre no índice, creación exitosa, actualización inexistente y actualización exitosa.

- [ ] **Step 2: Extraer implementaciones puras de aplicación**

  Mover los cuerpos de `DocumentService.create` y `DocumentService.update` a fábricas `createCreateDocument(repository, invalidater)` y `createUpdateDocument(repository, invalidater)`.

- [ ] **Step 3: Mantener una fachada de transición**

  Conservar `DocumentService` sólo como adaptador temporal que recibe los dos casos de uso y expone `create`/`update`. Marcarlo con comentario de compatibilidad y eliminarlo en la tarea 8.

- [ ] **Step 4: Adaptar los handlers HTTP**

  Cambiar `createPatchHandler` y `createPostHandler` para recibir un objeto `DocumentCommands { create, update }`, no una clase concreta.

- [ ] **Step 5: Ejecutar la suite**

  Run: `pnpm test && pnpm build`

  Expected: PASS; PATCH y POST preservan sus códigos 200, 201, 400, 404 y 409.

- [ ] **Step 6: Commit**

  ```bash
  git add src/document
  git commit -m "refactor(document): expose explicit write use cases"
  ```

### Task 4: Centralizar configuración y selección de adaptadores

**Files:**
- Create: `src/composition/server-config.ts`
- Create: `src/composition/server.ts`
- Modify: `src/document/adapters/repository/factory.ts`
- Modify: `src/rendering/adapters/cache/factory.ts`
- Modify: `src/document/index.ts`
- Test: `src/composition/__tests__/server.test.ts`

**Interfaces:**
- Consumes: adaptadores de repositorio, caché, Markdown e `astro:env/server`.
- Produces:

  ```ts
  export interface ServerApplication {
    documentCommands: DocumentCommands;
    renderDocumentPage(slug: string): Promise<RenderDocumentPageResult | null>;
    contentRepository: ContentRepository;
  }
  export async function createServerApplication(config: ServerConfig): Promise<ServerApplication>;
  ```

- [ ] **Step 1: Probar selección con configuración explícita**

  La prueba construye `ServerConfig` con `source: "memory"` y `cacheBackend: "memory"`; no debe depender de variables de entorno ni de Astro.

- [ ] **Step 2: Crear `ServerConfig`**

  Convertir las variables actuales `CONTENT_SOURCE`, `CACHE_BACKEND`, `REDIS_URL`, `GITHUB_*` en una estructura validada. La lectura de `astro:env/server` queda en una única función `readServerConfig()`.

- [ ] **Step 3: Convertir factories en constructores sin entorno**

  `createContentRepository` recibe opciones completas; `createRenderedPageCache` recibe `{ backend, redisUrl }`. Eliminar constantes de módulo `contentSource`, `backend` y `url`.

- [ ] **Step 4: Crear la composición raíz**

  `createServerApplication` crea repositorio, caché, `RenderedPageInvalidater`, renderer Markdown, comandos de documentos y el caso de uso de página. Ningún otro archivo decide entre filesystem/GitHub/memory o Redis/filesystem/memory.

- [ ] **Step 5: Convertir `document/index.ts` en compatibilidad temporal**

  Reexportar dependencias desde la composición raíz sin crear infraestructura propia. Añadir una prueba que asegure que la inicialización sucede una sola vez por proceso.

- [ ] **Step 6: Verificar**

  Run: `pnpm test && pnpm build && pnpm content:status`

  Expected: PASS; el comando de estado sigue leyendo el repositorio configurado.

- [ ] **Step 7: Commit**

  ```bash
  git add src/composition src/document src/rendering
  git commit -m "refactor(composition): centralize server dependency wiring"
  ```

### Task 5: Invertir las dependencias del renderizado de páginas

**Files:**
- Create: `src/rendering/page/render-document-page.ts`
- Modify: `src/rendering/page/page-renderer.ts`
- Modify: `src/rendering/page/render-document-page.ts` (eliminar tras migrar)
- Modify: `src/rendering/page/__tests__/render-document-page.test.ts`
- Test: `src/rendering/page/__tests__/page-renderer.test.ts`

**Interfaces:**
- Consumes: `ContentRepository`, `DocumentRenderer`, `RenderedPageCache`, `NavigationService`.
- Produces:

  ```ts
  export function createRenderDocumentPage(deps: RenderDocumentPageDependencies):
    (slug: string) => Promise<RenderDocumentPageResult | null>;
  ```

- [ ] **Step 1: Escribir la prueba de inyección**

  Instanciar el caso de uso con repositorio, caché y renderer falsos. Verificar que no se importan ni se invocan factories de adaptadores.

- [ ] **Step 2: Extraer `RenderDocumentPageDependencies`**

  Definir un objeto con `repository`, `renderer`, `cache` y `createNavigationService`. El caso de uso obtiene documento, hash y headings; `PageRenderer` recibe las dependencias en su constructor.

- [ ] **Step 3: Eliminar creación concreta del caso de uso**

  Suprimir de `renderDocumentPage` los imports de `createRenderedPageCache` y `UnifiedMarkdownRenderer`; trasladar su creación a `composition/server.ts`.

- [ ] **Step 4: Mantener el comportamiento de caché**

  Conservar la clave `(documentId, contentHash)` y el retorno `RenderDocumentPageResult`. Añadir caso de cache hit y cache miss en la prueba.

- [ ] **Step 5: Ejecutar pruebas**

  Run: `pnpm test -- src/rendering/page && pnpm build`

  Expected: PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add src/rendering src/composition
  git commit -m "refactor(rendering): inject page rendering dependencies"
  ```

### Task 6: Definir la frontera de navegación para consumidores

**Files:**
- Create: `src/navigation/application/get-document-navigation.ts`
- Modify: `src/navigation/service/service.ts`
- Modify: `src/rendering/page/page-renderer.ts`
- Test: `src/navigation/application/__tests__/get-document-navigation.test.ts`

**Interfaces:**
- Consumes: `Document[]`, `DocumentGraph` y `NavigationService` existentes.
- Produces:

  ```ts
  export interface DocumentNavigation {
    breadcrumbs: Crumb[];
    sidebarEntries: NavigationNode[];
    parentEntry: ParentEntry | null;
    childEntries: NavigationNode[];
  }
  export function getDocumentNavigation(documents: Document[], documentId: string): DocumentNavigation;
  ```

- [ ] **Step 1: Caracterizar navegación de raíz, hijo e índice**

  Escribir tres pruebas: `index` como crumb actual, un hijo con sidebar de hermanos, y un índice con hijos inmediatos sin incluirse a sí mismo.

- [ ] **Step 2: Crear la consulta orientada a la pantalla**

  Usar `createNavigationService` internamente y devolver un único `DocumentNavigation`. `PageRenderer` deja de conocer cuatro métodos independientes de navegación.

- [ ] **Step 3: Eliminar lógica duplicada**

  Comparar `navigation/graph/builder.ts` con `navigation/service/service.ts`; dejar la construcción de nodos y dependencias sólo en `graph`, y las consultas sólo en `application/service`.

- [ ] **Step 4: Ejecutar pruebas y compilación**

  Run: `pnpm test -- src/navigation src/rendering/page && pnpm build`

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/navigation src/rendering
  git commit -m "refactor(navigation): expose document navigation query"
  ```

### Task 7: Convertir rutas Astro en adaptadores mínimos

**Files:**
- Modify: `src/pages/[...slug]/index.astro`
- Modify: `src/pages/api/[...slug].ts`
- Modify: `src/pages/api/webhook/github.ts`
- Modify: `src/pages/api/invalidate.ts`
- Modify: `src/document/api/document.ts`
- Test: `src/document/api/__tests__/document.test.ts`
- Test: `src/pages/api/__tests__/github-webhook.test.ts` (crear)

**Interfaces:**
- Consumes: `serverApplication` desde `src/composition/server.ts`.
- Produces: rutas sin imports de factories, adaptadores concretos ni singletons de `document/index.ts`.

- [ ] **Step 1: Actualizar la ruta de página**

  Importar `serverApplication` y llamar `serverApplication.renderDocumentPage(slug ?? "")`. Mantener los mismos props entregados a `Layout` y `DocumentPage`.

- [ ] **Step 2: Actualizar API de documentos**

  Pasar `serverApplication.documentCommands` a `createPatchHandler` y `createPostHandler`. Probar los payloads actuales y todos sus códigos HTTP.

- [ ] **Step 3: Actualizar webhook e invalidación**

  Resolver `await serverApplication.pageCache` durante la composición, no dentro de la ruta. Corregir el uso actual de `createRenderedPageCache()` sin `await` antes de pasarlo al handler GitHub.

- [ ] **Step 4: Ejecutar pruebas de transporte**

  Run: `pnpm test -- src/document/api src/pages/api && pnpm build`

  Expected: PASS; el webhook recibe un `RenderedPageCache`, no una `Promise<RenderedPageCache>`.

- [ ] **Step 5: Commit**

  ```bash
  git add src/pages src/document/api
  git commit -m "refactor(api): use composed application dependencies"
  ```

### Task 8: Finalizar nombres y puntos de entrada de dominio

**Files:**
- Create: `src/document/index.ts`
- Create: `src/navigation/index.ts`
- Create: `src/rendering/index.ts`
- Modify: `src/document/service/document-service.ts` (eliminar)
- Modify: imports de `src/**/*.ts` y `src/**/*.astro`
- Test: todas las pruebas importadoras

**Interfaces:**
- Produces exportaciones explícitas, por ejemplo:

  ```ts
  export type { Document, DocumentMetadata } from "./model/types";
  export type { ContentRepository } from "./ports/content-repository";
  export { createCreateDocument } from "./application/create-document";
  ```

- [ ] **Step 1: Crear índices de dominio restringidos**

  Exportar sólo contratos, tipos y fábricas de casos de uso. No reexportar adaptadores ni la composición raíz.

- [ ] **Step 2: Sustituir imports profundos entre dominios**

  Cambiar imports externos a `document`, `navigation` o `rendering`. Permitir imports relativos dentro del mismo dominio para no crear ciclos por barrel files.

- [ ] **Step 3: Retirar la fachada temporal**

  Eliminar `DocumentService` tras confirmar que ninguna ruta, prueba o script lo importa. Ejecutar `rg "DocumentService|document/service" src scripts` y dejar salida vacía.

- [ ] **Step 4: Ejecutar la verificación completa**

  Run: `pnpm test && pnpm build && pnpm content:status && pnpm content:render`

  Expected: los cuatro comandos pasan.

- [ ] **Step 5: Commit**

  ```bash
  git add src scripts
  git commit -m "refactor(modules): publish explicit domain entry points"
  ```

### Task 9: Documentar, proteger y cerrar el refactor

**Files:**
- Modify: `AGENTS.md`
- Modify: `src/content/nanobook-project/arquitectura/plan-refactor-estructura-modulos.md`
- Create: `src/content/nanobook-project/arquitectura/composition-root.md`
- Create: `src/shared/utils/__tests__/module-boundaries.test.ts` (o configuración equivalente de lint, si se adopta una herramienta ya presente)
- Modify: `CHANGELOG.md`

**Interfaces:**
- Produces reglas de dependencia documentadas y una prueba de arquitectura sin nueva dependencia de producción.

- [ ] **Step 1: Documentar la composición raíz**

  Explicar qué crea `composition/server.ts`, qué configuración consume, cómo añadir un adapter y por qué las rutas no deben instanciar infraestructura.

- [ ] **Step 2: Actualizar convenciones del repositorio**

  Añadir a `AGENTS.md`: `application` sólo depende de modelo/puertos; `adapters` contiene I/O; `composition` es el único selector de implementaciones; ningún módulo añade `core/`.

- [ ] **Step 3: Añadir una protección de fronteras**

  Crear una prueba que lea los imports de `src/document/model`, `ports` y `application` y falle si encuentra `astro:`, `node:`, `redis`, `github` o `/adapters/`.

  ```ts
  expect(forbiddenImports).toEqual([]);
  ```

- [ ] **Step 4: Ejecutar la comprobación final**

  Run: `pnpm test && pnpm build && pnpm content:status && pnpm content:render`

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add AGENTS.md CHANGELOG.md src/content/nanobook-project src/shared
  git commit -m "docs(architecture): document module boundaries and composition"
  ```

## Verificación de cobertura

- Módulos que expresan intención: tareas 3, 6 y 8.
- Inversión de dependencias: tareas 2, 4 y 5.
- Composición raíz: tareas 4 y 7.
- Compatibilidad funcional y caché: tareas 1, 5 y 7.
- Prevención de regresiones arquitectónicas: tarea 9.
