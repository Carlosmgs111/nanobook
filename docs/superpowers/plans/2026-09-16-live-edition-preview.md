# Live Edition Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fast side-by-side Markdown preview whose state is revision-safe, while refactoring `edition` into a hexagonal module and sharing render semantics with published pages.

**Architecture:** Markdown and frontmatter remain the persisted source of truth. `edition` models an immutable revision and session in pure code, with application services consuming ports for draft persistence, preview rendering, source parsing, and document publication. Browser APIs are isolated in adapters; the preview and server publication use the shared `rendering` contract.

**Tech Stack:** Astro 7, TypeScript, Vitest, CodeMirror, Unified/Remark/Rehype, Shiki, Zod, browser Web Workers, sessionStorage.

**Spec:** `docs/superpowers/specs/2026-09-16-live-edition-preview-design.md`

## Global Constraints

- Markdown plus YAML frontmatter is the only persisted document format.
- Keep the existing `PATCH /api/[...slug]` API contract during this phase.
- `edition/model` and `edition/application` must not import Astro, DOM APIs, `fetch`, `Worker`, `sessionStorage`, or UI files.
- Preview results are applied only when their `revisionId` matches the session draft revision.
- Reuse the same GFM, heading-slug, and Shiki configuration for server and worker render paths.
- Do not add directives, block editing, plugin loading, MDX/JSX execution, or collaboration in this plan.
- Use Conventional Commits; run `npm run build` before each commit.
- Record the architectural decision in `src/content/nanobook-project/` once the code is complete.

---

## File structure

```text
src/
  edition/
    model/
      EditionRevision.ts
      EditionSession.ts
      EditionDocument.ts
      ports/
        DraftStore.ts
        PreviewRenderer.ts
        DocumentPublisher.ts
        DocumentSourceParser.ts
    application/
      UpdateDraft.ts
      RenderPreview.ts
      SaveDocument.ts
    adapters/client/
      SessionStorageDraftStore.ts
      WorkerPreviewRenderer.ts
      HttpDocumentPublisher.ts
      YamlDocumentSourceParser.ts
    client/
      createEditionWorkspace.ts
    ui/components/
      EditionWorkspace.astro
      LivePreview.astro
      DocumentEditor/DocumentEditor.astro
  rendering/
    model/
      RenderRequest.ts
      RenderResult.ts
    markdown/
      createMarkdownPipeline.ts
      renderMarkdown.ts
      renderConfig.ts
    client/workers/
      render.ts
```

## Task 1: Model immutable revisions and session transitions

**Files:**
- Create: `src/edition/model/EditionDocument.ts`
- Create: `src/edition/model/EditionRevision.ts`
- Create: `src/edition/model/EditionSession.ts`
- Test: `src/edition/model/EditionSession.test.ts`

**Interfaces:**
- Produces `EditionDocument`, `EditionRevision`, `EditionSession`, `createRevision`, `createSession`, `replaceDraft`, `beginRender`, `acceptPreview`, `beginSave`, `markSaved`, and `markSaveFailed`.
- `acceptPreview` must leave session unchanged when the result revision differs from `session.draft.id`.

- [ ] **Step 1: Write the failing revision-order test**

```ts
it("ignores a preview result from an older revision", () => {
  const first = createRevision({ documentId: "blog/post", source: "# First", now: 1, id: "r1" });
  const second = createRevision({ documentId: "blog/post", source: "# Second", now: 2, id: "r2" });
  const session = replaceDraft(createSession(first), second);

  expect(acceptPreview(session, { revisionId: "r1", html: "<h1>First</h1>" }))
    .toEqual(session);
});
```

- [ ] **Step 2: Run the model test and verify it fails**

Run: `npm test -- src/edition/model/EditionSession.test.ts`

Expected: FAIL because the model functions do not exist.

- [ ] **Step 3: Implement the pure model**

```ts
export interface EditionRevision {
  id: string;
  documentId: string;
  source: string;
  contentHash: string;
  createdAt: number;
}

export function acceptPreview(
  session: EditionSession,
  result: PreviewResult
): EditionSession {
  if (result.revisionId !== session.draft.id) return session;
  return { ...session, preview: result, renderStatus: "ready" };
}
```

Use the existing hashing utility or add a deterministic SHA-256 helper under `src/shared/utils/`; do not use `JSON.stringify` as a revision identity.

- [ ] **Step 4: Add save-state tests**

Cover `beginSave`, successful `markSaved` for the current revision, and rejection of a save result for an older revision.

- [ ] **Step 5: Run model tests**

Run: `npm test -- src/edition/model/EditionSession.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/edition/model
git commit -m "feat(edition): add revision-safe session model"
```

