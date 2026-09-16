# Edition DDD and Hexagonal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the browser edition workflow into testable domain/application layers behind browser adapters while preserving routes, HTTP contracts, session keys, and behavior.

**Architecture:** `edition/domain` owns pure draft and navigation rules plus application-facing ports. `edition/application` orchestrates the draft lifecycle, persistence, rendering, and document creation through those ports. `edition/infraestructure` contains browser and library integrations; Astro UI consumes a composed facade from `edition/index.ts` rather than importing effects directly.

**Tech Stack:** Astro 7, TypeScript, Vitest 4, CodeMirror 6, YAML, browser `sessionStorage`, `BroadcastChannel`, Fetch API, publishing worker.

**Spec:** `docs/superpowers/specs/2026-09-16-edition-ddd-hexagonal-design.md`

## Global Constraints

- Preserve `/new`, `/{slug}/edit`, `/{slug}/preview`, and public document routes with their current payloads.
- Preserve the session keys `stagedDocument`, `stagedDocumentSavedAt`, `renderedStagedDocument`, `renderedStagedDocumentSource`, and `renderPendingDocument` during this migration.
- `edition/domain` and `edition/application` must not import Astro, DOM APIs, `fetch`, `sessionStorage`, CodeMirror, the render worker, or YAML.
- `document` remains authoritative for validation and persistence; `publishing` remains authoritative for published-page rendering and invalidation.
- Do not overwrite the pre-existing live-preview worktree changes; integrate them when migrating their current imports.
- Use TDD for every production behavior: run the added test red before its implementation and green after it.
- Before every commit run `npm run build`, then commit with Conventional Commits; add the architecture decision to `CHANGELOG.md` under `[Unreleased]`.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `src/edition/domain/EditionDraft.ts` | Pure reconstruction and equality rules for a serialized draft. |
| `src/edition/domain/EditionFlow.ts` | Pure same-document route membership rule. |
| `src/edition/domain/ports/*.ts` | Application needs for draft storage, rendering, document writes, and warming. |
| `src/edition/application/*.ts` | One use case per edition workflow operation. |
| `src/edition/infraestructure/storage/SessionStorageDraftStore.ts` | Browser implementation retaining all existing storage keys. |
| `src/edition/infraestructure/render/WorkerEditionRenderer.ts` | Browser worker/cache/channel rendering adapter. |
| `src/edition/infraestructure/api/HttpDocumentWriter.ts` | HTTP implementation of document create/update. |
| `src/edition/infraestructure/navigation/BrowserPageWarmer.ts` | Non-blocking page warming implementation. |
| `src/edition/infraestructure/parse/YamlDraftParser.ts` | YAML-to-frontmatter parse adapter. |
| `src/edition/infraestructure/editor/CodeMirrorEditor.ts` | CodeMirror implementation moved out of UI orchestration. |
| `src/edition/index.ts` | Browser composition root and UI-facing `EditionFacade`. |
| `src/edition/ui/**/*.astro` | Event binding and status presentation only. |
| `src/content/nanobook-project/arquitectura/edition-ddd-hexagonal.md` | Persistent project decision record. |

## Task 1: Establish Pure Edition Domain Rules and Ports

**Files:**
- Create: `src/edition/domain/EditionDraft.ts`
- Create: `src/edition/domain/EditionDraft.test.ts`
- Create: `src/edition/domain/EditionFlow.ts`
- Create: `src/edition/domain/EditionFlow.test.ts`
- Create: `src/edition/domain/ports/DraftStore.ts`
- Create: `src/edition/domain/ports/EditionRenderer.ts`
- Create: `src/edition/domain/ports/DocumentWriter.ts`
- Create: `src/edition/domain/ports/PageWarmer.ts`

**Interfaces:**
- Consumes: `SerializedEntry`, `SerializedDocumentMetadata`, `CreateDocumentRequest`, and `RenderedDocument` from existing document/publishing DTOs.
- Produces: `buildEditionDraft(base, source, parser)`, `sameEditionDraft(left, right)`, `isInsideEditionFlow(url, documentId)`, and the four port interfaces used in Tasks 2–5.

