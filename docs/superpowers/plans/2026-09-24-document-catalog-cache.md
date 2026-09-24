# Document Catalog Cache Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the `Document[]` cache policy out of `GitHubRepository` and into `DocumentModule` while preserving immediate reads after writes, parsed headings, TTL behavior, and concurrent-load deduplication.

**Architecture:** Add a `DocumentCatalogCache` port, an in-process implementation, and a `CachedContentRepository` decorator composed by `DocumentModule`. The GitHub adapter becomes responsible only for GitHub persistence and its API tree cache; direct writes update the catalog synchronously through the decorator, while publishing events continue to invalidate rendered HTML.

**Tech Stack:** TypeScript, Astro 7, Vitest 4, existing `Result` type and `ContentRepository` port.

**Spec:** `src/content/nanobook-project/arquitectura/cache-catalogo-documentos.md`

## Global Constraints

- Preserve the existing `ContentRepository` interface so application use cases and reference resolvers do not gain cache-specific dependencies.
- Enable the catalog cache initially only for `CONTENT_SOURCE=github`; filesystem and memory keep their current direct-read semantics.
- Keep the default catalog TTL at exactly `300_000` ms.
- Keep the GitHub tree cache and its in-flight request deduplication inside `GitHubRepository`.
- Do not use domain events to make the document catalog consistent after direct writes; cache synchronization must finish before `create()` or `update()` returns success.
- Do not add a runtime dependency.
- Preserve the project spelling `infraestructure` in paths.
- Use Conventional Commits and update `CHANGELOG.md` under `[Unreleased]`.
- Run `npm run build` successfully before every commit, as required by `AGENTS.md`.
- Preserve unrelated working-tree changes, especially `src/edition/ui/components/EditorToolbar.astro`.

## Review Focus

- A cache entry expiring between the initial read and an `insert`/`replace` must produce a cache miss and leave the next read able to reload the source.
- Two cold concurrent `list()` calls must trigger exactly one source load, and a failed load must allow a later retry.
- A failed GitHub `PUT` must leave the last valid catalog snapshot unchanged.
- An index document such as source ID `blog/index` must be rebuilt without raising `InvalidIndexDocumentError` after its normalized ID becomes `blog`.
- A successful create must not remain hidden by the GitHub tree cache when no document catalog snapshot existed at write time.

---

## File Structure

### New files

- `src/document/domain/ports/DocumentCatalogCache.ts` — cache contract owned by the document domain.
- `src/document/infraestructure/cache/InMemoryDocumentCatalogCache.ts` — in-process snapshot and TTL implementation.
- `src/document/infraestructure/cache/InMemoryDocumentCatalogCache.test.ts` — cache contract and expiry tests.
- `src/document/infraestructure/repository/CachedContentRepository.ts` — cache-aside decorator for any `ContentRepository`.
- `src/document/infraestructure/repository/CachedContentRepository.test.ts` — read, concurrency, write, parser, and failure tests.
- `src/document/DocumentModule.test.ts` — composition test proving that GitHub uses the decorator and filesystem does not.
- `src/document/infraestructure/repository/index.test.ts` — repository factory parser-injection test.
- `src/document/application/DocumentCatalogCache.integration.test.ts` — application-flow coverage through the decorator.

### Modified files

- `src/document/index.ts` — compose parser, source repository, cache, and decorator.
- `src/document/infraestructure/repository/index.ts` — accept an injected parser and expose the configured repository source.
- `src/document/infraestructure/repository/GitHubRepository.ts` — remove the `Document[]` cache and retain only GitHub tree concerns.
- `src/document/infraestructure/repository/GitHubRepository.test.ts` — test adapter behavior without catalog caching and tree invalidation after create.
- `src/content/nanobook-project/arquitectura/storage-adapters.md` — correct adapter responsibilities and current paths.
- `src/content/nanobook-project/arquitectura/sistema-de-cache.md` — describe the module-owned catalog cache.
- `src/content/nanobook-project/arquitectura/thundering-herd-github.md` — record that document-list deduplication moved to the decorator.
- `CHANGELOG.md` — record the architectural change under `[Unreleased]`.

---

