# Runtime Read Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar las dos consultas LibSQL repetidas de la ruta SSR caliente mediante snapshots de nanobook y documento fuente en Vercel Runtime Cache, sin cachear autorización, sesiones, proxies ni HTML.

**Architecture:** `GetNanobookBySlug` y `GetDocument.executeRaw` recibirán puertos de caché de lectura que reconstruyen entidades de snapshots validados. Los casos de uso de nanobook refrescarán su entrada tras una escritura, y un handler de los eventos documentales reemplazará un token de versión por nanobook; así las rutas nuevas dejan de consultar todas las claves antiguas sin conocer sus paths. La resolución de proxies continuará usando el repositorio SQL después del hit de la fuente.

**Tech Stack:** Astro SSR 7, TypeScript estricto, Vitest 4, Drizzle/LibSQL, `@vercel/functions` 3.9.5 Runtime Cache.

**Spec:** `docs/superpowers/specs/2026-11-01-runtime-read-cache-design.md`

## Global Constraints

- Mantener la organización por módulo y entorno definida en `AGENTS.md`; los snapshots son contratos puros y los adaptadores de Vercel permanecen en `server/infraestructure/`.
- Reusar `getCache()` de `@vercel/functions`, ya instalada; no añadir una dependencia ni variables de entorno.
- En Vercel usar TTL de 300 segundos y namespaces independientes; en desarrollo/pruebas usar memoria.
- Las claves deben ser `nanobook:v1:slug:{slug-normalizado}` y `document:v1:{nanobookId}:{version}:{ruta-normalizada}` de forma efectiva (un namespace puede aportar el prefijo físico).
- Las fechas de snapshots se serializan como ISO 8601 y se rehidratan como `Date`; nunca persistir instancias de entidad ni parsers.
- No guardar un documento con proxy ya resuelto. Sesión, autorización y HTML de página siguen fuera de esta caché.
- Si una lectura de caché falla, está malformada o supera 2 MB, tratarla como *miss* y leer LibSQL. Tras una mutación, no ocultar un fallo del handler de invalidación: conservar el contrato actual del `EventBus`.
- Antes de cualquier commit ejecutar `npm run build`; actualizar `CHANGELOG.md` bajo `[Unreleased]`.

## Review Focus

- Snapshot de nanobook corrupto o con fechas no válidas: se elimina/ignora y el repositorio vuelve a ser la fuente de verdad — Task 1.
- Cambio de slug, visibilidad o tema: la ruta anterior no puede conservar datos de configuración o acceso desactualizados — Task 2.
- Crear, editar, mover o borrar un documento: un único cambio de versión debe hacer inaccesibles todas las rutas cacheadas del nanobook — Task 3.
- Documento proxy cuyo destino cambia: el contenido mostrado debe seguir resolviéndose desde el destino actual después de un hit de la fuente — Task 3.
- Snapshot documental de 2 MB o más, o Runtime Cache no disponible: no se escribe una entrada inválida y la respuesta procede del origen — Task 3.

---

### Task 1: Contrato y caché de lectura de nanobooks

**Files:**
- Create: `src/nanobooks/server/domain/NanobookSnapshot.ts`
- Create: `src/nanobooks/server/domain/NanobookSnapshot.test.ts`
- Create: `src/nanobooks/server/application/NanobookReadCache.ts`
- Create: `src/nanobooks/server/infraestructure/cache/InMemoryNanobookReadCache.ts`
- Create: `src/nanobooks/server/infraestructure/cache/VercelNanobookReadCache.ts`
- Create: `src/nanobooks/server/infraestructure/cache/createNanobookReadCache.ts`
- Create: `src/nanobooks/server/infraestructure/cache/VercelNanobookReadCache.test.ts`
- Modify: `src/nanobooks/server/application/GetNanobookBySlug.ts`
- Modify: `src/nanobooks/server/application/GetNanobookBySlug.test.ts`

