# Auth

> Autenticación de la aplicación sobre Better Auth: sesión, registro/ingreso con correo verificado, GitHub OAuth y proveedor OAuth/MCP para agentes.

**Nivel:** Núcleo  ·  **Entornos:** browser / server / shared

## Qué hace
- Registro e ingreso con correo y contraseña, con verificación de correo obligatoria (`requireEmailVerification`, envío al registrarse y al ingresar, inicio de sesión automático tras verificar).
- Ingreso social con GitHub, activo solo si hay credenciales (`GITHUB_OAUTH_CLIENT_ID`/`SECRET`, deben configurarse juntas).
- Sesión: expira en 12 h, sin refresco, con cookie de caché cifrada (`jwe`, 60 s); rate limit en base de datos.
- Servidor de autorización OAuth para agentes MCP (plugins `mcp`, `jwt`, `cimd`): scopes `nanobooks:read`, `nanobooks:write`, `offline_access`; tokens de acceso 15 min, refresco 30 días; clientes permitidos Claude y Codex por metadatos CIMD.
- Expone la capacidad `RouteProtector.protect(handler)` y `getSession(...)` al resto de módulos.
- Lado navegador: lectura de sesión en caché, formularios de login/registro, cierre de sesión.

No hace: no decide permisos sobre recursos (eso es `authorization`), no define propiedad de documentos ni roles, no tiene capas `domain/` ni `application/` propias (solo infraestructura y composición).