### Task 1: Define and implement the document catalog cache

**Files:**
- Create: `src/document/domain/ports/DocumentCatalogCache.ts`
- Create: `src/document/infraestructure/cache/InMemoryDocumentCatalogCache.ts`
- Create: `src/document/infraestructure/cache/InMemoryDocumentCatalogCache.test.ts`

**Interfaces:**
- Consumes: `Document` from `src/document/domain/Document.ts`.
- Produces: `DocumentCatalogCache` with `get`, `set`, `insert`, `replace`, and `invalidate`.
- Produces: `InMemoryDocumentCatalogCache(ttlMs: number, now?: () => number)`.

- [ ] **Step 1: Add the cache port**

```typescript
import type { Document } from "../Document";

export interface DocumentCatalogCache {
  get(): Document[] | null;
  set(documents: Document[]): void;
  insert(document: Document): boolean;
  replace(document: Document): boolean;
  invalidate(): void;
}
```

- [ ] **Step 2: Write failing tests for snapshots, expiry, insertion, and replacement**

Create fixtures with literal IDs and metadata:

```typescript
const intro = Document.create(
  "intro",
  {
    title: "Original intro",
    description: "Introduction",
    date: new Date("2026-09-24T00:00:00.000Z"),
    author: "Nanobook",
    index: false,
  },
  "## Original\n"
).getValue();
```

Cover these behaviors:

```typescript
it("returns a copy of a live snapshot", () => {
  let now = 1_000;
  const cache = new InMemoryDocumentCatalogCache(300_000, () => now);
  cache.set([intro]);

  const first = cache.get();
  first?.pop();

  expect(cache.get()?.map((document) => document.getId().getValue()))
    .toEqual(["intro"]);
});

it("expires the snapshot at the TTL boundary", () => {
  let now = 1_000;
  const cache = new InMemoryDocumentCatalogCache(300_000, () => now);
  cache.set([intro]);
  now = 301_000;

  expect(cache.get()).toBeNull();
  expect(cache.replace(updatedIntro)).toBe(false);
});

it("inserts only into a live snapshot", () => {
  const cache = new InMemoryDocumentCatalogCache(300_000);
  expect(cache.insert(intro)).toBe(false);
  cache.set([]);
  expect(cache.insert(intro)).toBe(true);
  expect(cache.insert(intro)).toBe(false);
});

it("replaces an existing document by normalized id", () => {
  const cache = new InMemoryDocumentCatalogCache(300_000);
  cache.set([intro]);
  expect(cache.replace(updatedIntro)).toBe(true);
  expect(cache.get()?.[0].getTitle()).toBe("Updated intro");
});
```

- [ ] **Step 3: Run the cache test and confirm the missing implementation fails**

Run: `npm test -- src/document/infraestructure/cache/InMemoryDocumentCatalogCache.test.ts`

Expected: FAIL because the cache implementation does not exist.

- [ ] **Step 4: Implement the in-memory cache**

Use one nullable snapshot and keep TTL calculation inside the adapter:

```typescript
interface Snapshot {
  documents: Document[];
  expiresAt: number;
}

export class InMemoryDocumentCatalogCache implements DocumentCatalogCache {
  private snapshot: Snapshot | null = null;

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now
  ) {}

  get(): Document[] | null {
    if (!this.snapshot || this.snapshot.expiresAt <= this.now()) {
      this.snapshot = null;
      return null;
    }
    return [...this.snapshot.documents];
  }

  set(documents: Document[]): void {
    this.snapshot = {
      documents: [...documents],
      expiresAt: this.now() + this.ttlMs,
    };
  }

  insert(document: Document): boolean {
    const documents = this.get();
    if (!documents) return false;
    const id = document.getId().getValue();
    if (documents.some((item) => item.getId().getValue() === id)) return false;
    this.snapshot!.documents = [...documents, document];
    return true;
  }

  replace(document: Document): boolean {
    const documents = this.get();
    if (!documents) return false;
    const id = document.getId().getValue();
    const index = documents.findIndex(
      (item) => item.getId().getValue() === id
    );
    if (index === -1) return false;
    documents[index] = document;
    this.snapshot!.documents = documents;
    return true;
  }

  invalidate(): void {
    this.snapshot = null;
  }
}
```

