# Nanobooks

> Agregado raíz del producto: una colección propia (con slug, visibilidad, tema y estado de aprovisionamiento) que contiene los documentos y sobre la que se decide el acceso.

**Nivel:** Núcleo  ·  **Entornos:** server / browser

## Qué hace
- Modela el agregado `Nanobook` (id, propietario, slug, nombre, visibilidad `public|private`, `settings` y `setupStatus` `pending|ready|failed`) y valida sus invariantes (slug `^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$`, `settings` cerrado a `theme`).
- Crea nanobooks de forma idempotente y aprovisiona su documento raíz `index` (`CreateNanobook`).
- Edita nombre, slug y visibilidad, cambia el tema y elimina (`LifeCycle`), siempre autorizando antes de cargar.
- Lee por id, por slug (con caché), por propietario y lista los públicos (`Reading`).
- Registra `NanobookAccessPolicy`, la política de autorización de los recursos `nanobook` y `document` (dueño/visibilidad).
- Compone `DocumentModule` (lo crea en `NanobookModule.create` y lo expone como `documentModule`).
- Expone la pantalla `/nanobooks` (tarjetas, edición, borrado) y los endpoints REST de nanobooks.
- NO hace: autorización propia (delega en `authorization`), contenido de documentos (módulo `documents`), selección ni renderizado de temas (módulo `theme`), navegación (módulo `navigation`).

## Cómo está construido
```text
nanobooks/
  server/
    index.ts                     # NanobookModule (compositor) + reexports de dominio
    domain/
      Nanobook.ts                # agregado inmutable; Nanobook.create valida; withSetupStatus
      NanobookSnapshot.ts        # proyección serializable (para caché)
      types.ts                   # NanobookVisibility, NanobookSetupStatus, NanobookSettings, CreateNanobookData, PersistedNanobook
      errors.ts                  # InvalidNanobook(Slug)Error, NanobookNotFoundError, NanobookRepositoryError, NanobookSlugAlreadyTakenError
      ports/                     # NanobookRepository, NanobookReadCache, NanobookRootDocument
    application/
      CreateNanobook.ts          # findOrCreate -> provisionar raíz -> markReady
      LifeCycle.ts               # update, setNanobookTheme, delete
      Reading.ts                 # getNanobookById/BySlug, listNanobooks, listPublicNanobooks
      writableNanobook.ts        # loadWritableNanobook (autoriza y carga) y saveNanobook (persiste + caché)
    infraestructure/
      access/NanobookAccessPolicy.ts
      repository/                # DrizzleNanobookRepository, InMemoryNanobookRepository (solo pruebas)
      database/DrizzleNanobookSchema.ts   # tabla `nanobook` (SQLite/Drizzle)
      cache/                     # createNanobookReadCache, InMemory..., Vercel...
      documents/DocumentModuleRootDocument.ts
      rest/                      # CreateNanobook, ListNanobooks, NanobookLifecycle controllers
  browser/ui/                    # NanobooksPage.astro, NanobookCard.astro, NanobookCardsController.astro
```

- **Domain:** `Nanobook` es inmutable; los cambios se hacen reconstruyendo con `Nanobook.create({...toPersistence(), ...cambios})` (así se revalidan siempre). Errores como clases `Error` con `name` estable (los controladores los mapean a HTTP por `error.name`).
- **Application:** `LifeCycle` recibe `Authorizer`; `Reading` y `CreateNanobook` no autorizan (`CreateNanobook` recibe el `ownerId` de la sesión que resuelve el controlador).
  - `CreateNanobook.execute(ownerId, input)`: si el slug existe y es del mismo dueño devuelve el existente (idempotente); si es de otro, `NanobookSlugAlreadyTakenError`. Crea con `setupStatus: "pending"` y tema por defecto `{ kind: "official", id: "monocromo" }`, asegura el documento raíz y marca `ready` (o `failed` si falla el aprovisionamiento).
  - `LifeCycle.delete(userId, id, confirmationName)`: exige que `confirmationName` coincida con el nombre exacto; borra y elimina la entrada de caché.
- **Puertos y adaptadores:**
  - `NanobookRepository` -> `DrizzleNanobookRepository` (`delete` en transacción: reverifica id/propietario/nombre, borra los `document` del nanobook y luego el nanobook); `InMemoryNanobookRepository` para tests.
  - `NanobookReadCache` (`getOrLoad`, `replace(nanobook, previousSlug?)`, `remove`) -> `VercelNanobookReadCache` si `VERCEL === "1"`, si no `InMemoryNanobookReadCache` (elegido por `createNanobookReadCache`).
  - `NanobookRootDocument.ensure` -> `DocumentModuleRootDocument` (usa `documentModule.getDocument.executeRaw` y `createDocument.execute`; documento `root-<nanobookId>`, ruta `index`).
- **Eventos:** no emite ni consume directamente (el `EventBus` solo se entrega a `DocumentModule`).
- **Persistencia/caché:** tabla `nanobook` (`owner_id` con FK a `user`, `slug` único, `settings_json`, `setup_status`); Runtime Cache de Vercel (namespace `nanobook:v1`, TTL 300 s) para lecturas por slug.
- **Librerías:** `drizzle-orm`, `@vercel/functions`, `zod` (validación de `LifeCycle.update`), `astro` (tipo `APIRoute`).

