# Documents

> Módulo que posee el ciclo de vida de los documentos Markdown de un nanobook (crear, leer, editar, mover, borrar, proxificar y proteger con contraseña) y la experiencia de edición/preview en el navegador.

**Nivel:** Núcleo  ·  **Entornos:** browser / server

## Qué hace
- **Servidor.** Es dueño del agregado `Document` (identidad estable, ruta mutable, revisión, frontmatter) y de su persistencia SQL con concurrencia optimista (`DrizzleContentRepository`).
- Casos de uso de escritura (`CreateDocument`, `UpdateDocument`, `DeleteDocument`): cada uno exige permiso `write` vía `Authorizer`, fija en el servidor identidad, dueño y auditoría, y publica eventos `document.*`.
- Casos de uso de lectura (`GetDocument`, `GetAllDocuments`, `ReadDocument`, `ListReadableDocuments`): resuelven documentos proxy (`ref`) y aplican la protección por contraseña en un único punto (`ReadDocument`).
- Protección por contraseña de documentos: `SetDocumentPassword`, `ClearDocumentPassword`, `UnlockDocument` (scrypt, grants firmados con HMAC en cookie, límite de intentos) más la política `DocumentPasswordPolicy`.
- Caché de fuentes de documento por nanobook, invalidada por eventos (en memoria o Runtime Cache de Vercel).
- **Navegador.** Editor con borrador (staged), render de preview en un Web Worker, guardado/renombrado/borrado/creación contra la API HTTP, y las páginas Astro de lectura, edición, creación y preview (`browser/ui/pages/`).

No hace: no decide quién puede leer/escribir un nanobook (eso es `nanobooks` + `authorization`; `ReadDocument` y `ListReadableDocuments` **no** autorizan el acceso al nanobook, lo debe haber hecho el llamador); no renderiza Markdown en el servidor (`rendering`); no calcula navegación (`navigation`, que solo consume sus eventos); no gestiona usuarios (`auth`).

## Cómo está construido
```text
documents/
  server/
    index.ts                    # DocumentModule (compositor) + exports públicos
    domain/
      Document.ts               # agregado: id, path, revisión, metadatos, redacted(), withSecured(), moveTo()
      DocumentId.ts, DocumentPath.ts, DocumentReference.ts, DocumentSnapshot.ts
      types.ts, errors.ts, hash.ts, Heading.ts
      events/                   # DocumentCreated / Updated / Deleted
      ports/                    # ContentRepository, DocumentParser
      reference/types.ts        # ReferenceResolver (puerto de los `ref`)
      access/                   # AccessGrantPolicy, puertos de acceso (ports.ts)
    application/
      Create/Update/DeleteDocument, GetDocument, GetAllDocuments, ReadDocument, ListReadableDocuments
      ProxyParser.ts, DocumentSourceCache.ts (puerto), publishAll.ts
      access/                   # Set/Clear/UnlockDocument, documentResource, loadWritableDocument
      dto/                      # DocumentInput, Create/UpdateDocumentRequest, SerializedEntry
      event-handlers/           # InvalidateDocumentSourceCache
    infraestructure/
      repository/DrizzleContentRepository.ts
      database/DrizzleDocumentSchema.ts   # tablas document, document_access, document_unlock_attempt
      access/                   # DocumentPasswordPolicy, Drizzle*Repository/Limiter, HmacAccessGrantCodec, ScryptPasswordHasher
      cache/                    # InMemory/Vercel DocumentSourceCache + createDocumentSourceCache
      parse/                    # UnifiedDocumentParser (headings h2-h3), FrontmatterParser
      reference/                # Internal / LocalFile / GitHub ReferenceResolver
      rest/                     # controladores HTTP, GrantCookie, utils, mappers/toDocumentInput
  browser/
    index.ts                    # EditionModule (compositor) + export de DocumentChanged
    domain/                     # model/StagedDocument, protectedFrontmatterFields, ports, errors, events/DocumentChanged
    application/                # RenderPreview, InitializeEditor, HandleEditorChange, SaveDocument, RenameDocument,
                                # DeleteDocument, CreateDocument, GetRenderedDocument, protectedFrontmatter, ports/DocumentWriter
    infraestructure/            # SessionStorageDocumentStorage, YamlDocumentContentParser, HttpDocumentWriter,
                                # renderer/ (UnifiedMarkdownRenderer, WorkerMarkdownRenderer + worker-entry + protocol)
    ui/
      components/               # DocumentEditor, Editor*(Controller|Toolbar|Status), DocumentProtectionPanel, DocumentUnlockForm,
                                # DocumentActionLink, TableOfContents/
      pages/                    # DocumentPage, EditPage, NewPage, PreviewPage y sus *Controller.astro (scripts cliente)
```