**Interfaces:**
- Consumes: `Nanobook`, `NanobookRepository.findBySlug(slug)`, `Result`, and `RuntimeCache`.
- Produces: `NanobookSnapshot`, `toNanobookSnapshot(book)`, `fromNanobookSnapshot(snapshot)`, and `NanobookReadCache.getOrLoad(slug, load)` for Task 2 and module composition.

- [ ] **Step 1: Write failing snapshot round-trip tests**

```ts
it("serializes settings and ISO dates, then restores an equivalent Nanobook", () => {
  const restored = fromNanobookSnapshot(toNanobookSnapshot(book));
  expect(restored?.toPersistence()).toEqual(book.toPersistence());
});

it("rejects a malformed snapshot instead of constructing a Nanobook", () => {
  expect(fromNanobookSnapshot({ slug: "book", createdAt: "not-a-date" })).toBeNull();
});
```

- [ ] **Step 2: Run the snapshot test to verify it fails**

Run: `npm test -- src/nanobooks/server/domain/NanobookSnapshot.test.ts`

Expected: FAIL because the snapshot helpers do not exist.

- [ ] **Step 3: Implement the pure snapshot contract**

Implement `NanobookSnapshot` with id, owner, slug, name, visibility, settings,
setup status and ISO dates. `fromNanobookSnapshot(snapshot: unknown): Nanobook | null`
must validate shape, parse valid dates, and delegate semantic validation to
`Nanobook.create`; do not import Vercel or I/O into this file.

- [ ] **Step 4: Write failing cache hit/miss and corrupt-entry tests**

```ts
it("returns a restored cached nanobook without calling load", async () => {
  await expect(cache.getOrLoad(" Manual ", load)).resolves.toEqual(Result.ok(book));
  expect(load).not.toHaveBeenCalled();
});

it("deletes an invalid runtime entry and fills it from the repository result", async () => {
  await cache.getOrLoad("manual", load);
  expect(runtimeCache.delete).toHaveBeenCalledWith("slug:manual");
  expect(runtimeCache.set).toHaveBeenCalledWith("slug:manual", expect.any(Object), expect.any(Object));
});
```

- [ ] **Step 5: Run the cache test to verify it fails**

Run: `npm test -- src/nanobooks/server/infraestructure/cache/VercelNanobookReadCache.test.ts`

Expected: FAIL because the cache port and Vercel adapter do not exist.

- [ ] **Step 6: Implement `NanobookReadCache` and its adapters**

Define `getOrLoad(slug: string, load: () => Promise<Result<NanobookRepositoryFailure, Nanobook | null>>)` plus `replace(book: Nanobook, previousSlug?: string)` and `remove(slug: string)`. Normalize slug with `trim().toLowerCase()` in one private key helper. The Vercel implementation uses `getCache({ namespace: "nanobook:v1" })`, key `slug:{normalizedSlug}`, a 300-second TTL and `name: "nanobook:{slug}"`; the in-memory implementation supplies equivalent behavior. A cache `get` exception is a miss, but write/delete exceptions are allowed to reach lifecycle callers.

- [ ] **Step 7: Route `GetNanobookBySlug.execute` through the cache port**

Change its constructor to accept `NanobookRepository` and `NanobookReadCache`; call `cache.getOrLoad(slug, () => repository.findBySlug(slug))`. Extend its unit tests with a cache fake that proves the repository callback is passed through once and preserves repository failures.

- [ ] **Step 8: Run focused tests**

Run: `npm test -- src/nanobooks/server/domain/NanobookSnapshot.test.ts src/nanobooks/server/application/GetNanobookBySlug.test.ts src/nanobooks/server/infraestructure/cache/VercelNanobookReadCache.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/nanobooks/server/domain/NanobookSnapshot.ts src/nanobooks/server/domain/NanobookSnapshot.test.ts src/nanobooks/server/application/NanobookReadCache.ts src/nanobooks/server/application/GetNanobookBySlug.ts src/nanobooks/server/application/GetNanobookBySlug.test.ts src/nanobooks/server/infraestructure/cache
git commit -m "feat(nanobooks): cache reads by slug"
```

