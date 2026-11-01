# Protección de origen OAuth MCP en monolito Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir el canje OAuth 2.1 de clientes MCP sin desactivar la defensa CSRF/origen de las mutaciones de Nanobook ni extraer `auth` del monolito Astro.

**Architecture:** Astro deja de aplicar su guard global, incompatible con el cuerpo `application/x-www-form-urlencoded` del token endpoint. Un middleware de aplicación protege las mutaciones de negocio frente a navegadores cross-origin; `/api/auth/` se entrega sin esa capa a Better Auth, que ya aplica sus garantías de OAuth, CSRF, PKCE y origen confiable. El recurso `/mcp` sigue dentro del mismo proceso y verifica bearer tokens.

**Tech Stack:** Astro 7 SSR, Node.js 22+, TypeScript, Better Auth 1.7 (`@better-auth/mcp`, CIMD, JWT), Vitest, Drizzle/libSQL y adaptadores Node/Vercel.

**Spec:** `src/content/nanobook-project/arquitectura/proteccion-origen-oauth-mcp-monolito.md`

## Global Constraints

- Conservar el monolito: no crear un servicio, proxy genérico ni función externa para OAuth.
- Mantener `BETTER_AUTH_URL` como origen canónico de auth, OAuth y MCP; fuera de loopback debe ser HTTPS.
- No activar `advanced.disableCSRFCheck` ni `advanced.disableOriginCheck` de Better Auth.
- No habilitar Dynamic Client Registration: CIMD continúa restringido a los documentos permitidos de Codex.
- El único bypass del guard de aplicación es el prefijo exacto `/api/auth/`; `/mcp` y rutas de negocio permanecen protegidas por sus propios contratos.
- Usar Conventional Commits, actualizar `CHANGELOG.md` bajo `[Unreleased]` y ejecutar `npm run build` antes de cada commit.
- `src/content/nanobook-project/` está ignorado por Git: al documentar la decisión usar `git add -f` para incluir el archivo de arquitectura de forma deliberada.

## Review Focus

- Una petición `POST` de formulario cross-site a una mutación de nanobook devuelve `403`, incluso con cookie de sesión; tarea 1.
- Una mutación same-origin llega al controlador sin consumir ni reescribir el cuerpo; tarea 1.
- Un cliente MCP no navegador sin `Origin` ni `Sec-Fetch-Site` alcanza `/api/auth/oauth2/token`; tareas 2 y 3.
- Un navegador cross-origin no alcanza controladores de negocio ni `/mcp`; tarea 2.
- Hosts reenviados no autorizados no alteran el origen esperado; tarea 3.

---

## File Structure

- Create: `src/shared/server/http/BrowserMutationOriginGuard.ts` — política pura para decidir si una mutación de navegador se rechaza.
- Create: `src/shared/server/http/BrowserMutationOriginGuard.test.ts` — matriz de métodos, `Origin` y Fetch Metadata.
- Create: `src/middleware.ts` — compositor Astro que aplica la política fuera de `/api/auth/`.
- Create: `src/middleware.test.ts` — pruebas del límite de rutas y de `next()`.
- Modify: `astro.config.mjs` — desactiva el guard global y fija `allowedDomains` a partir de `BETTER_AUTH_URL`.
- Modify: `src/auth/server/infrastructure/better-auth/BetterAuth.ts` — declara el origen confiable de Better Auth.
- Modify: `src/auth/server/infrastructure/better-auth/McpOAuthConfig.ts` y su prueba — origen canónico reutilizable.
- Modify: `CHANGELOG.md` y `src/content/nanobook-project/arquitectura/proteccion-origen-oauth-mcp-monolito.md` — decisión y entrega.

### Task 1: Política pura para mutaciones de navegador

**Files:**
- Create: `src/shared/server/http/BrowserMutationOriginGuard.ts`
- Test: `src/shared/server/http/BrowserMutationOriginGuard.test.ts`