Do not extend the expiry during `insert` or `replace`; a write updates content, not the lifetime of the snapshot originally loaded from the source.

- [ ] **Step 5: Run the focused tests**

Run: `npm test -- src/document/infraestructure/cache/InMemoryDocumentCatalogCache.test.ts`

Expected: PASS.

- [ ] **Step 6: Build and commit the cache contract**

Run: `npm run build`

```bash
git add src/document/domain/ports/DocumentCatalogCache.ts src/document/infraestructure/cache/InMemoryDocumentCatalogCache.ts src/document/infraestructure/cache/InMemoryDocumentCatalogCache.test.ts
git commit -m "feat(document): add catalog cache contract"
```

---

### Task 2: Add the cached repository decorator

**Files:**
- Create: `src/document/infraestructure/repository/CachedContentRepository.ts`
- Create: `src/document/infraestructure/repository/CachedContentRepository.test.ts`

**Interfaces:**
- Consumes: `ContentRepository`, `DocumentCatalogCache`, `DocumentParser`, and `createDocumentFromRaw`.
- Produces: `CachedContentRepository implements ContentRepository`.

- [ ] **Step 1: Write a failing cold-read and cache-hit test**

Use a real `InMemoryDocumentCatalogCache` and a source repository whose `list`
is a Vitest spy returning `Result.ok([intro])`:

```typescript
const first = await repository.list();
const second = await repository.list();

expect(first.getValue()).toEqual([intro]);
expect(second.getValue()).toEqual([intro]);
expect(source.list).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Add a failing concurrency and retry test**

Control a deferred source promise and prove that two simultaneous calls share it.
Then make a first source load return `Result.fail(new DocumentRepositoryError("boom"))`
and a second return `Result.ok([intro])`; assert two source calls and a successful retry.

```typescript
const first = repository.list();
const second = repository.list();
resolveSource(Result.ok([intro]));

expect(await first).toEqual(await second);
expect(source.list).toHaveBeenCalledTimes(1);
```

Add a second deferred case in which `list()` starts, a successful `update()`
finishes before that list resolves, and then the old list resolves. Assert that
the stale result is not stored and that the next `list()` starts a fresh source
load.

- [ ] **Step 3: Add failing tests for update consistency**

Cover all of the following in separate tests:

```typescript
it("replaces a cached document only after the source update succeeds", async () => {
  await repository.list();
  const result = await repository.update(updatedIntroWithoutParser);
  const cached = await repository.getById("intro");

  expect(result.isSuccess).toBe(true);
  expect(cached.getValue()?.getTitle()).toBe("Updated intro");
  expect(cached.getValue()?.getHeadings()).toEqual([
    { depth: 2, slug: "updated", text: "Updated" },
  ]);
});

it("keeps the previous snapshot when the source update fails", async () => {
  await repository.list();
  source.update.mockResolvedValue(
    Result.fail(new DocumentRepositoryError("PUT failed"))
  );

  await repository.update(updatedIntroWithoutParser);

  expect((await repository.getById("intro")).getValue()?.getTitle())
    .toBe("Original intro");
});

it("rebuilds a normalized index id using its source index id", async () => {
  await repository.list();
  await repository.update(updatedBlogIndex);

  expect((await repository.getById("blog")).getValue()?.getMetadata().index)
    .toBe(true);
});
```

The index fixture passed to `update` must expose normalized ID `blog` with
`metadata.index=true`; the decorator must use `blog/index` when rebuilding it.

- [ ] **Step 4: Add failing tests for create and cache-miss writes**

Assert that a confirmed create is inserted when a snapshot exists, a failed
create does not change it, and a write performed before the first `list()` does
not trigger `source.list()`.

- [ ] **Step 5: Run the decorator tests and confirm they fail**

Run: `npm test -- src/document/infraestructure/repository/CachedContentRepository.test.ts`

Expected: FAIL because `CachedContentRepository` does not exist.

- [ ] **Step 6: Implement cache-aside reads and in-flight deduplication**

Implement `list()` with an instance-level promise:

```typescript
private listPromise: Promise<
  Result<ContentRepositoryListError, Document[]>