- [ ] **Step 1: Write the failing domain tests**

```ts
it("preserves the base metadata while replacing frontmatter and body", () => {
  const result = buildEditionDraft(baseDocument, "---\ntitle: Nuevo\ndate: 2026-09-16\n---\n# Cuerpo", parser);

  expect(result.title).toBe("Nuevo");
  expect(result.metadata.date).toBe("2026-09-16T00:00:00.000Z");
  expect(result.content).toBe("# Cuerpo");
  expect(result.metadata.index).toBe(baseDocument.metadata.index);
});

it("does not treat documents with a distinct revision as equal", () => {
  expect(sameEditionDraft(baseDocument, { ...baseDocument, content: "new" })).toBe(false);
});

it("keeps view, edit, and preview of the same document inside the flow", () => {
  expect(isInsideEditionFlow(new URL("https://book.test/guides/cache/preview"), "guides/cache")).toBe(true);
  expect(isInsideEditionFlow(new URL("https://book.test/guides/other"), "guides/cache")).toBe(false);
});
```

- [ ] **Step 2: Run the new tests and verify the expected red state**

Run: `npm test -- src/edition/domain/EditionDraft.test.ts src/edition/domain/EditionFlow.test.ts`

Expected: FAIL because the domain modules do not yet exist.

- [ ] **Step 3: Implement the minimal pure rules and ports**

```ts
export interface DraftParser {
  parse(source: string): Partial<SerializedDocumentMetadata>;
  removeFrontmatter(source: string): { rawFrontmatter: string; content: string };
}

export function buildEditionDraft(base: SerializedEntry, source: string, parser: DraftParser): SerializedEntry {
  const { rawFrontmatter, content } = parser.removeFrontmatter(source);
  const data = parser.parse(rawFrontmatter);
  const date = data.date instanceof Date ? data.date.toISOString() : data.date ?? base.metadata.date;
  return { ...base, metadata: { ...base.metadata, ...data, date }, content, rawFrontmatter };
}

export function sameEditionDraft(left: SerializedEntry, right: SerializedEntry): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
```

Implement `isInsideEditionFlow` with the existing `index` and nested-document route semantics. Define ports as TypeScript interfaces only; no browser imports are permitted.

- [ ] **Step 4: Run the domain tests and verify green**

Run: `npm test -- src/edition/domain/EditionDraft.test.ts src/edition/domain/EditionFlow.test.ts`

Expected: PASS with three assertions describing reconstruction, equality, and navigation behavior.

- [ ] **Step 5: Build and commit the isolated domain layer**

Run: `npm run build`

```bash
git add src/edition/domain
git commit -m "refactor(edition): add domain rules and ports"
```

## Task 2: Add Draft Lifecycle Application Services

**Files:**
- Create: `src/edition/application/PrepareEdition.ts`
- Create: `src/edition/application/PrepareEdition.test.ts`
- Create: `src/edition/application/UpdateDraft.ts`
- Create: `src/edition/application/UpdateDraft.test.ts`

**Interfaces:**
- Consumes: `DraftStore`, `EditionRenderer`, `DraftParser`, `buildEditionDraft`, and `sameEditionDraft` from Task 1.
- Produces: `PrepareEdition.execute(base)` returning the valid draft and `UpdateDraft.execute(base, source)` returning the newly staged draft.

- [ ] **Step 1: Write failing use-case tests using in-memory ports**

```ts
it("restores the staged draft only when it belongs to the opened document", () => {
  const store = new MemoryDraftStore({ ...baseDocument, id: "other" });
  const result = new PrepareEdition(store).execute(baseDocument);

  expect(result).toEqual(baseDocument);
  expect(store.saved).toEqual(baseDocument);
});

it("stages an edited draft, clears its saved mark, and renders it", async () => {
  const update = new UpdateDraft(store, renderer, parser);
  const draft = await update.execute(baseDocument, "---\ntitle: Nuevo\n---\n# Texto");

  expect(store.saved).toEqual(draft);
  expect(store.savedMarkCleared).toBe(true);
  expect(renderer.requests).toEqual([draft]);
});
```