### Task 2: Invalidar snapshots de nanobook tras mutaciones

**Files:**
- Modify: `src/nanobooks/server/application/CreateNanobook.ts`
- Modify: `src/nanobooks/server/application/UpdateNanobook.ts`
- Modify: `src/nanobooks/server/application/DeleteNanobook.ts`
- Modify: `src/nanobooks/server/application/SetNanobookTheme.ts`
- Modify: `src/nanobooks/server/application/CreateNanobook.test.ts`
- Modify: `src/nanobooks/server/application/NanobookLifecycle.test.ts`
- Modify: `src/nanobooks/server/application/SetNanobookTheme.test.ts`
- Modify: `src/nanobooks/server/index.ts`

**Interfaces:**
- Consumes: `NanobookReadCache.replace(book, previousSlug?)` and `NanobookReadCache.remove(slug)` from Task 1.
- Produces: every successful write has synchronized or removed slug snapshots before it returns a successful `Result`.

- [ ] **Step 1: Write failing mutation-cache tests**

```ts
it("replaces the new slug and removes the old slug after a rename", async () => {
  await update.execute("owner", "one", { slug: "renamed" });
  expect(cache.replace).toHaveBeenCalledWith(expect.objectContaining({ getSlug: expect.any(Function) }), "first");
});

it("removes the source slug after deleting a nanobook", async () => {
  await remove.execute("owner", "one", "First");
  expect(cache.remove).toHaveBeenCalledWith("first");
});
```

Add cases for creation only after setup reaches `ready`, and for theme changes
refreshing the same slug with the new settings.

- [ ] **Step 2: Run the lifecycle tests to verify they fail**

Run: `npm test -- src/nanobooks/server/application/CreateNanobook.test.ts src/nanobooks/server/application/NanobookLifecycle.test.ts src/nanobooks/server/application/SetNanobookTheme.test.ts`

Expected: FAIL because successful mutations do not touch a read cache.

- [ ] **Step 3: Inject and invoke the read cache after successful persistence**

Add `NanobookReadCache` constructor dependencies to `CreateNanobook`,
`UpdateNanobook`, `DeleteNanobook`, and `SetNanobookTheme`. `CreateNanobook`
calls `replace` only after `updateSetupStatus(..., "ready")`; `UpdateNanobook`
passes the pre-update slug to `replace`; deletion calls `remove` only after the
repository deletion succeeds; and theme assignment replaces the current slug.
Preserve all authorization and validation before repository mutation.

- [ ] **Step 4: Compose one cache instance in `NanobookModule.create`**

Call `createNanobookReadCache()` once, construct the cached read use case and
all four mutation use cases with that same instance, and keep controllers as
thin adapters. Do not expose the adapter outside the module.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/nanobooks/server/application/CreateNanobook.test.ts src/nanobooks/server/application/NanobookLifecycle.test.ts src/nanobooks/server/application/SetNanobookTheme.test.ts src/nanobooks/server/application/GetNanobookBySlug.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/nanobooks/server/application src/nanobooks/server/index.ts
git commit -m "feat(nanobooks): invalidate slug snapshots on writes"
```

### Task 3: Caché versionada de documentos fuente y handler de eventos

**Files:**
- Create: `src/documents/server/domain/DocumentSnapshot.ts`
- Create: `src/documents/server/domain/DocumentSnapshot.test.ts`
- Create: `src/documents/server/application/DocumentSourceCache.ts`
- Create: `src/documents/server/application/event-handlers/InvalidateDocumentSourceCache.ts`
- Create: `src/documents/server/application/event-handlers/InvalidateDocumentSourceCache.test.ts`
- Create: `src/documents/server/infraestructure/cache/InMemoryDocumentSourceCache.ts`
- Create: `src/documents/server/infraestructure/cache/VercelDocumentSourceCache.ts`
- Create: `src/documents/server/infraestructure/cache/VercelDocumentSourceCache.test.ts`
- Create: `src/documents/server/infraestructure/cache/createDocumentSourceCache.ts`
- Modify: `src/documents/server/application/GetDocument.ts`
- Modify: `src/documents/server/application/GetDocument.test.ts`
- Modify: `src/documents/server/index.ts`

**Interfaces:**
- Consumes: `ContentRepository.getByPublicPath`, `DocumentParser`, current `DocumentCreated | DocumentUpdated | DocumentDeleted` events, and `RuntimeCache`.
- Produces: `DocumentSourceCache.getOrLoad(nanobookId, publicPath, load)` and `invalidateNanobook(nanobookId)`; `GetDocument.executeRaw` returns a cached **source** document while `execute` resolves its proxy afterward.

- [ ] **Step 1: Write failing document snapshot tests**

```ts
it("round-trips body, frontmatter, metadata, path, identity and revision", () => {
  const restored = fromDocumentSnapshot(toDocumentSnapshot(document), parser);
  expect(restored?.parse()).toMatchObject(document.parse());
});