> | null = null;
private generation = 0;

async list(): Promise<Result<ContentRepositoryListError, Document[]>> {
  const cached = this.cache.get();
  if (cached) return Result.ok(cached);

  if (!this.listPromise) {
    const generation = this.generation;
    const request = this.source.list()
      .then((result) => {
        if (result.isSuccess && generation === this.generation) {
          this.cache.set(result.getValue());
        }
        return result;
      })
      .finally(() => {
        if (this.listPromise === request) this.listPromise = null;
      });
    this.listPromise = request;
  }

  return this.listPromise;
}
```

Implement `getById` and `listChildren` by filtering the result of this `list()`;
do not delegate those methods directly to the source.

- [ ] **Step 7: Implement synchronous cache updates after confirmed writes**

Use one helper to restore the parser and handle index IDs:

```typescript
private rebuild(document: Document): Document | null {
  const id = document.getId().getValue();
  const sourceId = document.getMetadata().index && id !== "index"
    ? `${id}/index`
    : id;
  const result = createDocumentFromRaw(
    sourceId,
    document.getRawFrontmatter() + document.getContent(),
    this.parser
  );
  return result.isSuccess ? result.getValue() : null;
}
```

For both writes, call the source first and return immediately on failure. After
a confirmed write, increment `generation` and set `listPromise` to `null`; the
identity check in `finally` prevents an older request from clearing a newer one.
If `cache.get()` is `null`, return the successful source result without loading
the catalog. Otherwise rebuild the document and call `insert` or `replace`.
Invalidate when rebuilding fails or the cache mutation returns `false`.

- [ ] **Step 8: Run decorator and cache tests**

Run: `npm test -- src/document/infraestructure/repository/CachedContentRepository.test.ts src/document/infraestructure/cache/InMemoryDocumentCatalogCache.test.ts`

Expected: PASS.

- [ ] **Step 9: Build and commit the decorator**

Run: `npm run build`

```bash
git add src/document/infraestructure/repository/CachedContentRepository.ts src/document/infraestructure/repository/CachedContentRepository.test.ts
git commit -m "feat(document): cache repository catalog"
```

---

### Task 3: Compose the cache inside DocumentModule

**Files:**
- Modify: `src/document/infraestructure/repository/index.ts`
- Modify: `src/document/index.ts`
- Create: `src/document/DocumentModule.test.ts`

**Interfaces:**
- Consumes: `CachedContentRepository` and `InMemoryDocumentCatalogCache` from Tasks 1 and 2.
- Produces: `getConfiguredRepositorySource(): RepositorySource`.
- Produces: `CreateContentRepositoryOptions.parser?: DocumentParser`.
- Preserves: `DocumentModule.create(eventBus)` for existing callers.

- [ ] **Step 1: Write a failing factory test for parser injection**

Extend `CreateContentRepositoryOptions` with `parser?: DocumentParser`. Test that
the supplied parser is used by a filesystem repository fixture by loading one
Markdown document and asserting its literal heading result.

- [ ] **Step 2: Add the configured-source helper and parser injection**

In `src/document/infraestructure/repository/index.ts`, export:

```typescript
export function getConfiguredRepositorySource(): RepositorySource {
  const source = (CONTENT_SOURCE || "filesystem") as RepositorySource;
  if (!(["filesystem", "github", "memory"] as const).includes(source)) {
    throw new Error(`Unsupported content source: ${source}`);
  }
  return source;
}
```

Use `options.parser ?? new UnifiedDocumentParser()` when constructing filesystem
or GitHub repositories. Keep memory independent from the parser.

- [ ] **Step 3: Write a failing DocumentModule composition test**

Add optional construction inputs without changing the default caller:

```typescript
export interface DocumentModuleOptions {
  source?: RepositorySource;
  repository?: ContentRepository;
  parser?: DocumentParser;
  catalogCache?: DocumentCatalogCache;
}
```

The test injects a source repository, parser, and cache, creates the module with
`source: "github"`, executes `getAllDocuments` twice, and expects the source
`list()` spy to be called once. A second test uses `source: "filesystem"` without
an explicit cache and expects two source calls.

- [ ] **Step 4: Compose the decorator explicitly in DocumentModule**

Use this construction order in `DocumentModule.create`:

```typescript
const source = options.source ?? getConfiguredRepositorySource();
const parser = options.parser ?? new UnifiedDocumentParser();
const sourceRepository = options.repository
  ?? await createContentRepository({ source, parser });