- [ ] **Step 2: Run the use-case tests and verify red**

Run: `npm test -- src/edition/application/PrepareEdition.test.ts src/edition/application/UpdateDraft.test.ts`

Expected: FAIL because neither use case exists.

- [ ] **Step 3: Implement minimal lifecycle orchestration**

```ts
export class PrepareEdition {
  constructor(private readonly store: DraftStore) {}

  execute(base: SerializedEntry): SerializedEntry {
    const staged = this.store.load();
    if (staged?.id === base.id) return staged;
    this.store.save(base);
    return base;
  }
}

export class UpdateDraft {
  constructor(private readonly store: DraftStore, private readonly renderer: EditionRenderer, private readonly parser: DraftParser) {}

  async execute(base: SerializedEntry, source: string): Promise<SerializedEntry> {
    const draft = buildEditionDraft(base, source, this.parser);
    this.store.save(draft);
    this.store.clearSavedMark();
    await this.renderer.render(draft);
    return draft;
  }
}
```

- [ ] **Step 4: Run the application tests and verify green**

Run: `npm test -- src/edition/application/PrepareEdition.test.ts src/edition/application/UpdateDraft.test.ts`

Expected: PASS; the tests use in-memory ports and no browser global.

- [ ] **Step 5: Build and commit the draft lifecycle**

Run: `npm run build`

```bash
git add src/edition/application/PrepareEdition.ts src/edition/application/PrepareEdition.test.ts src/edition/application/UpdateDraft.ts src/edition/application/UpdateDraft.test.ts
git commit -m "refactor(edition): extract draft lifecycle use cases"
```

## Task 3: Add Save, Render, Creation, and Exit Use Cases

**Files:**
- Create: `src/edition/application/RenderEdition.ts`
- Create: `src/edition/application/RenderEdition.test.ts`
- Create: `src/edition/application/SaveEdition.ts`
- Create: `src/edition/application/SaveEdition.test.ts`
- Create: `src/edition/application/CreateEditionDocument.ts`
- Create: `src/edition/application/CreateEditionDocument.test.ts`
- Create: `src/edition/application/LeaveEdition.ts`
- Create: `src/edition/application/LeaveEdition.test.ts`

**Interfaces:**
- Consumes: Task 1 ports and `isInsideEditionFlow`; Task 2's `DraftParser` and draft-building behavior.
- Produces: explicit save/render/create/leave operations used by the facade in Task 5.

- [ ] **Step 1: Write failing tests for each boundary condition**

```ts
it("marks a draft saved only after the writer resolves", async () => {
  const writer = new DeferredWriter();
  const save = new SaveEdition(store, writer, renderer, parser, warmer);
  const pending = save.execute(baseDocument, "# Saved");
  expect(store.savedAt()).toBeNull();
  writer.resolve();
  await pending;
  expect(store.savedAt()).not.toBeNull();
});

it("returns cached render only when its source matches the request", async () => {
  renderer.cachedSource = { ...baseDocument, content: "old" };
  renderer.cached = { Content: "<p>old</p>" };
  await new RenderEdition(store, renderer).execute(baseDocument);
  expect(renderer.requests).toEqual([baseDocument]);
});

it("creates an index document below the selected directory", async () => {
  const id = await new CreateEditionDocument(writer).execute("directory", "guide", metadata, "docs/");
  expect(id).toBe("docs/guide/index");
});

it("clears draft and renderer only when the destination leaves its document flow", () => {
  new LeaveEdition(store, renderer).execute(new URL("https://book.test/other"), "guide");
  expect(store.cleared).toBe(true);
  expect(renderer.cleared).toBe(true);
});
```

