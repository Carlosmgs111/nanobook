# Pages (rutas Astro y adaptadores HTTP)

> Capa HTTP de la aplicación: cada archivo de `src/pages/` es una ruta de Astro que solo resuelve la sesión, delega en un módulo mediante `getApp()` y devuelve la respuesta; no contiene lógica de negocio.

**Nivel:** Capa superior (adaptador de entrada; no es un módulo de negocio)  ·  **Entornos:** server (todas las rutas se ejecutan en SSR; la presentación vive en `browser/ui/` de cada módulo)

## Qué hace
- Declara las rutas públicas de la interfaz (`*.astro`) y los endpoints (`api/**`, `mcp.ts`, `.well-known/**`).
- Obtiene la composición global con `await getApp()` (`src/application/server/Application.ts`) y reexporta controladores de los módulos como handlers de Astro (`GET`, `POST`, `PATCH`, `PUT`, `DELETE`, `ALL`).
- Protege los endpoints autenticados con `app.routeProtector.protect(handler)`; el resto de autorización la deciden los casos de uso con `Authorizer`.
- Resuelve en las páginas del nanobook el acceso de lectura/escritura mediante `resolveNanobookRoute` (`src/application/server/resolveNanobookRoute.ts`).
- Mantiene respuestas `410 Gone` para rutas legacy retiradas.
- NO contiene reglas de negocio, SQL ni lógica de render: eso vive en los módulos (`nanobooks`, `documents`, `theme`, `profiles`, `auth`, `agents`, `spreadsheets`).

## Cómo está construido
```text
src/
  middleware.ts                      # Origen CSRF + cabecera Server-Timing (global)
  pages/
    index.astro                      # Landing / catálogo público
    login.astro  verify-email.astro  consent.astro
    profile.astro  nanobooks.astro  themes.astro
    mcp.ts                           # Servidor MCP remoto (POST)
    .well-known/oauth-*/...ts        # Metadatos OAuth (delegan en Better Auth)
    n/[nanobookSlug]/[...slug]/      # index | edit | new | preview (.astro)
    api/
      auth/[...all].ts
      me/{profile.ts, documents/[...slug].ts}
      profiles/[username].ts
      nanobooks/{index.ts, [nanobookId]/{index,theme,spreadsheets,documents/[id],document-access/{index,unlock}}.ts}
      themes/{index.ts, [themeId].ts}
      documents/{invalidate.ts, webhook/github.ts}   # legacy 410
```

- Patrón de endpoint: `const app = await getApp(); export const prerender = false; export const POST = app.routeProtector.protect(app.<modulo>.<controlador>.handle);`
- Las páginas `.astro` componen componentes de `browser/ui/` de cada módulo (`documents`, `nanobooks`, `theme`, `profiles`, `auth`) y leen servicios de servidor solo en el frontmatter (SSR), según AGENTS.md.
- Sin puertos ni eventos propios. Persistencia, caché y servicios externos: los tocan los módulos, no esta capa.
- Librerías relevantes: `astro`, `@better-auth/mcp`, `@better-auth/oauth-provider`, `@modelcontextprotocol/server`.

### Páginas (`*.astro`)

| Ruta | Archivo | Delega en | Acceso |
|---|---|---|---|
| `/` | `index.astro` | `authServerModule.getSession` + `nanobookModule.listPublicNanobooks()`; render `application/browser/ui/LandingPage.astro`. `Cache-Control: private, no-store`; 503 si el catálogo falla | Público (sesión opcional) |
| `/login` | `login.astro` | `auth/browser/ui/AuthForm` + `AuthFormController` (`?mode=signup`) | Público |
| `/verify-email` | `verify-email.astro` | `layouts/Layout.astro` | Público |
| `/consent` | `consent.astro` | `verifyOAuthQueryParams` (Better Auth OAuth provider); 400 si los parámetros no son válidos o vencieron | Parámetros OAuth firmados |
| `/profile` | `profile.astro` | `profiles/browser/ui/ProfilePage` + `ProfileFormController` | Sin guarda SSR; los datos se cargan por `/api/me/profile` (401 si no hay sesión) |
| `/nanobooks` | `nanobooks.astro` | `nanobookModule.listNanobooks(session.id)` + `themeModule.listThemes` | Sesión; redirige a `/login?callbackURL=/nanobooks` |
| `/themes` | `themes.astro` | `themeModule.listThemes` / `getTheme` (`?theme=<id>`) | Sesión; redirige a `/login`; 403 `ThemeAccessDeniedError`, 404 otros |
| `/n/:nanobookSlug/:slug*` | `n/[nanobookSlug]/[...slug]/index.astro` | `resolveNanobookRoute(... "read")` + `documentModule.readDocument` (sin slug usa `index`) | Lectura: público o `Authorizer` `read`; 401 con desafío de contraseña; `noindex` si está protegido |
| `/n/:nanobookSlug/:slug*/edit` | `edit.astro` | `resolveNanobookRoute(... "write")` + `documents/browser/ui/pages/EditPage` | Sesión + `write` (401/403/404) |
| `/n/:nanobookSlug/:slug*/new` | `new.astro` | idem, `NewPage` | Sesión + `write` |
| `/n/:nanobookSlug/:slug*/preview` | `preview.astro` | idem, `PreviewPage` | Sesión + `write` |