## Task 2: Define edition ports and application services

**Files:**
- Create: `src/edition/model/ports/DraftStore.ts`
- Create: `src/edition/model/ports/PreviewRenderer.ts`
- Create: `src/edition/model/ports/DocumentPublisher.ts`
- Create: `src/edition/model/ports/DocumentSourceParser.ts`
- Create: `src/edition/application/UpdateDraft.ts`
- Create: `src/edition/application/RenderPreview.ts`
- Create: `src/edition/application/SaveDocument.ts`
- Test: `src/edition/application/RenderPreview.test.ts`
- Test: `src/edition/application/SaveDocument.test.ts`

**Interfaces:**
- Consumes Task 1 model types.
- `DocumentSourceParser.parse(base: EditionDocument, source: string): EditionDocument` reconstructs title, metadata, frontmatter, and body from source.
- `RenderPreview.execute(session)` persists the current draft, calls `PreviewRenderer`, and applies only its matching result.
- `SaveDocument.execute(session)` parses the current source, publishes it, and marks only that revision saved.

- [ ] **Step 1: Write a failing stale-result service test**

```ts
it("does not overwrite a newer draft when rendering completes late", async () => {
  const renderer = deferredPreviewRenderer();
  const service = new RenderPreview(renderer, draftStore);
  const pending = service.execute(sessionWithRevision("r1"));
  const next = replaceDraft(sessionWithRevision("r1"), revision("r2"));

  renderer.resolve({ revisionId: "r1", html: "old" });
  expect(await pending).toEqual(next);
});
```

- [ ] **Step 2: Run the application test and verify it fails**

Run: `npm test -- src/edition/application/RenderPreview.test.ts`

Expected: FAIL because `RenderPreview` is not implemented.

- [ ] **Step 3: Implement ports and `UpdateDraft`**

```ts
export interface PreviewRenderer {
  render(revision: EditionRevision): Promise<PreviewResult>;
}

export class UpdateDraft {
  execute(session: EditionSession, source: string, now: number): EditionSession {
    return replaceDraft(session, createRevision({
      documentId: session.documentId,
      source,
      now,
      id: crypto.randomUUID(),
    }));
  }
}
```

Inject a revision-id factory in production code rather than relying on browser globals in the application layer.

- [ ] **Step 4: Implement `RenderPreview` and `SaveDocument`**

`RenderPreview` must persist the new draft before rendering and return a session with a matching preview only. `SaveDocument` must call `DocumentSourceParser` before `DocumentPublisher`, then call `markSaved` with the published revision id.

- [ ] **Step 5: Add save mapping test**

Assert that a revision containing updated frontmatter reaches `DocumentPublisher` as the parsed `EditionDocument`, not as stale base metadata.

- [ ] **Step 6: Run application tests**

Run: `npm test -- src/edition/application/RenderPreview.test.ts src/edition/application/SaveDocument.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/edition/model/ports src/edition/application
git commit -m "feat(edition): add editing application services"
```

## Task 3: Isolate browser behavior in client adapters

**Files:**
- Create: `src/edition/adapters/client/SessionStorageDraftStore.ts`
- Create: `src/edition/adapters/client/WorkerPreviewRenderer.ts`
- Create: `src/edition/adapters/client/HttpDocumentPublisher.ts`
- Create: `src/edition/adapters/client/YamlDocumentSourceParser.ts`
- Create: `src/edition/client/createEditionWorkspace.ts`
- Modify: `src/edition/client/parse-staged-document.ts`
- Modify: `src/edition/client/update-document.ts`
- Test: `src/edition/adapters/client/YamlDocumentSourceParser.test.ts`
- Test: `src/edition/adapters/client/HttpDocumentPublisher.test.ts`

**Interfaces:**
- Implements all Task 2 ports.
- The session-storage key format is `nanobook:edition:<documentId>:draft`.
- `WorkerPreviewRenderer` sends a `RenderRequest` containing `revisionId` and `source` and resolves the matching response only.

- [ ] **Step 1: Write a failing frontmatter-parser test**

```ts
it("preserves base metadata and applies frontmatter changes", () => {
  const document = parser.parse(baseDocument, "---\ntitle: Updated\n---\n# Body");

  expect(document.metadata.title).toBe("Updated");
  expect(document.content).toBe("# Body");
});
```

- [ ] **Step 2: Run the parser test and verify it fails**