- [ ] **Step 2: Run the tests and verify red**

Run: `npm test -- src/edition/application/RenderEdition.test.ts src/edition/application/SaveEdition.test.ts src/edition/application/CreateEditionDocument.test.ts src/edition/application/LeaveEdition.test.ts`

Expected: FAIL because these use cases are missing.

- [ ] **Step 3: Implement minimal cases of use**

```ts
export class SaveEdition {
  constructor(private readonly store: DraftStore, private readonly writer: DocumentWriter, private readonly renderer: EditionRenderer, private readonly parser: DraftParser, private readonly warmer: PageWarmer) {}

  async execute(base: SerializedEntry, source: string, viewHref?: string): Promise<SerializedEntry> {
    const draft = buildEditionDraft(base, source, this.parser);
    await this.writer.update(draft.id, draft);
    this.store.save(draft);
    this.store.markSaved();
    if (viewHref) void this.warmer.warm(viewHref);
    await this.renderer.render(draft);
    return draft;
  }
}
```

Implement `RenderEdition` with same-source reuse and renderer delegation, `CreateEditionDocument` with the exact current id rules for `document` and `directory`, and `LeaveEdition` by delegating to `isInsideEditionFlow`.

- [ ] **Step 4: Run the use-case tests and verify green**

Run: `npm test -- src/edition/application/RenderEdition.test.ts src/edition/application/SaveEdition.test.ts src/edition/application/CreateEditionDocument.test.ts src/edition/application/LeaveEdition.test.ts`

Expected: PASS, including confirmation ordering and stale-render protection.

- [ ] **Step 5: Build and commit the remaining application layer**

Run: `npm run build`

```bash
git add src/edition/application
git commit -m "refactor(edition): extract save and navigation use cases"
```

## Task 4: Implement Browser and Library Adapters

**Files:**
- Create: `src/edition/infraestructure/storage/SessionStorageDraftStore.ts`
- Create: `src/edition/infraestructure/storage/SessionStorageDraftStore.test.ts`
- Create: `src/edition/infraestructure/render/WorkerEditionRenderer.ts`
- Create: `src/edition/infraestructure/render/WorkerEditionRenderer.test.ts`
- Create: `src/edition/infraestructure/api/HttpDocumentWriter.ts`
- Create: `src/edition/infraestructure/api/HttpDocumentWriter.test.ts`
- Create: `src/edition/infraestructure/navigation/BrowserPageWarmer.ts`
- Create: `src/edition/infraestructure/navigation/BrowserPageWarmer.test.ts`
- Create: `src/edition/infraestructure/parse/YamlDraftParser.ts`
- Create: `src/edition/infraestructure/editor/CodeMirrorEditor.ts`

**Interfaces:**
- Consumes: all port interfaces from Task 1; existing worker export from `src/publishing/client/workers`; existing `SerializedEntry` DTO.
- Produces: production implementations passed to the composition root in Task 5.

- [ ] **Step 1: Write failing adapter contract tests**

```ts
it("uses the legacy session keys for staged data and its saved timestamp", () => {
  const storage = new MemoryStorage();
  const store = new SessionStorageDraftStore(storage);
  store.save(baseDocument);
  store.markSaved();

  expect(storage.getItem("stagedDocument")).toContain('"id":"guides/cache"');
  expect(Number(storage.getItem("stagedDocumentSavedAt"))).toBeGreaterThan(0);
});

it("sends the serialized document to its PATCH endpoint", async () => {
  await writer.update("guides/cache", baseDocument);
  expect(fetchPage).toHaveBeenCalledWith("/api/guides/cache", expect.objectContaining({ method: "PATCH" }));
});

it("absorbs a page warming failure", async () => {
  await expect(new BrowserPageWarmer(rejectingFetch).warm("/guides/cache")).resolves.toBeUndefined();
});
```

- [ ] **Step 2: Run adapter tests and verify red**