`index.astro` de documentos emite `Server-Timing` propio (`route-app`, `route-access`, `route-nanobook`, `route-session`, `document`) con `formatServerTiming`.

### Endpoints HTTP

| Ruta | Método(s) | Archivo | Módulo / controlador al que delega | Autorización |
|---|---|---|---|---|
| `/api/auth/*` | ALL | `api/auth/[...all].ts` | `authServerModule.authController` (Better Auth) | Gestionada por Better Auth; el middleware no aplica la guarda de origen |
| `/.well-known/oauth-authorization-server/*` | GET | `.well-known/oauth-authorization-server/[...issuer].ts` | `authServerModule.authController` | Público (metadatos) |
| `/.well-known/oauth-protected-resource/*` | GET | `.well-known/oauth-protected-resource/[...resource].ts` | `authServerModule.authController` | Público (metadatos) |
| `/mcp` | POST | `mcp.ts` | `agents` (`createNanobookMcpServer`, `agentModule.tools`) | Token OAuth MCP (ver abajo) |
| `/api/me/profile` | GET, POST, PATCH | `api/me/profile.ts` | `profileModule.privateProfileRoutes` | `routeProtector` (sesión) |
| `/api/profiles/:username` | GET | `api/profiles/[username].ts` | `profileModule.getPublicProfileController` | Público |
| `/api/nanobooks` | GET, POST | `api/nanobooks/index.ts` | `nanobookModule.listNanobooksController` / `createNanobookController` | `routeProtector`; alcance por usuario |
| `/api/nanobooks/:nanobookId` | PATCH, DELETE | `api/nanobooks/[nanobookId]/index.ts` | `nanobookModule.lifecycleController.update` / `.delete` | `routeProtector` + `Authorizer` `write` en el caso de uso |
| `/api/nanobooks/:nanobookId/theme` | POST | `.../theme.ts` | `themeModule.assignNanobookThemeRoute` | Ya protegido por `routeProtector` dentro de `theme/server/index.ts` (sesión); propiedad/escritura en el módulo |
| `/api/nanobooks/:nanobookId/spreadsheets` | PATCH | `.../spreadsheets.ts` | `spreadsheetsServerModule.saveSpreadsheetController` | `routeProtector` + `Authorizer` `write` (`SaveSpreadsheet`) |
| `/api/nanobooks/:nanobookId/documents/:id` | POST, PATCH, DELETE | `.../documents/[id].ts` | `nanobookModule.documentModule.create/update/deleteDocumentController` | `routeProtector` + `Authorizer` `write` |
| `/api/nanobooks/:nanobookId/document-access` | PUT, DELETE | `.../document-access/index.ts` | `documentModule.documentAccessAdminController` (`put`, `delete`) | `routeProtector` + `write` (`loadWritableDocument`) |
| `/api/nanobooks/:nanobookId/document-access/unlock` | POST | `.../document-access/unlock.ts` | `documentModule.unlockDocumentController` | Público: solo si `Authorizer` permite `read` anónimo del nanobook (público); si no, 404 (no se puede sondear una contraseña) |
| `/api/themes` | GET, POST | `api/themes/index.ts` | `themeModule.collectionRoutes` | `routeProtector` aplicado en `theme/server/index.ts` (sesión); propiedad en el módulo `theme` |
| `/api/themes/:themeId` | GET, PATCH | `api/themes/[themeId].ts` | `themeModule.itemRoutes` | `routeProtector` aplicado en `theme/server/index.ts`; propiedad en el módulo `theme` |
| `/api/me/documents/*` | POST, PATCH, DELETE | `api/me/documents/[...slug].ts` | Ninguno (legacy) | `410 Gone` ("Usa el endpoint del nanobook canónico") |
| `/api/documents/invalidate` | POST | `api/documents/invalidate.ts` | Ninguno (legacy) | `410 Gone` |
| `/api/documents/webhook/github` | POST | `api/documents/webhook/github.ts` | Ninguno (legacy) | `410 Gone` ("el contenido usa SQL") |