const contentRepository = source === "github"
  ? new CachedContentRepository(
      sourceRepository,
      options.catalogCache
        ?? new InMemoryDocumentCatalogCache(300_000),
      parser
    )
  : sourceRepository;
```

Pass `contentRepository`, rather than `sourceRepository`, to
`InternalReferenceResolver`, `CreateDocument`, `UpdateDocument`,
`GetAllDocuments`, and `GetDocument`.

- [ ] **Step 5: Run module and repository-factory tests**

Run: `npm test -- src/document/DocumentModule.test.ts src/document/infraestructure/repository/index.test.ts`

Expected: PASS. `index.test.ts` is created in Step 1 for the parser-injection
case.

- [ ] **Step 6: Build and commit module composition**

Run: `npm run build`

```bash
git add src/document/index.ts src/document/DocumentModule.test.ts src/document/infraestructure/repository/index.ts src/document/infraestructure/repository/index.test.ts
git commit -m "refactor(document): own catalog cache in module"
```

---

### Task 4: Remove catalog caching from GitHubRepository

**Files:**
- Modify: `src/document/infraestructure/repository/GitHubRepository.ts`
- Modify: `src/document/infraestructure/repository/GitHubRepository.test.ts`

**Interfaces:**
- Consumes: unchanged GitHub API helpers and `withRedisClient`.
- Preserves: `GitHubRepository implements ContentRepository`.
- Removes: `GitHubRepositoryOptions.cacheTtl`, `globalCache`, `globalListPromises`, `clearCache`, and `updateCachedDocument`.
- Retains: `treeCacheTtl`, `globalTreePromises`, `treeCacheKey`, and Redis tree storage.

- [ ] **Step 1: Replace the current cache regression test with adapter-boundary tests**

Delete the assertion that `GitHubRepository` serves the updated document from
its own cache; Task 2 now owns that behavior. Add these tests:

```typescript
it("lists documents from GitHub on each direct adapter call", async () => {
  await repository.list();
  await repository.list();
  expect(rawDocumentFetches).toBe(2);
});

it("does not fetch the catalog after a confirmed update", async () => {
  const result = await repository.update(updated);
  expect(result.isSuccess).toBe(true);
  expect(treeFetches).toBe(0);
  expect(rawDocumentFetches).toBe(0);
});
```

Mock Redis as absent for the first test so the expectation measures the direct
adapter rather than the retained tree cache.

- [ ] **Step 2: Write a failing test for GitHub tree invalidation after create**

Mock `withRedisClient` with an in-memory key/value map. Prime the tree with an
initial `list()`, execute `create(newDocument)`, then call `list()` again. Assert
that the second tree request includes the new file fixture and that
`client.del(treeCacheKey)` occurred after the successful `PUT`.

Also add the negative case: when `updateFileContent` fails, the tree key must not
be deleted.

- [ ] **Step 3: Remove document-catalog state from GitHubRepository**

Delete:

Remove the `GitHubRepositoryCache` interface, the `globalCache` and
`globalListPromises` maps, the `cacheTtl` and `cacheKey` fields, and the
`updateCachedDocument` and `clearCache` methods.

Make `list()` a direct call:

```typescript
async list(): Promise<Result<ContentRepositoryListError, Document[]>> {
  return this.fetchDocuments();
}
```

Keep `getById` and `listChildren` correct for direct adapter use, even though the
module decorator normally serves them.

- [ ] **Step 4: Invalidate only the GitHub tree after a confirmed create**

Add this private method and call it after `updateFileContent` succeeds in
`create()`:

```typescript
private async invalidateTreeCache(): Promise<void> {
  globalTreePromises.delete(this.treeCacheKey);
  await withRedisClient(async (client) => {
    await client.del(this.treeCacheKey);
  });
}
```

Do not invalidate the tree after `update()`, because replacing an existing file
does not change the tree membership used by `filterContentFiles`.

- [ ] **Step 5: Protect the create/list concurrency edge**

Add a generation counter keyed by `treeCacheKey`:

```typescript
const globalTreeGenerations = new Map<string, number>();