Run: `npm test -- src/edition/infraestructure/storage/SessionStorageDraftStore.test.ts src/edition/infraestructure/api/HttpDocumentWriter.test.ts src/edition/infraestructure/navigation/BrowserPageWarmer.test.ts src/edition/infraestructure/render/WorkerEditionRenderer.test.ts`

Expected: FAIL because adapters are missing.

- [ ] **Step 3: Implement minimal adapters retaining browser behavior**

```ts
export class SessionStorageDraftStore implements DraftStore {
  constructor(private readonly storage: Storage = sessionStorage, private readonly now: () => number = Date.now) {}

  load(): SerializedEntry | null { return readJson<SerializedEntry>(this.storage, "stagedDocument"); }
  save(document: SerializedEntry): void { writeJson(this.storage, "stagedDocument", document); }
  markSaved(): void { this.storage.setItem("stagedDocumentSavedAt", String(this.now())); }
  clearSavedMark(): void { this.storage.removeItem("stagedDocumentSavedAt"); }
  savedAt(): number | null { return readTimestamp(this.storage, "stagedDocumentSavedAt"); }
  clear(): void { this.storage.removeItem("stagedDocument"); this.clearSavedMark(); }
}
```

Move the existing worker cache/pending/channel behavior into `WorkerEditionRenderer`, the existing request serialization into `HttpDocumentWriter`, `warmDocumentPage` behavior into `BrowserPageWarmer`, YAML parsing into `YamlDraftParser`, and CodeMirror creation into `CodeMirrorEditor`.

- [ ] **Step 4: Run adapter tests and legacy focused tests**

Run: `npm test -- src/edition/infraestructure/storage/SessionStorageDraftStore.test.ts src/edition/infraestructure/api/HttpDocumentWriter.test.ts src/edition/infraestructure/navigation/BrowserPageWarmer.test.ts src/edition/infraestructure/render/WorkerEditionRenderer.test.ts src/edition/client/confirmed-render.test.ts src/edition/client/warm-document-page.test.ts`

Expected: PASS; no stored-key or HTTP request contract changes.

- [ ] **Step 5: Build and commit the adapters**

Run: `npm run build`

```bash
git add src/edition/infraestructure
git commit -m "refactor(edition): move browser integrations to adapters"
```

## Task 5: Compose the Facade and Migrate Astro UI

**Files:**
- Create: `src/edition/index.ts`
- Create: `src/edition/index.test.ts`
- Modify: `src/edition/ui/components/DocumentEditor/DocumentEditor.astro`
- Modify: `src/edition/ui/pages/NewPage.astro`
- Modify: `src/edition/ui/pages/PreviewPage.astro`
- Modify: `src/pages/[...slug]/index.astro`
- Delete only after consumer migration: `src/edition/client/create-document.ts`, `src/edition/client/update-document.ts`, `src/edition/client/stage-document.ts`, `src/edition/client/parse-staged-document.ts`, `src/edition/client/render-service.ts`, `src/edition/client/document-flow.ts`, `src/edition/client/code-mirror-editor.ts`, `src/edition/client/warm-document-page.ts`

**Interfaces:**
- Consumes: all completed use cases and adapters from Tasks 1–4.
- Produces: `createEditionFacade()` exposing `prepare`, `update`, `save`, `create`, `leave`, `rendered`, `renderedSource`, and `createEditor` to UI scripts.

- [ ] **Step 1: Write a failing facade integration test**

```ts
it("composes editing dependencies without browser imports in application modules", async () => {
  const facade = createEditionFacade({ storage, fetchPage, rendererWorker, channel, parser, now });
  const draft = await facade.update(baseDocument, "# Draft");

  expect(storage.getItem("stagedDocument")).toContain('"content":"# Draft"');
  expect(rendererWorker.render).toHaveBeenCalledWith(draft);
});
```

- [ ] **Step 2: Run the facade test and verify red**

Run: `npm test -- src/edition/index.test.ts`

Expected: FAIL because the composition root is missing.