it("does not accept a snapshot whose metadata dates are invalid", () => {
  expect(fromDocumentSnapshot({ metadata: { createdAt: "bad" } }, parser)).toBeNull();
});
```

- [ ] **Step 2: Run the snapshot test to verify it fails**

Run: `npm test -- src/documents/server/domain/DocumentSnapshot.test.ts`

Expected: FAIL because source snapshot helpers do not exist.

- [ ] **Step 3: Implement a parser-aware source snapshot contract**

Define a JSON-safe `DocumentSnapshot` containing identity, revision, internal
path, content, raw frontmatter and every metadata field needed by
`Document.create`, with ISO timestamps. `fromDocumentSnapshot(snapshot,
parser)` must rebuild a source `Document` with the supplied parser so headings
continue working; it must reject malformed data rather than throw.

- [ ] **Step 4: Write failing cache-version, oversize, and proxy-order tests**

```ts
it("changes the shared version so the next read cannot use the prior path entry", async () => {
  await cache.invalidateNanobook("book-a");
  await cache.getOrLoad("book-a", "guide", load);
  expect(load).toHaveBeenCalledOnce();
});

it("returns an oversized source from load without calling runtimeCache.set", async () => {
  await expect(cache.getOrLoad("book-a", "large", load)).resolves.toEqual(Result.ok(largeDocument));
  expect(runtimeCache.set).not.toHaveBeenCalledWith(expect.stringContaining(":large"), expect.anything(), expect.anything());
});