**Interfaces:**
- Produces: `rejectCrossOriginBrowserMutation(request: Request, trustedOrigin: string): Response | undefined`.
- Produces: `UNSAFE_HTTP_METHODS`, una constante de sólo lectura con `POST`, `PUT`, `PATCH` y `DELETE`.
- Consumed by: `src/middleware.ts` en la tarea 2.

- [ ] **Step 1: Escribir las pruebas que fallan para `rejectCrossOriginBrowserMutation`**

Cubrir `GET` sin rechazo; `POST` same-origin; `PATCH` con `Sec-Fetch-Site: same-origin`; `POST` con `Origin: https://evil.example`; `DELETE` con `Sec-Fetch-Site: cross-site`; y `POST` sin `Origin` ni Fetch Metadata que retorna `undefined`.

- [ ] **Step 2: Ejecutar la prueba enfocada y comprobar que falla**

Run: `npm test -- src/shared/server/http/BrowserMutationOriginGuard.test.ts`

Expected: FAIL porque el módulo no existe.

- [ ] **Step 3: Implementar `rejectCrossOriginBrowserMutation`**

No leer el cuerpo. Para métodos inseguros, retornar `403` si `Sec-Fetch-Site` existe y no es `same-origin`, o si `Origin` existe y no es exactamente `trustedOrigin`. Una solicitud sin ambos metadatos se deja pasar para que su autenticación de protocolo decida.

- [ ] **Step 4: Ejecutar las pruebas enfocadas**

Run: `npm test -- src/shared/server/http/BrowserMutationOriginGuard.test.ts`

Expected: PASS.

- [ ] **Step 5: Ejecutar suite, build y commit**

Run: `npm test && npm run build`

Expected: PASS; sólo pueden quedar advertencias conocidas no bloqueantes de Astro.

Commit: `feat(security): add browser mutation origin guard`

### Task 2: Componer la frontera de origen dentro de Astro

**Files:**
- Create: `src/middleware.ts`
- Test: `src/middleware.test.ts`
- Modify: `astro.config.mjs`

**Interfaces:**
- Consumes: `rejectCrossOriginBrowserMutation(request, trustedOrigin)` de la tarea 1.
- Produces: middleware `onRequest(context, next)` que retorna `403` o invoca una sola vez a `next()` con la petición original.
- Consumed by: todas las páginas SSR y rutas API de Astro.

- [ ] **Step 1: Escribir las pruebas que fallan del middleware**

Usar un `next` espía y contextos Astro mínimos. Verificar que un `POST /api/nanobooks` con `Origin: https://evil.example` da `403` y no llama a `next`; que el mismo request same-origin llama a `next`; que `POST /api/auth/oauth2/token` sin metadatos de navegador llama a `next`; y que `POST /mcp` con Fetch Metadata cross-site devuelve `403`.

- [ ] **Step 2: Ejecutar la prueba enfocada y comprobar que falla**

Run: `npm test -- src/middleware.test.ts`

Expected: FAIL porque no existe el middleware.

- [ ] **Step 3: Implementar `src/middleware.ts`**

Usar `defineMiddleware` de `astro:middleware`. Si `context.url.pathname` empieza por `/api/auth/`, devolver `next()` sin invocar el guard. Para las demás rutas, usar el origen de `BETTER_AUTH_URL`; en desarrollo sin la variable, usar `context.url.origin`. Si el guard devuelve respuesta, retornarla; de lo contrario, llamar `next()` sin reescribir ni consumir el cuerpo.

- [ ] **Step 4: Ajustar la configuración de Astro**

En `astro.config.mjs`, establecer `security.checkOrigin: false`. Derivar `security.allowedDomains` de `process.env.BETTER_AUTH_URL` cuando exista: protocolo, hostname y puerto exactos. Sin variable, dejar la lista vacía para desarrollo local. No agregar comodines de preview a producción.

- [ ] **Step 5: Ejecutar pruebas del middleware y rutas de auth**

Run: `npm test -- src/middleware.test.ts src/pages/api/auth/[...all].test.ts`