## Cómo está construido
```text
auth/
  shared/AuthSession.ts              # AuthenticatedUser {id,email,name?}, AuthenticatedSessionReader
  server/
    index.ts                         # AuthServerModule (implementa RouteProtector)
    infrastructure/
      better-auth/
        BetterAuth.ts                # createBetterAuth(): configuración de Better Auth
        BetterAuthSessionReader.ts   # getSession / getSessionForPage (reenvía Set-Cookie)
        McpOAuthConfig.ts            # recurso /mcp, páginas login/consent, clientes CIMD permitidos
        GitHubOAuth.ts               # createGitHubOAuthProvider
        ResendEmailSender.ts         # correo de verificación vía API de Resend
        DrizzleAuthSchema.ts         # tablas SQLite de Better Auth (user, session, account, ...)
      http/
        AuthController.ts            # handler de /api/auth/*; convierte {redirect,url} en 302 en navegación
        withAuthenticatedSession.ts  # decorador de rutas protegidas
  browser/
    index.ts                         # AuthModule, GetAuthenticatedSession, Signout
    infrastructure/http/             # HttpAuthApi, HttpAuthSessionReader, OAuthSignedQuery
    infrastructure/session/          # CachedAuthSessionReader, SessionCachingAuthApi
    ui/                              # AuthForm, AuthFormController, AuthStatusController (.astro)
```
- **Capas:** solo infraestructura y el compositor `index.ts`. Los contratos puros de sesión están en `shared/`.
- **Puertos y adaptadores:** `RouteProtector` (`shared/server/capabilities/RouteProtector.ts`) implementado por `AuthServerModule`; `AuthenticatedSessionReader` (shared) implementado en navegador por `HttpAuthSessionReader` y `CachedAuthSessionReader`; `AuthApi` (navegador) implementado por `HttpAuthApi`, decorado por `SessionCachingAuthApi`.
- **Eventos:** no aplica.
- **Persistencia / servicios externos:** SQLite vía Drizzle (`drizzleAdapter`, `db` de `shared/infrastructure/database/drizzleDatabase`); Resend (`https://api.resend.com/emails`); GitHub OAuth; clientes MCP vía CIMD. Variables `astro:env/server`: `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `EMAIL_FROM`, `RESEND_API_KEY`, `GITHUB_OAUTH_*`. En Vercel (`VERCEL=1`) exige URL HTTPS de solo origen, secreto de 32+ caracteres, `RESEND_API_KEY` y `EMAIL_FROM`, cookies seguras e IP desde `x-vercel-forwarded-for`.
- **Librerías:** `better-auth`, `@better-auth/drizzle-adapter`, `@better-auth/mcp`, `@better-auth/cimd`, `@better-auth/oauth-provider`, `drizzle-orm`.

## Cómo se usa
- **Servidor** (`auth/server/index.ts`): `AuthServerModule.create()`; expone `auth`, `authController`, `protect(handler)` y `getSession(request, responseHeaders?)`. `Application.create()` (server) lo crea una sola vez, lo guarda como `authServerModule` y lo pasa como `RouteProtector` a `ProfileModule` y `ThemeModule`.
- **Navegador** (`auth/browser/index.ts`): `AuthModule.create()` con `getAuthenticatedSession.execute()` y `signOut.execute()`; lo compone `application/browser/Application.ts` como `authModule`.
- Proteger una ruta:
  ```ts
  export const POST = routeProtector.protect(async ({ locals }) => { /* locals.currentUserId */ });
  ```
  `withAuthenticatedSession`: 401 sin sesión; en mutaciones (no GET/HEAD/OPTIONS) fuerza lectura en base de datos (`disableCookieCache`) y exige `Origin` igual al origen de la petición (403); puebla `locals.currentUser` y `locals.currentUserId`; respuesta `Cache-Control: private, no-store`.
- Sesión en páginas SSR: `Layout.astro` y `resolveNanobookRoute` llaman `app.authServerModule.getSession(Astro.request, Astro.response.headers)`.
- Rutas: `POST/GET /api/auth/*` (`pages/api/auth/[...all].ts`), `/.well-known/oauth-authorization-server/[...issuer]` y `/.well-known/oauth-protected-resource/[...resource]`, `POST /mcp` (`pages/mcp.ts`, `requireMcpAuth` con `getMcpOAuthConfig(...).resource` y `readMcpActor(claims)` de `agents`), páginas `/login`, `/consent`, `/verify-email`.
- Flujo OAuth del navegador: `OAuthSignedQuery.getSignedOAuthQuery` conserva solo los parámetros firmados (`sig`, `ba_param` y los que enumeran) y `HttpAuthApi` los reenvía como `oauth_query` en login/registro y en el callback social.

## Dependencias
- **Depende de:** `shared` (`RouteProtector`, base de datos Drizzle). Para MCP la ruta `pages/mcp.ts` conecta con `agents`, no el módulo en sí.
- **Lo usan:** `application` (composición en ambos entornos), `profiles` y `theme` (vía `RouteProtector`), `layouts` (sesión y `AuthStatusController`), `pages/*`, y `documents`, `nanobooks`, `profiles`, `theme`, `navigation`/`nanobooks` UI (tipo `AuthenticatedUser` desde `auth/shared`).
- Acoplamientos a vigilar: `documents`, `nanobooks` y `profiles` importan `user` de `auth/server/infrastructure/better-auth/DrizzleAuthSchema` para las claves foráneas (esquema de otro módulo); `pages/mcp.ts` importa `McpOAuthConfig` desde infraestructura de `auth`. Los scripts del navegador no deben importar `auth/server`.

## Seguridad y autorización
Auth responde "quién eres"; "qué puedes hacer" lo decide `authorization`. Defensas propias: verificación de correo obligatoria, `trustedOrigins`, sesiones cortas, rate limit, comprobación de `Origin` en mutaciones protegidas, y el `middleware.ts` global rechaza mutaciones de navegador de origen cruzado salvo en `/api/auth/*` (donde Better Auth gestiona su propio origen). Los clientes MCP solo se aceptan si su CIMD es `https://claude.ai/oauth/mcp-oauth-client-metadata` o una URL `https://chatgpt.com/oauth/...client.json` válida; el recurso MCP exige HTTPS fuera de loopback.

## Pruebas
Junto a cada archivo (`*.test.ts`): `server/infrastructure/better-auth/` (GitHubOAuth, ResendEmailSender, DrizzleAuthSchema, BetterAuthSessionReader, McpOAuthConfig), `server/infrastructure/http/` (AuthController, withAuthenticatedSession), `browser/` (index, HttpAuthApi y flujo social, HttpAuthSessionReader, OAuthSignedQuery, CachedAuthSessionReader, SessionCachingAuthApi, AuthFormController). Ejecutar: `npx vitest run src/auth`.

## Decisiones y límites conocidos
- Módulo hermano: `src/authorization/README.md`.