Run: `npm test -- src/edition/adapters/client/YamlDocumentSourceParser.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement the adapters**

Move the YAML/frontmatter logic from `parse-staged-document.ts` into `YamlDocumentSourceParser`. Move request mapping from `update-document.ts` into `HttpDocumentPublisher`. The legacy files may re-export adapter behavior temporarily, but must not duplicate it.

- [ ] **Step 4: Write and run publisher request test**

```ts
expect(fetch).toHaveBeenCalledWith("/api/blog/post", expect.objectContaining({
  method: "PATCH",
  body: expect.stringContaining('"title":"Updated"'),
}));
```

Run: `npm test -- src/edition/adapters/client/HttpDocumentPublisher.test.ts`

Expected: PASS.

- [ ] **Step 5: Build the client composition factory**

`createEditionWorkspace(baseDocument)` creates the four adapters and three application services, restores only a draft whose `documentId` matches, and exposes `updateSource`, `render`, `save`, `getSession`, and `subscribe` methods for UI code.

- [ ] **Step 6: Commit**

```bash
git add src/edition/adapters src/edition/client
git commit -m "refactor(edition): isolate browser adapters"
```

## Task 4: Extract a shared Markdown rendering contract

**Files:**
- Create: `src/rendering/model/RenderRequest.ts`
- Create: `src/rendering/model/RenderResult.ts`
- Create: `src/rendering/markdown/renderConfig.ts`
- Create: `src/rendering/markdown/createMarkdownPipeline.ts`
- Create: `src/rendering/markdown/renderMarkdown.ts`
- Create: `src/rendering/client/workers/render.ts`
- Modify: `src/publishing/infraestructure/markdown/UnifiedMarkdownRenderer.ts`
- Modify: `src/publishing/client/workers/index.ts`
- Modify: `src/publishing/client/workers/work.ts`
- Retire: `src/publishing/infraestructure/markdown/MarkdownItRenderer.ts`
- Test: `src/rendering/markdown/renderMarkdown.test.ts`

**Interfaces:**
- `renderMarkdown(request: RenderRequest): Promise<RenderResult>` returns `{ revisionId, html, headings, rendererVersion }`.
- `rendererVersion` is a constant exported by `renderConfig.ts` and must be part of every render result.
- Server adapter maps `Document` to `RenderRequest`; worker adapter maps `EditionRevision` to the same request.

- [ ] **Step 1: Write a failing shared-renderer equivalence test**

```ts
it("renders GFM tables and stable heading IDs", async () => {
  const result = await renderMarkdown({ revisionId: "r1", source: "## API\n\n| a | b |\n| - | - |\n| 1 | 2 |" });

  expect(result.html).toContain('id="api"');
  expect(result.html).toContain("<table>");
});
```

- [ ] **Step 2: Run the renderer test and verify it fails**

Run: `npm test -- src/rendering/markdown/renderMarkdown.test.ts`

Expected: FAIL because the shared rendering module does not exist.

- [ ] **Step 3: Implement the shared pipeline**

Move GFM, heading slug generation, Rehype conversion, Shiki configuration, and HTML stringification into `createMarkdownPipeline.ts`. The server renderer becomes a thin `DocumentRenderer` adapter. The worker must invoke `renderMarkdown`, not Markdown-It.

- [ ] **Step 4: Add a worker revision test**

Assert that a worker response preserves the request `revisionId` even when rendering is asynchronous.

- [ ] **Step 5: Run rendering tests**

Run: `npm test -- src/rendering/markdown/renderMarkdown.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/rendering src/publishing
git commit -m "refactor(rendering): share markdown render contract"
```

## Task 5: Add revision-aware side-by-side preview UI

**Files:**
- Create: `src/edition/ui/components/LivePreview.astro`
- Create: `src/edition/ui/components/EditionWorkspace.astro`
- Modify: `src/edition/ui/components/DocumentEditor/DocumentEditor.astro`
- Modify: `src/edition/ui/pages/EditPage.astro`
- Modify: `src/edition/ui/components/EditorStatus.astro`
- Modify: `src/edition/ui/components/EditorToolbar.astro`
- Test: `src/edition/model/EditionSession.test.ts`

**Interfaces:**
- Consumes `createEditionWorkspace` from Task 3.
- `LivePreview` receives only `{ html, renderStatus, revisionId }`; it never reads `sessionStorage`.
- Desktop has source and preview columns. Below the responsive breakpoint, the toolbar toggles one pane at a time with correct `aria-pressed` state.

- [ ] **Step 1: Extend the existing session test with preview state transitions**

```ts
expect(beginRender(session)).toMatchObject({ renderStatus: "rendering" });
expect(acceptPreview(beginRender(session), previewFor(session.draft)))
  .toMatchObject({ renderStatus: "ready" });
