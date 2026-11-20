# Application

> Raíz de composición global: instancia y conecta los módulos de cada entorno (servidor y navegador) y expone el resultado vía `getApp()`.

**Nivel:** Núcleo  ·  **Entornos:** browser / server / shared

## Qué hace
- Compone el grafo de módulos del servidor (`Application.create()` async): auth, perfiles, nanobooks/documentos, navegación, rendering, contenido financiero, hojas de cálculo, tema, agentes y autorizador.
- Compone el grafo del navegador (`Application.create()` sync): `AuthModule` y `EditionModule`.
- Crea y comparte las piezas transversales: `InMemoryEventBus` y el `Authorizer` (`createAuthorizer()`).
- Registra los bloques de componentes en el `BlockRegistry` de `rendering` (financiero, hojas de cálculo y `counter-demo`).
- Ofrece `resolveNanobookRoute`: resolución de nanobook + sesión + autorización para las rutas HTTP (401/403/404).
- Aloja la landing pública (`browser/ui/LandingPage.astro`) y el bloque demo `CounterDemo`.
- NO es un módulo de negocio: no tiene `domain/`, `application/` ni infraestructura propias, y no contiene reglas de negocio.

## Cómo está construido
```text
application/
  browser/
    Application.ts            # AuthModule.create(), EditionModule.create(); getApp() singleton síncrono
    ui/LandingPage.astro      # landing pública (la usa pages/index.astro)
    components/CounterDemo/   # bloque demo: .astro, schema zod, isla .tsx y counterDemoBlock.ts
  server/
    Application.ts            # composición del servidor; getApp() devuelve Promise (singleton)
    resolveNanobookRoute.ts   # helper para rutas /api y /n/...
  shared/
    MarkdownRendererParity.test.ts  # solo prueba; no hay código de composición todavía
```
- **Orden de composición (server):** `AuthServerModule` -> `ProfileModule` -> `InMemoryEventBus` -> `createAuthorizer()` -> `NanobookModule` (recibe bus y autorizador) -> `NavigationModule` -> `RenderingModule.create(eventBus)` -> `FinancialContentModule.create(blocks)`, `SpreadsheetsModule.create(blocks)`, `blocks.register([counterDemoBlock])` -> `SpreadsheetsServerModule` -> `ThemeModule` -> `AgentModule`.
- **Campos expuestos (server):** `authServerModule`, `routeProtector`, `profileModule`, `nanobookModule`, `navigationModule`, `themeModule`, `agentModule`, `renderingModule`, `authorizer`, `spreadsheetsServerModule`. El módulo financiero y `SpreadsheetsModule` (navegador) no se guardan como campo; `financialContentModule.markdownBlockAdvisor` se pasa a `AgentModule`.
- **Autorización:** solo los compositores de los módulos reciben `Authorization` (el objeto que registra políticas); `Application` conserva y expone únicamente la vista `Authorizer`.
- **Extensiones Markdown / bloques:** se registran en `renderingModule.blocks`; el motor creado en `RenderingModule.create` ya incluye `createComponentBlocksExtension(blocks)`. La misma lista se replica en el Worker de preview (`documents/browser/.../WorkerMarkdownRenderer/worker-entry.ts`), que es su propia raíz de composición.
- **Eventos / persistencia:** no define ninguno; el bus es en memoria y se inyecta a nanobooks, navegación y rendering.
- **Librerías:** ninguna propia; `astro`, `@astrojs/react` para la isla de `CounterDemo`.

## Cómo se usa
Puntos de entrada: `application/server/Application` y `application/browser/Application` (exportan `Application` y `getApp`). Las páginas y endpoints delegan en ellos:

```ts
const app = await getApp();                        // servidor
const resolved = await resolveNanobookRoute(app, request, slug, "read");
if (resolved instanceof Response) return resolved; // 401 / 403 / 404
const { nanobook, user } = resolved;
```

```ts
const app = getApp();      // navegador
app.editionModule;         // los controladores de documents/browser/ui lo consumen
```

`resolveNanobookRoute(app, request, slug, "read" | "write", observeTiming?, responseHeaders?)`: en `write` exige sesión antes de consultar el slug (no revela su existencia); en `read`, un nanobook `public` se sirve sin sesión; si no, autoriza con `Subject.of(user?.id)` sobre `{ type: "nanobook", id }`. Las denegaciones de lectura devuelven 404; las de escritura mapean `unauthenticated`/`forbidden`/`not-found` a 401/403/404.

Para añadir una extensión o bloque: crear un módulo con `create(blocks: BlockRegistry)` que haga `blocks.register([...])` (como `FinancialContentModule` y `SpreadsheetsModule`) y llamarlo tanto aquí como en `worker-entry.ts` para mantener la paridad.

Rutas: `pages/index.astro` usa `LandingPage`; el resto de `pages/` (API, `/n/...`, OAuth, MCP) y los controladores de `documents/browser/ui` consumen `getApp()`. `application/` no declara rutas propias.

## Dependencias
- **Depende de:** `auth`, `authorization`, `profiles`, `nanobooks`, `navigation`, `rendering`, `theme`, `agents`, `shared` (bus, `RouteProtector`) y, por el lado del navegador, `documents` y `auth`.
- **Opcionales (acoplamiento a vigilar):** `application/server/Application.ts` importa de forma fija `financial-content/browser`, `spreadsheets/browser` y `spreadsheets/server` (aparte de `agents`, `theme`): añadir o quitar un módulo opcional exige editar este archivo y también `worker-entry.ts`. Es un import `server -> browser` (de módulos opcionales) y el servidor depende de `FinancialContentModule` para pasar `markdownBlockAdvisor` a `AgentModule`. `CounterDemo` (demo) vive aquí y se importa también desde el Worker de `documents`. `resolveNanobookRoute` importa tipos concretos (`Nanobook` de `nanobooks/server/domain`, `AuthenticatedUser` de `auth/shared`).
- **Lo usan:** `pages/`, `layouts/`, `documents/browser/ui`, `auth/browser/ui`, `rendering/browser/ui/RenderedDocument.astro` (viola la regla: `rendering` no debería depender de `application`) y los tests de integración.

## Seguridad y autorización
`resolveNanobookRoute` es el punto único de decisión de acceso a un nanobook: consume solo `Authorizer` y `Subject`. Las políticas (p. ej. `NanobookAccessPolicy`) se registran en los compositores de cada módulo, no aquí; `authorization` no importa módulos de negocio.

## Pruebas
`browser/Application.test.ts`, `browser/ApplicationConsumers.test.ts` (los controladores usan `getApp` y el Worker compone las extensiones con las fábricas compartidas), `server/Application.test.ts`, `server/resolveNanobookRoute.test.ts` y `shared/MarkdownRendererParity.test.ts` (HTML idéntico entre preview y publicación). Ejecutar: `npx vitest run src/application`.

## Decisiones y límites conocidos
- Pendiente: la composición de bloques está duplicada entre `Application` (server) y `worker-entry.ts`; `application/shared/` solo contiene una prueba, aunque AGENTS.md lo describe como composición común (p. ej. lista de extensiones).