it("resolves a proxy after a source-cache hit", async () => {
  await getDocument.execute("book-a", "proxy");
  expect(proxyParser.parseProxies).toHaveBeenCalledWith("book-a", [cachedSource]);
});
```

- [ ] **Step 5: Run the document cache tests to verify they fail**

Run: `npm test -- src/documents/server/application/GetDocument.test.ts src/documents/server/infraestructure/cache/VercelDocumentSourceCache.test.ts src/documents/server/application/event-handlers/InvalidateDocumentSourceCache.test.ts`

Expected: FAIL because no cache version or event handler exists.

- [ ] **Step 6: Implement `DocumentSourceCache` adapters**

Use `getCache({ namespace: "document:v1" })`. Store a non-empty opaque version
token at `version:{nanobookId}`; on a miss seed it with `crypto.randomUUID()`.
Read/write source entries at `{nanobookId}:{version}:{normalizedPublicPath}`
with 300-second TTL and a descriptive `name`. `invalidateNanobook` replaces
only the version token, so it does not enumerate paths. Validate snapshots,
treat a cache-get exception as a miss, and skip `set` when UTF-8 JSON size is
at least `2 * 1024 * 1024` bytes. Implement matching semantics in memory.

- [ ] **Step 7: Use the cache only in raw route lookup, then subscribe invalidation**

Inject `DocumentSourceCache` into `GetDocument`; after `DocumentPath` has
normalized the URL, call `getOrLoad` around `contentRepository.getByPublicPath`.
Leave `ProxyParser`, `InternalReferenceResolver`, and `GetAllDocuments` on the
uncached repository. Implement one event handler that calls
`invalidateNanobook(event.nanobookId)` for all three document events and
returns `Result.ok()` when it is absent. In `DocumentModule.create`, build one
cache instance, pass it to `GetDocument`, and subscribe the handler to the
provided shared bus.

- [ ] **Step 8: Run focused tests**

Run: `npm test -- src/documents/server/domain/DocumentSnapshot.test.ts src/documents/server/application/GetDocument.test.ts src/documents/server/infraestructure/cache/VercelDocumentSourceCache.test.ts src/documents/server/application/event-handlers/InvalidateDocumentSourceCache.test.ts src/documents/server/application/CreateDocument.test.ts src/documents/server/application/UpdateDocument.test.ts src/documents/server/application/DeleteDocument.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/documents/server/domain src/documents/server/application src/documents/server/infraestructure/cache src/documents/server/index.ts
git commit -m "feat(documents): cache versioned source reads"
```

### Task 4: Medir el tiempo total de aplicación y documentar la decisión

**Files:**
- Modify: `src/middleware.ts`
- Modify: `src/middleware.test.ts`
- Modify: `src/CHANGELOG.md`
- Create: `src/content/nanobook-project/arquitectura/cache-lectura-runtime.md`

**Interfaces:**
- Consumes: `appendServerTiming(existing, timings)` and Astro middleware `next()`.
- Produces: una métrica `app-total;dur=…` en respuestas que llegan a `next()`, además de la documentación de claves, invalidación y exclusiones.

- [ ] **Step 1: Write the failing middleware timing test**

```ts
it("appends app-total after the downstream response completes", async () => {
  const response = new Response("ok", { headers: { "Server-Timing": "route;dur=5.0" } });
  const result = await onRequest(context("/n/book", request), async () => response);
  expect(result.headers.get("Server-Timing")).toMatch(/^route;dur=5\.0, app-total;dur=\d+\.\d$/);
});
```

- [ ] **Step 2: Run the middleware test to verify it fails**

Run: `npm test -- src/middleware.test.ts`

Expected: FAIL because middleware does not append `app-total`.

- [ ] **Step 3: Measure only downstream application execution**

Make `onRequest` async. Preserve the early returns from origin protection;
for requests reaching `next()`, measure `await next()`, append `app-total`
through `appendServerTiming`, and return that same response. This includes all
Astro SSR work but excludes time before middleware, letting browser/network
measurements isolate platform and transport remainder.

- [ ] **Step 4: Document and changelog the feature**

Add one `[Unreleased]` entry describing the two runtime read caches,
event-version invalidation, proxy exclusion, 2 MB fallback and `app-total`.
Create the Spanish architecture note with the diagnosis, key shapes, lifecycle
rules, runtime/development adapter selection, consistency boundary and rollout
checks (cold/warm read plus create/edit/move/delete assertions).

- [ ] **Step 5: Run the full verification suite**

Run: `npm test && npm run build`

Expected: both commands exit 0. Inspect a deployed warm request’s
`Server-Timing`: `route-nanobook` and `document-lookup` should be in the
single-digit/mid-teens range; compare browser timing minus `app-total` to
quantify platform/network latency.

- [ ] **Step 6: Commit**

```bash
git add src/middleware.ts src/middleware.test.ts CHANGELOG.md src/content/nanobook-project/arquitectura/cache-lectura-runtime.md
git commit -m "docs(cache): document runtime read cache rollout"
```

## Execution handoff

This plan deliberately has two dependent cache layers and an event-driven
invalidation path; an incorrect cache write can expose stale visibility or
content. The recommended execution method is **Subagent-driven**, so each
task has an independent review before the next layer relies on its interfaces.