private getTreeGeneration(): number {
  return globalTreeGenerations.get(this.treeCacheKey) ?? 0;
}

private incrementTreeGeneration(): void {
  globalTreeGenerations.set(
    this.treeCacheKey,
    this.getTreeGeneration() + 1
  );
}
```

Call `incrementTreeGeneration()` before deleting the promise and Redis key in
`invalidateTreeCache()`. In `doFetchTree()`, capture the generation before the
Redis read. Return a Redis hit only when that generation is still current. After
the GitHub request, write the tree to Redis only when the captured generation
still equals `getTreeGeneration()`.

Also make promise cleanup identity-safe:

```typescript
const request = this.doFetchTree().finally(() => {
  if (globalTreePromises.get(this.treeCacheKey) === request) {
    globalTreePromises.delete(this.treeCacheKey);
  }
});
globalTreePromises.set(this.treeCacheKey, request);
return request;
```

Test with a deferred tree request: start `list()`, confirm `create()`, resolve the
old request, and verify the next `list()` performs a fresh tree request.

- [ ] **Step 6: Run all document cache and GitHub adapter tests**

Run: `npm test -- src/document/infraestructure/cache/InMemoryDocumentCatalogCache.test.ts src/document/infraestructure/repository/CachedContentRepository.test.ts src/document/infraestructure/repository/GitHubRepository.test.ts src/document/DocumentModule.test.ts`

Expected: PASS.

- [ ] **Step 7: Build and commit the adapter cleanup**

Run: `npm run build`

```bash
git add src/document/infraestructure/repository/GitHubRepository.ts src/document/infraestructure/repository/GitHubRepository.test.ts
git commit -m "refactor(document): remove cache policy from github adapter"
```

---

### Task 5: Verify use-case behavior through the cached repository

**Files:**
- Create: `src/document/application/DocumentCatalogCache.integration.test.ts`

**Interfaces:**
- Consumes: `CachedContentRepository` and the existing use cases.
- Produces: regression coverage across the application-to-cache boundary.

- [ ] **Step 1: Add a cache-aware UpdateDocument integration test**

Construct a real `InMemoryRepository`, wrap it with
`CachedContentRepository`, and spy on the source `list()` method. Use an event
bus whose `publish` returns `Result.ok()` and a parser that returns a literal
heading from `## Updated`.

```typescript
await cachedRepository.list();
const result = await updateDocument.execute(updatedInput);
const cached = await cachedRepository.getById("guide/intro");

expect(result.isSuccess).toBe(true);
expect(cached.getValue()?.getTitle()).toBe("Updated title");
expect(cached.getValue()?.getHeadings()).toEqual([
  { depth: 2, slug: "updated", text: "Updated" },
]);
expect(sourceListSpy).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Run the new integration test and confirm the missing decorator fails**

Run: `npm test -- src/document/application/DocumentCatalogCache.integration.test.ts`

Expected before Tasks 1–4 are implemented: FAIL because the decorator is
missing. Expected when Task 5 starts: the update case PASS.

- [ ] **Step 3: Add a CreateDocument integration test using the decorator**

Prime a catalog containing the root index, execute `CreateDocument` for
`intro`, then call `cachedRepository.list()` directly. Assert that the result
contains both literal IDs `index` and `intro` and that the source list spy was
called only once.

- [ ] **Step 4: Run application and cache tests**

Run: `npm test -- src/document/application/DocumentCatalogCache.integration.test.ts src/document/infraestructure/repository/CachedContentRepository.test.ts`

Expected: PASS.

- [ ] **Step 5: Build and commit integration coverage**

Run: `npm run build`

```bash
git add src/document/application/DocumentCatalogCache.integration.test.ts
git commit -m "test(document): cover catalog cache write flow"
```

---

### Task 6: Update architecture documentation and perform final verification

**Files:**
- Modify: `src/content/nanobook-project/arquitectura/storage-adapters.md`
- Modify: `src/content/nanobook-project/arquitectura/sistema-de-cache.md`
- Modify: `src/content/nanobook-project/arquitectura/thundering-herd-github.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: final paths and behavior from Tasks 1–5.
- Produces: documentation matching the implemented ownership boundaries.