**Capas del servidor**
- **domain:** `Document` valida `path`/`id`, exige que `nanobook: true` solo vaya en un índice, y genera el frontmatter inicial. `DocumentPath` distingue ruta interna (`a/index`) de pública (`a`) y resuelve enlaces relativos. `DocumentId` es un UUID por defecto. `DocumentSnapshot` serializa/deserializa para la caché. Errores tipados en `errors.ts` (`DocumentAlreadyExistsError`, `DocumentRevisionConflictError`, `ParentNotFoundError`, etc.).
- **application:** un caso de uso por clase con `execute(...)` que devuelve `Result`. `UpdateDocument` arrastra a los descendientes cuando se renombra un índice y solo el documento editado lleva `expectedRevision`. `DeleteDocument` borra el subárbol solo si el documento es un índice. `ProxyParser` sustituye el contenido de los documentos con `ref` por el del destino, conservando posición, dueño, `nanobook` y `ref` del origen y heredando `secured` del destino (no soporta `ref` encadenados).
- **infraestructure:** persistencia Drizzle/libSQL con borrado lógico (`deletedAt`), índices únicos sobre rutas vivas y transacciones para `updateMany`/`deleteMany`.

**Puertos y adaptadores (servidor)**
| Puerto | Adaptador |
|---|---|
| `ContentRepository` | `DrizzleContentRepository` |
| `DocumentParser` | `UnifiedDocumentParser` (remark; headings h2-h3) |
| `ReferenceResolver` | `InternalReferenceResolver`, `LocalFileReferenceResolver`, `GitHubReferenceResolver` (solo si hay `GITHUB_TOKEN`) |
| `DocumentSourceCache` | `InMemoryDocumentSourceCache`, `VercelDocumentSourceCache` (según `VERCEL === "1"`) |
| `DocumentAccessRepository` | `DrizzleDocumentAccessRepository` |
| `PasswordHasher` | `ScryptPasswordHasher` (`scrypt$N$r$p$salt$hash`) |
| `AccessGrantCodec` | `HmacAccessGrantCodec` (HKDF sobre `BETTER_AUTH_SECRET`) |
| `UnlockAttemptLimiter` | `DrizzleUnlockAttemptLimiter` |
| `Policy` (de `authorization`) | `DocumentPasswordPolicy` |

**Puertos y adaptadores (navegador)**
| Puerto | Adaptador |
|---|---|
| `DocumentStorage` | `SessionStorageDocumentStorage` (claves `nanobook:edition:<id>:{staged,preview,confirmed}`) |
| `DocumentWriter` | `HttpDocumentWriter` (usa `/api/nanobooks/{nanobookId}/documents/...`, tomando `nanobookId` de `[data-nanobook-id]`) |
| `DocumentContentParser` | `YamlDocumentContentParser` |
| `PreviewRenderer` | `WorkerMarkdownRenderer` (Worker) / `UnifiedMarkdownRenderer` (dentro del Worker, sobre `MarkdownEngine`) |

**Eventos**
- Emite (servidor): `document.created`, `document.updated`, `document.deleted` (`documentId`, `nanobookId`). `CreateDocument` publica además un evento por el índice padre; los renombrados de índice publican uno por documento movido. Los consume `InvalidateDocumentSourceCache` (aquí) y `navigation/server` (invalidación de su grafo).
- Emite (navegador, bus propio `EventTargetEventBus`): `document.changed` desde `RenderPreview` al guardar un preview; lo consumen `PreviewPageController.astro`.

**Persistencia / caché / externos**
- Tablas `document`, `document_access`, `document_unlock_attempt` (`DrizzleDocumentSchema.ts`; referencian `nanobook` y `user`).
- Caché de fuente: clave `nanobookId:publicPath`. En memoria, invalidar un nanobook rota su versión; en Vercel (namespace `document:v2`) cada entrada lleva la etiqueta `nanobook:<id>` e invalidar expira esa etiqueta. Leer un documento cacheado cuesta una consulta a la caché; un fallo, una lectura más y una escritura. Vercel: TTL 3600 s como tope (la invalidación real es por etiqueta), máx. 2 MB por entrada, fallos de caché tolerados.
- Referencias externas: archivos locales dentro de `process.cwd()` y GitHub.
- Navegador: `sessionStorage` (documentos serializados y previews; nunca contraseñas) y un Web Worker.