Expected: PASS; auth conserva su delegación a Better Auth y el guard no altera MCP.

- [ ] **Step 6: Ejecutar suite, build y commit**

Run: `npm test && npm run build`

Expected: PASS.

Commit: `fix(security): scope origin validation to application routes`

### Task 3: Endurecer Better Auth y validar el flujo real

**Files:**
- Modify: `src/auth/server/infrastructure/better-auth/BetterAuth.ts`
- Modify: `src/auth/server/infrastructure/better-auth/McpOAuthConfig.ts`
- Test: `src/auth/server/infrastructure/better-auth/McpOAuthConfig.test.ts`
- Modify: `CHANGELOG.md`
- Modify: `src/content/nanobook-project/arquitectura/proteccion-origen-oauth-mcp-monolito.md`

**Interfaces:**
- Produces: `getTrustedApplicationOrigins(baseURL: string): readonly [string]` en `McpOAuthConfig.ts`.
- Consumed by: `createBetterAuth()` como `trustedOrigins`.
- Depends on: tareas 1 y 2.

- [ ] **Step 1: Escribir la prueba de configuración que falla**

Extender `McpOAuthConfig.test.ts` para `getTrustedApplicationOrigins`. Probar que devuelve sólo el origen de una URL HTTPS de producción y de loopback local, y que rechaza una URL con path, credenciales, query o fragment.

- [ ] **Step 2: Ejecutar la prueba enfocada y comprobar que falla**

Run: `npm test -- src/auth/server/infrastructure/better-auth/McpOAuthConfig.test.ts`

Expected: FAIL porque el helper no existe.

- [ ] **Step 3: Implementar el helper y declarar `trustedOrigins`**

Reutilizar las mismas reglas de `parseOrigin`; no duplicar normalización. Añadir `trustedOrigins: getTrustedApplicationOrigins(baseURL)` a `betterAuth({ ... })`. Mantener habilitados los controles CSRF y origen por defecto; no tocar cookies ni CIMD.

- [ ] **Step 4: Ejecutar las pruebas del helper**

Run: `npm test -- src/auth/server/infrastructure/better-auth/McpOAuthConfig.test.ts`

Expected: PASS.

- [ ] **Step 5: Validar el contrato HTTP local con el servidor real**

Run: iniciar `npm run dev`; enviar `POST /api/auth/oauth2/token` con `Content-Type: application/x-www-form-urlencoded`, sin `Origin` ni `Sec-Fetch-Site` y con un `grant_type` incompleto.

Expected: error OAuth `400` o `401`, nunca `403 Cross-site POST form submissions are forbidden`. Repetir un `POST` cross-origin simulado a una ruta de negocio y confirmar `403`.

- [ ] **Step 6: Validar MCP en un deployment preview**

Conectar Codex a la URL de preview. Confirmar descubrimiento, login/consentimiento, canje y una llamada con `nanobooks:read`. Sin token debe recibirse desafío `401`; `nanobooks:write` no se concede por defecto.

- [ ] **Step 7: Documentar, verificar y hacer commit**

Registrar resultado y URL de preview sin secretos. Añadir la entrada `[Unreleased]`.

Run: `npm test && npm run build`

Expected: PASS.

Commit: `fix(auth): scope trusted origins for MCP OAuth`

Al preparar este último commit, ejecutar `git add -f src/content/nanobook-project/arquitectura/proteccion-origen-oauth-mcp-monolito.md` junto con los archivos ordinarios.

## Self-Review

- Cobertura: tareas 1 y 2 sustituyen la comprobación global por una frontera testeable; la tarea 3 conserva la seguridad OAuth de Better Auth y prueba el flujo real.
- Tipos: el guard devuelve `Response | undefined`; middleware retorna esa respuesta o invoca `next()` sin consumir el request.
- Riesgos: los cinco casos de Review Focus tienen prueba o verificación en su tarea propietaria.
- Proporción: no se introducen servicios, bases de datos, proxies ni dependencias; el cambio se limita a una política, un middleware y configuración explícita.
