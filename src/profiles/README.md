# Perfiles

> Perfil público de cada usuario (`username` único + `displayName`), su API REST y el formulario de perfil; se asocia 1:1 a la identidad de `auth`.

**Nivel:** Capa superior  ·  **Entornos:** browser / server

## Qué hace
- Crea el perfil del usuario autenticado (`username` + `displayName`), una sola vez por usuario.
- Devuelve y actualiza el perfil propio (solo `displayName`).
- Expone un perfil público consultable por `username` (devuelve `username` y `displayName`, nada más).
- Valida el `username` (`server/domain/Username.ts`): se normaliza con `trim().toLowerCase()` y debe cumplir `^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$` (3-32 caracteres, minúsculas, dígitos y guiones, sin guion al inicio ni al final).
- Ofrece la UI de `/profile` (formulario de alta/edición y cierre de sesión).
- NO gestiona identidad, sesión ni credenciales (eso es `auth`); NO permite cambiar el `username` por la API: el cambio es una operación operativa por script (ver más abajo).

## Cómo está construido
```text
src/profiles/
  server/
    domain/            # Profile, Username, errors, types, ports/ProfileRepository
    application/       # CreateCurrentProfile, GetCurrentProfile, UpdateCurrentProfile, GetPublicProfileByUsername, errors
    infraestructure/
      repository/      # DrizzleProfileRepository, InMemoryProfileRepository
      database/        # DrizzleProfileSchema (tabla user_profile)
      rest/            # 4 controladores APIRoute + utils (handleProfileError, jsonResponse)
    index.ts           # ProfileModule (compositor)
  browser/
    infrastructure/    # HttpProfileApi (cliente fetch hacia /api/me/profile)
    ui/                # ProfilePage, ProfileForm, ProfileFormController, SignOutController (.astro/.ts)
```
- **domain:** `Profile` (agregado: `userId`, `username`, `displayName`, `createdAt`, `updatedAt`; `Profile.create`, `updateDisplayName`, `toPublic`, `toPersistence`), `Username` (value object). Errores: `InvalidUsernameError`, `InvalidProfileError`, `ProfileRepositoryError`, `UsernameAlreadyTakenError`. El `username` es inmutable en el agregado: no existe método para cambiarlo.
- **application:** casos de uso que reciben el `actorId` ya resuelto y devuelven `Result`. `application/errors.ts` añade `ProfileAlreadyExistsError` y `ProfileNotFoundError` y reexporta `UsernameAlreadyTakenError`.
- **Puerto:** `ProfileRepository` (`getByUserId`, `getByUsername`, `create`, `update`). Adaptadores: `DrizzleProfileRepository` (producción) e `InMemoryProfileRepository` (pruebas).
- **Persistencia:** tabla `user_profile` (`user_id` PK con FK a `user.id` y `onDelete: cascade`, `username` `UNIQUE`, `display_name`, `created_at`, `updated_at`), con `user` tomado del esquema de `auth`. La unicidad del `username` la garantiza el índice de base de datos.
- **Eventos / caché:** no aplica.
- **Librerías:** `drizzle-orm` (SQLite/libSQL) en el servidor; `@libsql/client` en el script operativo.

## Cómo se usa
- Punto de entrada: `server/index.ts` exporta `ProfileModule`. `ProfileModule.create(routeProtector)` instancia `DrizzleProfileRepository(db)`, los casos de uso y los controladores, y publica `privateProfileRoutes = { GET, POST, PATCH }` ya envueltos con `routeProtector.protect(...)`. `Application.create()` (`src/application/server/Application.ts`) lo compone justo tras `AuthServerModule`, antes que el resto de módulos.
- Rutas Astro (delegan en el módulo):
  - `src/pages/api/me/profile.ts` — `export const { GET, POST, PATCH } = app.profileModule.privateProfileRoutes`. Cuerpo de POST: `{ username, displayName }`; de PATCH: `{ displayName }`. Respuestas: 201 (crear), 200 (leer/actualizar), 400 (payload o `username` inválido), 401 (sin sesión), 404 (perfil inexistente), 409 (perfil ya existe o `username` en uso).
  - `src/pages/api/profiles/[username].ts` — `GET = app.profileModule.getPublicProfileController.handle`. Es público: no pasa por `routeProtector`. Devuelve `{ username, displayName }`.
  - `src/pages/profile.astro` — compone `ProfilePage` + `ProfileFormController`.
- Cliente: `HttpProfileApi` (`getCurrent`, `create`, `update`) llama a `/api/me/profile` con `credentials: "include"`; lanza `ProfileApiError(message, status)`.
- Cambio de `username` (operación manual, sin endpoint):
  ```bash
  npm run profile:change-username -- --email user@example.com --expected-username actual --username nuevo [--database-url file:./data/nanobook.db]
  ```
  Implementado en `scripts/change-profile-username.ts` (`changeProfileUsername(client, input)`): localiza el perfil por email (`user` JOIN `user_profile`), exige que el `username` actual coincida con `--expected-username` (guarda contra errores de identidad), normaliza ambos con `Username`, rechaza un destino ya usado y actualiza `username` y `updated_at`. La URL por defecto es `file:./data/nanobook.db`. Es idempotente si el destino ya es el actual. Usa SQL directo con `@libsql/client`, no pasa por `ProfileModule`.

## Dependencias
- **Depende de:** `auth` (`RouteProtector` para proteger las rutas privadas, `locals.currentUserId` que inyecta la sesión, y el esquema `user` para la FK); `shared` (`Result`, `db` de Drizzle).
- **Lo usan:** `application` (compone `ProfileModule`); `pages` (`/profile`, `/api/me/profile`, `/api/profiles/[username]`); `layouts` (cabecera/shell muestran datos de perfil).
- Acoplamientos a vigilar: el esquema `DrizzleProfileSchema` importa directamente del esquema de `auth` (`auth/server/infrastructure/better-auth/DrizzleAuthSchema`); el script `scripts/change-profile-username.ts` importa `Username` del dominio y duplica en SQL las reglas de unicidad del repositorio.

## Seguridad y autorización
- Las rutas `/api/me/profile` van protegidas por `RouteProtector`; además cada controlador comprueba `locals.currentUserId` y responde 401 si falta. Cada usuario solo puede leer/crear/editar su propio perfil (el `actorId` sale de la sesión, nunca del cuerpo).
- `GET /api/profiles/[username]` es deliberadamente público y solo expone `username` y `displayName`; no filtra `userId` ni fechas (`toPublic`).
- No usa `Authorizer`/`Policy`: no hay recursos compartidos que autorizar. `authorization` no interviene en este módulo.
- El cambio de `username` por script requiere acceso directo a la base de datos (operación de administrador).

## Pruebas
Junto al código, por capa: `server/domain/*.test.ts`, `server/application/*.test.ts`, `server/infraestructure/repository/DrizzleProfileRepository.test.ts`, `server/infraestructure/rest/ProfileControllers.test.ts`, `browser/ui/SignOutController.test.ts`, `src/pages/profile.test.ts` y `scripts/change-profile-username.test.ts` (cambio correcto, `username` esperado distinto, destino ya usado).
Ejecutar: `npx vitest run src/profiles` (y `npx vitest run scripts/change-profile-username.test.ts`; la suite completa es `npm test`).

## Decisiones y límites conocidos
- Límite: el `username` no se puede cambiar desde la UI/API; solo con el script `profile:change-username`.