**Librerías relevantes:** `drizzle-orm`/`@libsql/client`, `unified`/`remark-parse`/`mdast-util-to-string`/`github-slugger` (headings), `yaml` (frontmatter), `@vercel/functions` (Runtime Cache), `node:crypto` (scrypt/HMAC/HKDF).

## Cómo se usa
- **Servidor** (`server/index.ts`): `DocumentModule.create(eventBus, authorization)` compone repositorio, resolutores, casos de uso, caché, controladores y **registra `DocumentPasswordPolicy`** en `authorization`. No lo crea `Application` directamente: lo crea `NanobookModule` y se accede como `app.nanobookModule.documentModule` (también lo reciben `navigation`, `spreadsheets/server` y `agents`). Exporta tipos (`Document`, `Heading`, DTOs, `ReadDocumentResult`), eventos, `grantsFromCookieHeader`, `DocumentId`, `DocumentPath` y errores `DocumentRepositoryError`/`DocumentRevisionConflictError`.
- **Navegador** (`browser/index.ts`): `EditionModule.create()` (expuesto como `app.editionModule` en `application/browser/Application.ts`) compone el flujo de edición. Nota: el nombre de la clase es `EditionModule`, no `DocumentModule`.

Lectura desde una página (`pages/n/[nanobookSlug]/[...slug]/index.astro`):
```ts
const read = await documentModule.readDocument.execute({
  nanobookId, path: slug,
  viewer: {
    userId: async () => user?.id ?? (await app.authServerModule.getSession(Astro.request, Astro.response.headers))?.id,
    grantFor: grantsFromCookieHeader(Astro.request.headers.get("cookie")),
  },
});
// read.kind: "not-found" | "allowed" (via "open" | "protected") | "challenge" (documento redactado)
```
Escritura desde otro módulo (patrón de `agents` y `nanobooks`):
```ts
await documentModule.updateDocument.execute(nanobookId, { id, path, title, description, content, expectedRevision }, actorId);
```
Flujo del editor en el navegador: `InitializeEditor` → `HandleEditorChange` (parsea frontmatter, guarda borrador, invalida confirmación) → `RenderPreview` (Worker, comparte renders concurrentes, descarta resultados obsoletos) → `SaveDocument` (PATCH, marca confirmado) / `RenameDocument` / `DeleteDocument` / `CreateDocument`.

**Rutas HTTP y páginas**
| Ruta | Qué hace |
|---|---|
| `POST/PATCH/DELETE /api/nanobooks/[nanobookId]/documents/[id]` | Crear, actualizar, borrar (controladores REST, protegidos por `routeProtector`; 400/401/404/409/500) |
| `PUT/DELETE /api/nanobooks/[nanobookId]/document-access` | Fijar/quitar contraseña (`DocumentAccessAdminController`; requiere sesión) |
| `POST /api/nanobooks/[nanobookId]/document-access/unlock` | Público: desbloquea y emite cookie `nbk-grant-*` (solo si el nanobook es legible anónimamente; si no, 404) |
| `/n/[nanobookSlug]/[...slug]` | Lectura (`DocumentPage`; 401 + `no-store` si hay desafío; `X-Robots-Tag: noindex` en protegidos) |
| `/n/.../edit`, `/n/.../new`, `/n/.../preview` | `EditPage`, `NewPage`, `PreviewPage` (exigen `write` vía `resolveNanobookRoute`) |
| `/api/me/documents/*`, `/api/documents/invalidate`, `/api/documents/webhook/github` | Legacy: responden `410` |