## Cómo se usa
- Punto de entrada: `server/index.ts`. Exporta `NanobookModule`, `Nanobook`, tipos (`NanobookSettings`, `NanobookSetupStatus`, `NanobookVisibility`) y `NanobookNotFoundError`.
- `Application` (`src/application/server/Application.ts`) hace `NanobookModule.create(eventBus, authorization)`, que registra la política, crea `DocumentModule` y construye los casos de uso. Luego pasa `nanobookModule.documentModule` a `NavigationModule`, `nanobookModule.setNanobookTheme` a `ThemeModule` y el módulo completo a `AgentModule`.
- Miembros públicos de `NanobookModule`: `createNanobook`, `updateNanobook`, `setNanobookTheme`, `getNanobookBySlug`, `getNanobookById`, `listNanobooks`, `listPublicNanobooks`, `documentModule` y los controladores `createNanobookController`, `listNanobooksController`, `lifecycleController`.

```ts
const app = await getApp();
const created = await app.nanobookModule.createNanobook.execute(userId, { slug: "mi-libro", name: "Mi libro" });
const read = await app.nanobookModule.getNanobookBySlug("mi-libro");   // Result<_, Nanobook | null>, con caché
const upd = await app.nanobookModule.updateNanobook(userId, id, { visibility: "public" }); // autoriza "write"
```

- Endpoints (`src/pages/api/nanobooks/`):
  - `POST /api/nanobooks` crear · `GET /api/nanobooks` listar propios (401 sin sesión).
  - `PATCH /api/nanobooks/:nanobookId` (campos `name`, `slug`, `visibility`, estricto) · `DELETE /api/nanobooks/:nanobookId` (body `{ confirmationName }` -> 204).
  - `POST /api/nanobooks/:nanobookId/theme` lo atiende `themeModule.assignNanobookThemeRoute`, que invoca `setNanobookTheme`.
  - Todas protegidas con `routeProtector.protect(...)`. Los errores se traducen por `error.name`: 404 not found, 409 slug en uso, 400 inválido, 500 genérico; los de acceso, vía `accessErrorResponse`.
- Páginas: `src/pages/nanobooks.astro` (renderiza `browser/ui/NanobooksPage.astro`) y `src/pages/n/[nanobookSlug]/[...slug]/index.astro` (lectura pública por slug).

## Dependencias
- **Depende de:** `authorization` (`Authorizer`, `Subject`, `Policy`, `accessErrorResponse`); `documents` (`DocumentModule` y esquema Drizzle `document`); `auth` (tabla `user` para la FK); `shared` (`Result`, `EventBus`, `db`, `ThemeReference`).
- **Lo usan:** `application` (composición y `resolveNanobookRoute`), `navigation` (recibe `documentModule`), `theme` (`setNanobookTheme`), `agents` (herramientas MCP), `documents/browser` (páginas), `spreadsheets`/otras rutas bajo `pages/api/nanobooks/...`.
- Acoplamientos a vigilar:
  - `DrizzleNanobookRepository` importa el esquema de `documents/server/infraestructure/database/DrizzleDocumentSchema` (la transacción de borrado toca la tabla `document`); y `NanobookModule` crea `DocumentModule`, por lo que `nanobooks` depende de `documents` y no al revés.
  - `domain/types.ts` y `LifeCycle` importan `shared/theme/ThemeReference`.

## Seguridad y autorización
- `NanobookAccessPolicy` (`appliesTo: ["nanobook", "document"]`, registrada con `authorization.register`) decide `read`/`write`:
  - Lee dueño y visibilidad siempre del repositorio, nunca de `attributes`.
  - Anónimo + `write` -> `deny unauthenticated` antes de consultar existencia.
  - `read` sobre público -> allow; dueño -> allow.
  - Privado ajeno o inexistente -> `deny not-found` (no revela existencia).
- `loadWritableNanobook` ejecuta `authorizer.require({ action: "write", resource: { type: "nanobook", id } })` antes de cargar; por eso `NanobookNotFoundError` solo aparece por carrera.
- El borrado exige confirmación por nombre y el repositorio revalida id/propietario/nombre dentro de la transacción.
- `Reading` (`getNanobookById/BySlug`, `listPublicNanobooks`) no autoriza: quien lo use para servir contenido debe aplicar el `Authorizer` (p. ej. `documents`).

## Pruebas
- Junto al código (`*.test.ts`): `domain/Nanobook(.Snapshot).test.ts`, `application/{CreateNanobook,LifeCycle,Reading,writableNanobook}.test.ts`, `infraestructure/access/NanobookAccessPolicy.test.ts`, `repository/DrizzleNanobookRepository.test.ts`, `cache/VercelNanobookReadCache.test.ts`, `documents/DocumentModuleRootDocument.test.ts`, `rest/*Controller.test.ts` y `server/index.test.ts`.
- Ejecutar: `npx vitest run src/nanobooks`. Cubren invariantes, permisos, idempotencia de creación, fallos de aprovisionamiento, confirmación de borrado, caché y mapeo HTTP.

## Decisiones y límites conocidos
- Pendiente/notas: `NanobookSettings` solo admite `theme` (contrato cerrado a propósito); no hay alias tras cambiar el slug; `DrizzleNanobookRepository.delete` solo borra `document` y `nanobook` (revisar si el esquema cubre revisiones y outbox por cascada).