### `middleware.ts`
Middleware global de Astro (`onRequest`):
- Si la ruta empieza por `/api/auth/` solo mide el tiempo y delega (Better Auth aplica su propia verificación de origen).
- En el resto llama a `rejectCrossOriginBrowserMutation(request, trustedOrigin)` (`shared/server/http/BrowserMutationOriginGuard.ts`). El origen de confianza es `process.env.BETTER_AUTH_URL` (su `origin`) o, si no está definido, el de la propia petición. Rechaza con `403` los métodos `POST/PUT/PATCH/DELETE` con `Sec-Fetch-Site` distinto de `same-origin` o `Origin` distinto del confiable; las peticiones sin esas cabeceras (clientes no navegador, p. ej. MCP) pasan.
- `measureApplication` añade `app-total;dur=...` a `Server-Timing` (`appendServerTiming`).
- Prueba: `src/middleware.test.ts`.

### `mcp.ts`
Servidor MCP remoto en `POST /mcp`: `requireMcpAuth(app.authServerModule.auth, ...)` valida el token OAuth (recurso derivado de `getMcpOAuthConfig(BETTER_AUTH_URL)`, scopes de desafío `nanobooks:read` y `nanobooks:write`), `readMcpActor(claims)` obtiene el actor delegado y `createMcpHandler(() => createNanobookMcpServer(actor, app.agentModule.tools), { legacy: "stateless", responseMode: "json" })` atiende la petición. No reutiliza las rutas HTTP de la UI.

## Cómo se usa
- Añadir un endpoint: crear `src/pages/api/<recurso>/...ts`, `export const prerender = false`, obtener `getApp()` y exportar los métodos HTTP delegando en un controlador del módulo; envolverlo con `app.routeProtector.protect(...)` si requiere sesión.
- Ejemplo real (`api/nanobooks/[nanobookId]/documents/[id].ts`):
  ```ts
  const app = await getApp();
  export const PATCH = app.routeProtector.protect(
    app.nanobookModule.documentModule.updateDocumentController.handle,
  );
  ```
- Añadir una página protegida: usar `resolveNanobookRoute(app, Astro.request, Astro.params.nanobookSlug, "read" | "write", observeTiming?, Astro.response.headers)`; si devuelve `Response`, retornarla.

## Dependencias
- **Depende de:** `application/server` (`getApp`, `resolveNanobookRoute`), `auth`, `authorization` (`Subject` en `unlock.ts`), `nanobooks`, `documents`, `theme`, `profiles`, `spreadsheets`, `agents` (MCP), `shared/server/http` y `shared/server/capabilities`.
- **Lo usan:** Astro (enrutado); los clientes HTTP de `browser/` (p. ej. `HttpDocumentWriter`, `HttpAuthApi`) llaman a estos endpoints.
- Acoplamiento a vigilar: `consent.astro` y `unlock.ts` contienen decisiones de acceso/validación en la propia ruta (OAuth y `Authorizer.authorize`); `documents/server` se importa en `n/.../index.astro` (`grantsFromCookieHeader`) desde la ruta.

## Seguridad y autorización
- Capas: (1) middleware: guarda CSRF por origen; (2) `routeProtector.protect` (`AuthServerModule.protect` → `withAuthenticatedSession`): exige sesión (401 JSON), en mutaciones fuerza lectura de sesión en base de datos y exige `Origin` igual al de la petición (403), inyecta `locals.currentUser/currentUserId` y fuerza `Cache-Control: private, no-store`; (3) casos de uso con `Authorizer`/`Subject` (`read`/`write`) y políticas registradas en los compositores.
- Lectura pública de nanobooks: `resolveNanobookRoute` oculta la existencia (404) cuando no hay permiso de lectura; en escritura exige sesión antes de consultar el slug.
- `/mcp` usa OAuth (token con claims) en lugar de cookie de sesión.

## Pruebas
- Junto a las rutas: `api/auth/[...all].test.ts`, `login.test.ts`, `profile.test.ts`, `.well-known/**/*.test.ts`, `api/nanobooks/[nanobookId]/documents/[id].test.ts`, `api/nanobooks/[nanobookId]/document-access/index.test.ts`; `src/middleware.test.ts`.
- Ejecutar: `npx vitest run src/pages` (las pruebas de componentes Astro usan `npm run test:astro`).

## Decisiones y límites conocidos
- Rutas heredadas del modelo anterior (GitHub/webhook/Redis): `webhook/github`, `documents/invalidate` y `me/documents/*` responden `410`; el contenido vive en SQL.
- Nota: en `themes` y `profiles/me` el `routeProtector` se aplica dentro del compositor del módulo, no en `pages`; en `nanobooks`, `documents` y `spreadsheets` se aplica en `pages`.