- [ ] **Step 3: Implement the facade and replace direct effect imports**

```ts
export function createEditionFacade(dependencies: EditionBrowserDependencies = browserDependencies()): EditionFacade {
  const store = new SessionStorageDraftStore(dependencies.storage, dependencies.now);
  const renderer = new WorkerEditionRenderer(dependencies.worker, dependencies.storage, dependencies.channel);
  const writer = new HttpDocumentWriter(dependencies.fetchPage);
  const parser = new YamlDraftParser();
  const warmer = new BrowserPageWarmer(dependencies.fetchPage);
  return { prepare: new PrepareEdition(store), update: new UpdateDraft(store, renderer, parser), save: new SaveEdition(store, writer, renderer, parser, warmer), create: new CreateEditionDocument(writer), leave: new LeaveEdition(store, renderer), rendered: () => renderer.rendered(), renderedSource: () => renderer.renderedSource(), createEditor: createCodeMirrorEditor };
}
```

In each Astro script, obtain the facade once and replace direct calls to the retired client modules. Keep UI-local concerns in the components: DOM querying, event subscription, debounce, button/status copy, navigation, and cleanup of the CodeMirror instance. Preserve the live-preview changes currently in the worktree and update their imports to the facade.

- [ ] **Step 4: Run facade, edition, and full test suites**

Run: `npm test -- src/edition/index.test.ts src/edition`

Run: `npm test`

Expected: PASS; no tests retain imports from a removed `src/edition/client/*` module.

- [ ] **Step 5: Build and commit the UI migration**

Run: `npm run build`

```bash
git add src/edition src/pages/[...slug]/index.astro src/edition/ui
git commit -m "refactor(edition): compose browser editing facade"
```

## Task 6: Record the Decision and Final Regression Verification

**Files:**
- Create: `src/content/nanobook-project/arquitectura/edition-ddd-hexagonal.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: the stable post-migration module boundary from Tasks 1–5.
- Produces: project documentation explaining ownership, dependency direction, and browser adapter boundaries.

- [ ] **Step 1: Write the documentation and changelog entry**

```md
## Edition como módulo hexagonal

`edition/domain` contiene reglas puras y puertos; `edition/application` coordina sus casos de uso; `edition/infraestructure` implementa dependencias de navegador. Los componentes Astro no llaman a `fetch`, `sessionStorage`, workers ni YAML directamente.

El módulo `document` sigue validando y persistiendo documentos. `publishing` sigue renderizando e invalidando páginas publicadas.
```

Add an `[Unreleased]` `Changed` entry in `CHANGELOG.md` naming the new `domain`, `application`, `infraestructure`, and facade boundaries.

- [ ] **Step 2: Run a final architecture-boundary scan**

Run: `rg -n "sessionStorage|BroadcastChannel|fetch\(|worker\.render|from \"yaml\"|from 'yaml'" src/edition/domain src/edition/application`

Expected: no matches. Any match means move that effect behind a port or adapter before continuing.

- [ ] **Step 3: Run the complete verification suite**

Run: `npm test`

Run: `npm run build`

Expected: both commands exit 0. Record any pre-existing Astro warnings separately; do not treat them as test failures.

- [ ] **Step 4: Commit documentation and final verification result**

```bash
git add src/content/nanobook-project/arquitectura/edition-ddd-hexagonal.md CHANGELOG.md
git commit -m "docs(edition): record hexagonal boundaries"
```

## Plan Self-Review

- Spec coverage: Tasks 1–3 implement domain, ports, and every named application workflow; Task 4 supplies storage, rendering, HTTP, page warming, YAML, and CodeMirror adapters; Task 5 moves UI orchestration to a composition root while preserving routes and session keys; Task 6 records the decision and verifies boundaries.
- Placeholder scan: no `TBD`, `TODO`, deferred implementation wording, or unnamed test work remains.
- Type consistency: all use cases consume Task 1 ports; only Task 4 implements those ports; Task 5 owns production composition and is the sole UI integration point.