- [ ] **Step 1: Correct storage adapter documentation**

Replace obsolete paths such as
`src/document/adapters/repository/github-repository.ts` with
`src/document/infraestructure/repository/GitHubRepository.ts`. State that
adapters persist content and that `DocumentModule` decorates GitHub with the
catalog cache.

- [ ] **Step 2: Update the cache-system document**

Replace “GitHubRepository document cache” with “DocumentModule catalog cache”.
Document the 300.000 ms TTL, process-local scope, precise write synchronization,
and separation from the GitHub tree cache.

- [ ] **Step 3: Update the thundering-herd decision record**

Keep its historical diagnosis. Update the current-state section to say that
document-list in-flight deduplication now lives in `CachedContentRepository`,
while tree-request deduplication remains in `GitHubRepository`.

- [ ] **Step 4: Update the changelog**

Under `[Unreleased] / Changed`, replace the temporary statement that
`GitHubRepository.update()` updates its own cache with this final behavior:

```markdown
- El módulo `document` ahora gestiona la cache en memoria del catálogo mediante
  `CachedContentRepository`; los adaptadores de contenido se limitan a persistir
  documentos y `GitHubRepository` conserva únicamente la cache del árbol remoto.
```

- [ ] **Step 5: Run focused verification**

Run:

```bash
npm test -- src/document/infraestructure/cache/InMemoryDocumentCatalogCache.test.ts src/document/infraestructure/repository/CachedContentRepository.test.ts src/document/infraestructure/repository/GitHubRepository.test.ts src/document/infraestructure/repository/index.test.ts src/document/DocumentModule.test.ts src/document/application/DocumentCatalogCache.integration.test.ts
```

Expected: all listed files PASS.

- [ ] **Step 6: Run repository-wide verification and classify baseline failures**

Run: `npm test`

Expected for this branch: no new failure attributable to document catalog cache.
At the time this plan was written, the repository-wide command already included
unrelated failures from missing `edition` application files, stale domain-event
expectations, and tests under `.opencode/node_modules`; record the exact remaining
baseline rather than hiding it.

- [ ] **Step 7: Run the required build and inspect the final diff**

Run:

```bash
npm run build
git diff --check
git status --short
```

Expected: build succeeds, `git diff --check` reports no whitespace errors, and
the unrelated `EditorToolbar.astro` modification remains untouched.

- [ ] **Step 8: Commit documentation**

```bash
git add CHANGELOG.md src/content/nanobook-project/arquitectura/storage-adapters.md src/content/nanobook-project/arquitectura/sistema-de-cache.md src/content/nanobook-project/arquitectura/thundering-herd-github.md docs/superpowers/plans/2026-09-24-document-catalog-cache.md
git add -f src/content/nanobook-project/arquitectura/cache-catalogo-documentos.md
git commit -m "docs(document): document catalog cache ownership"
```

---

## Acceptance Criteria

- `GitHubRepository.ts` contains no `Document[]` cache, list TTL, list promise,
  `clearCache`, or per-document catalog replacement.
- `DocumentModule` explicitly composes the GitHub source repository with
  `CachedContentRepository` and a 300.000 ms in-memory cache.
- Two concurrent cold catalog reads generate one source `list()` operation.
- A successful update is visible on the next request without a new GitHub tree
  or Markdown fetch.
- A successful create is visible immediately when the catalog was already
  cached and invalidates the GitHub tree cache for later cold loads.
- Documents inserted or replaced in the cache retain their parser and headings.
- Index documents are rebuilt with a source ID ending in `/index` where needed.
- Failed source reads and writes never overwrite a valid cache snapshot.
- Focused tests and `npm run build` pass.
- Architecture docs and `[Unreleased]` describe the final responsibility split.