```

- [ ] **Step 2: Run the test and verify it fails if transition behavior is absent**

Run: `npm test -- src/edition/model/EditionSession.test.ts`

Expected: PASS only after Task 1's transition API covers the UI states; otherwise add the minimal missing pure transition.

- [ ] **Step 3: Implement `LivePreview.astro`**

Render loading, ready, and failure states. Insert only the HTML returned by the shared renderer; do not independently parse Markdown in the component.

- [ ] **Step 4: Implement `EditionWorkspace.astro`**

Compose CodeMirror and `LivePreview`. Subscribe once to the workspace session. On source changes, call `updateSource` and schedule `render`; on save, call `save` without discarding the active preview.

- [ ] **Step 5: Reduce `DocumentEditor.astro` to UI integration**

Remove direct imports of `sessionStorage` helpers, worker services, YAML parsing, and HTTP update functions. It should initialize the workspace and bridge CodeMirror callbacks to it.

- [ ] **Step 6: Manually verify responsive behavior**

Run: `npm run dev`

Check: typing changes preview after debounce; changing text quickly never flashes an older preview; narrow layout toggles source/preview; saving preserves the current preview.

- [ ] **Step 7: Commit**

```bash
git add src/edition/ui src/edition/model/EditionSession.test.ts
git commit -m "feat(edition): add live revision-aware preview"
```

## Task 6: Version the publishing cache with renderer semantics

**Files:**
- Modify: `src/publishing/domain/cache.ts`
- Modify: `src/publishing/application/PagePublisher.ts`
- Modify: `src/publishing/infraestructure/cache/FileSystemRenderedPageCache.ts`
- Modify: `src/publishing/infraestructure/cache/InMemoryRenderedPageCache.ts`
- Modify: `src/publishing/infraestructure/cache/RedisRenderedPageCache.ts`
- Test: `src/publishing/application/PagePublisher.test.ts`

**Interfaces:**
- Cache entries add `rendererVersion: string`.
- `RenderedPageCache.get` and `set` accept `(pageId, contentHash, rendererVersion)`.
- `PagePublisher` supplies `rendererVersion` from Task 4.

- [ ] **Step 1: Write the failing cache-version test**

```ts
it("rerenders when renderer semantics change", async () => {
  await cache.set("blog/post", "content-hash", "v1", "old-html");

  expect(await cache.get("blog/post", "content-hash", "v2")).toBeNull();
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/publishing/application/PagePublisher.test.ts`

Expected: FAIL because renderer version is not part of the cache contract.

- [ ] **Step 3: Update cache contracts and adapters**

Update the cache JSON format, in-memory map value, and Redis payload. Existing filesystem entries without `rendererVersion` are cache misses, not parse errors.

- [ ] **Step 4: Run cache tests**

Run: `npm test -- src/publishing/application/PagePublisher.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/publishing
git commit -m "feat(cache): version rendered pages by renderer"
```

## Task 7: Remove legacy edition flow and document the architecture

**Files:**
- Delete: `src/edition/client/render-service.ts`
- Delete: `src/edition/client/stage-document.ts`
- Delete: `src/edition/client/parse-staged-document.ts`
- Delete: `src/edition/client/update-document.ts`
- Modify: `src/edition/ui/pages/PreviewPage.astro`
- Modify: `src/pages/[...slug]/preview.astro`
- Modify: `src/pages/[...slug]/index.astro`
- Create: `src/content/nanobook-project/editor/live-preview-architecture.md`
- Create: `src/content/nanobook-project/editor/live-preview-flow.md`

**Interfaces:**
- No published route or UI component imports the deleted legacy services.
- The temporary full-page preview route reads the new workspace's current revision or explains that the side preview is the supported editing workflow.

- [ ] **Step 1: Search for legacy imports**

Run: `rg -n "render-service|stage-document|parse-staged-document|update-document" src`

Expected: only the files scheduled for deletion and any migration target appear.

- [ ] **Step 2: Move remaining behavior to the new workspace**

Update public page recovery logic and preview route to use revision-aware workspace state. Remove only behavior already represented by Tasks 1–5.

- [ ] **Step 3: Delete legacy files**

Use `apply_patch` deletions after the import search has no remaining consumers.

- [ ] **Step 4: Write architecture documentation**

Document the source-of-truth rule, revision ordering, port/adapters, render contract, cache versioning, and the deferred block/plugin path in the two content documents.

- [ ] **Step 5: Run complete verification**

Run:

```bash
npm test
npm run build
```

Expected: all targeted tests pass; build succeeds; no legacy edition imports remain.

- [ ] **Step 6: Commit**

```bash
git add src/edition src/pages src/content/nanobook-project docs/superpowers
git commit -m "refactor(edition): adopt live preview architecture"
```