## Dependencias
- **Depende de:** `authorization/server` (`Authorizer`, `Subject`, `Policy`, `accessErrorResponse`), `shared` (`Result`, `DomainEvent`, `EventBus`, `EventTargetEventBus`, `db`, errores, `ServerTiming`), `nanobooks/server` (tabla `nanobook`, tipo `Nanobook` y rutas), `auth` (tabla `user`, `AuthenticatedUser`), `rendering` (`createMarkdownEngine`, bloques, `RenderedDocument.astro`), `financial-content/browser` y `spreadsheets/browser` (bloques en el Worker), `navigation` (`IndexList`, `restrictSecuredNavigation`), `layouts`, `application` (`getApp` de ambos entornos).
- **Lo usan:** `nanobooks` (crea el módulo y el documento raíz), `navigation` (eventos y grafo de documentos), `agents` (herramientas MCP de lectura/escritura), `spreadsheets` (adaptador `DocumentModuleSpreadsheetDocuments`), `pages/` (API y rutas), `application` (composición), `layouts`/`theme` (referencias puntuales).
- **Acoplamientos a vigilar (frente a AGENTS.md):**
  - `DrizzleDocumentSchema.ts` importa los esquemas de `nanobooks` y `auth` (necesario para las FK, pero acopla persistencia).
  - `browser/` importa valores/tipos de `server/`: `DocumentEditor.astro` importa `serializeEntry` (valor) y `HttpDocumentWriter`/`StagedDocument` importan tipos del `index.ts` del servidor; los tipos son inocuos, pero un valor de servidor en código cliente debe seguir limitado a `dto/SerializedEntry.ts` (puro).
  - El Worker de preview compone `financial-content` y `spreadsheets` (navegador) para igualar el HTML del servidor; hay un test de paridad en `application/shared/MarkdownRendererParity.test.ts`.
  - `DocumentModule` es creado por `NanobookModule`, no por `Application`: la composición global pasa por `nanobooks`.

## Seguridad y autorización
- **Escritura:** `CreateDocument`, `UpdateDocument`, `DeleteDocument` y `loadWritableDocument` (usado por set/clear password) llaman a `authorizer.require({ action: "write", resource: { type: "document", nanobookId } })` antes de tocar nada. El controlador solo valida ruta y sesión (401); el permiso lo decide el caso de uso.
- **Campos controlados por el servidor:** `id`, `author`, `ownerId`, `createdAt`, `updatedAt`, `secured` nunca se aceptan del cliente (`toDocumentInput`, `UpdateDocument`, `PROTECTED_FRONTMATTER_FIELDS` en el editor).
- **Concurrencia:** `expectedRevision` → `DocumentRevisionConflictError` → HTTP 409 con `expectedRevision`/`actualRevision`.
- **Lectura protegida:** `ReadDocument`/`ListReadableDocuments` calculan la cadena de documentos `secured` (original y proxy resuelto) con `documentResource` y consultan `authorizer.authorize` solo si hay alguno. `DocumentPasswordPolicy` **solo restringe** (`abstain`/`challenge`/`deny`, nunca `allow`): el escritor del nanobook queda exento y cada eslabón exige su propio grant. Sin desafío posible (agentes), el documento sale redactado (`Document.redacted()`: sin cuerpo ni descripción).
- **Contraseñas y grants:** scrypt con sal; contraseña de 8 a 128 caracteres; `passwordVersion` se incrementa al fijar o quitar y revoca grants previos; grant HMAC con TTL de 12 h; cookie `HttpOnly; SameSite=Lax` (`Secure` en Vercel); límite de 5 fallos por documento y cliente en 15 min (429 + `Retry-After`), con `clientKey` derivado por hash de la IP.
- Detalle y limitaciones: ver `arquitectura/proteccion-lectura-escritura-documentos`.

## Pruebas
- Colocadas junto a lo que verifican (38 archivos `*.test.ts`): casos de uso (`server/application/*.test.ts`, `access/`, `event-handlers/`), controladores REST, política y persistencia de acceso (`DrizzleAccessPersistence.test.ts`), cachés, resolutores, repositorio, y en el navegador `EditorFlow`, `Save/Rename/Delete/RenderPreview`, `protectedFrontmatter`, `WorkerMarkdownRenderer`, `HttpDocumentWriter`, `YamlDocumentContentParser`, `SessionStorageDocumentStorage`. Fábricas de apoyo en `application/test/factories.ts` (cada entorno).
- Ejecutar: `npx vitest run src/documents` (suite completa: `npm test`, que incluye la config Astro).

## Decisiones y límites conocidos
- **Pendientes conocidos:** `UnifiedMarkdownRenderer` tiene un `TODO` para extraer headings del preview (TOC); los `ref` encadenados no se resuelven; `GetAllDocuments` devuelve `[]` ante un fallo del repositorio (error silenciado); la cookie del grant tiene `Path=/n`, por lo que solo viaja a rutas bajo `/n`.
