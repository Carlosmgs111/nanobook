# Live Edition Preview and Hexagonal Edition Module Design

**Goal:** Deliver a live, side-by-side Markdown preview that always represents the latest local revision, while restructuring `edition` around domain models, application services, and browser adapters.

**Scope:** This is the first foundation for future directive blocks and plugins. It applies only to the existing Markdown editor and preview. It does not introduce a block editor, collaboration, custom directives, or a plugin runtime.

## Product intent

Nanobook is a self-hostable, Markdown-native document runtime for building web pages. Markdown files remain readable, portable, and versionable outside Nanobook. The editor must feel immediate for a technical blog today and provide a stable base for richer interactive documents later.

## Constraints

- Markdown and frontmatter remain the persisted source of truth.
- The initial editor remains CodeMirror.
- Server publication remains SSR through Astro.
- Browser-only APIs must stay out of `edition` model and application code.
- A preview must never display HTML produced for a different document revision.
- No arbitrary JavaScript or JSX may execute from document content.
- The implementation follows the repository's domain-oriented structure and uses TDD.

## Current problem

The editor currently combines several responsibilities in Astro UI scripts: parsing frontmatter, staging a document in `sessionStorage`, rendering through a Worker, saving through HTTP, and coordinating route transitions. The client uses Markdown-It while published pages use Unified/Remark/Rehype, so preview and publication can diverge. Render state is stored in global session keys rather than explicit document revisions.

## Target architecture

```text
CodeMirror UI
  -> edition application services
       -> EditionSession (pure state)
       -> DraftStore port
       -> PreviewRenderer port
       -> DocumentPublisher port
  <- browser adapters (sessionStorage, Worker, fetch)

Rendering core
  <- browser preview adapter
  <- server publishing adapter
```

`edition` owns the editing session but not Markdown syntax or publication cache. A reusable rendering core owns Markdown-to-HTML semantics. The browser preview adapter and the server publishing adapter use compatible render contracts from that core.

## Edition model

### `EditionRevision`

An immutable snapshot of one editor state.

```ts
interface EditionRevision {
  id: string;
  documentId: string;
  source: string;
  contentHash: string;
  createdAt: number;
}
```

`id` is generated locally for every edit. `contentHash` identifies equivalent source content and is used to avoid redundant work.

### `EditionSession`

```ts
interface EditionSession {
  documentId: string;
  draft: EditionRevision;
  savedRevisionId: string | null;
  preview: {
    revisionId: string;
    html: string;
  } | null;
  renderStatus: "idle" | "rendering" | "ready" | "failed";
  saveStatus: "idle" | "saving" | "saved" | "failed";
}
```

The session accepts a render result only when `result.revisionId === draft.id`. A late worker response is ignored rather than replacing newer preview content.

## Ports

```ts
interface DraftStore {
  load(documentId: string): Promise<EditionRevision | null>;
  save(revision: EditionRevision): Promise<void>;
  clear(documentId: string): Promise<void>;
}

interface PreviewRenderer {
  render(revision: EditionRevision): Promise<{
    revisionId: string;
    html: string;
  }>;
}

interface DocumentPublisher {
  publish(revision: EditionRevision): Promise<void>;
}
```

Browser adapters implement those ports with `sessionStorage`, a Web Worker, and the existing `PATCH /api/[...slug]` route. No adapter is imported by the model.

## Rendering core

The rendering core receives Markdown source and returns HTML plus headings. It has one canonical Unified/Remark/Rehype pipeline with GFM, slug generation, and Shiki configuration.

- The server adapter runs this core to produce cached published HTML.
- The worker adapter runs a browser-compatible implementation of the same contract for the preview.
- The first phase may keep separate execution bundles, but their parser plugins, heading slug algorithm, and renderer options must come from a shared configuration module.

The render cache key becomes `(documentId, contentHash, rendererVersion)`. `rendererVersion` changes when Markdown semantics or syntax highlighting configuration changes.

## Live-preview flow

1. CodeMirror emits source text after its existing debounce interval.
2. `UpdateDraft` creates an `EditionRevision`, updates the session, and persists it through `DraftStore` without blocking the editor.
3. `RenderPreview` marks the session rendering and calls `PreviewRenderer`.
4. The worker returns `{ revisionId, html }`.
5. The application service applies the result only if it matches the current draft revision.
6. `LivePreview` renders that HTML in the side panel.

## Save flow

1. The UI submits the current draft revision to `SaveDocument`.
2. The application service marks save status as `saving` and calls `DocumentPublisher`.
3. On success, the session records that revision as saved.
4. Cache invalidation and optional page warming remain server/publishing concerns.
5. The preview does not wait for server cache warming; it already displays its own matching revision.

## UI

`EditionWorkspace.astro` composes the existing editor and a new `LivePreview.astro` pane. Desktop uses two resizable columns; narrow viewports expose a source/preview toggle. The preview is non-editable and announces rendering status accessibly.

The existing full-page `/preview` route remains temporarily during migration, but uses the same session state and renderer port. It is removed only after the side preview covers the workflow.

## New and changed module boundaries

```text
src/edition/
  model/
    EditionRevision.ts
    EditionSession.ts
    ports/
      DraftStore.ts
      PreviewRenderer.ts
      DocumentPublisher.ts
  application/
    UpdateDraft.ts
    RenderPreview.ts
    SaveDocument.ts
  adapters/client/
    SessionStorageDraftStore.ts
    WorkerPreviewRenderer.ts
    HttpDocumentPublisher.ts
  client/
    createEditionWorkspace.ts
  ui/components/
    DocumentEditor/
    LivePreview.astro
    EditionWorkspace.astro

src/rendering/
  model/
    RenderSource.ts
    RenderResult.ts
  markdown/
    createMarkdownRenderPipeline.ts
    renderMarkdown.ts
```

`src/publishing` adopts `src/rendering` for server rendering. Existing `edition/client/render-service.ts`, `stage-document.ts`, and `update-document.ts` are retired only after their responsibilities move to the new boundaries.

## Acceptance criteria

- Typing updates the side preview after the configured debounce and never changes the cursor or editor contents.
- A late render response cannot replace the preview of a newer revision.
- Preview and published output have matching GFM behavior, heading IDs, and code highlighting rules for supported Markdown.
- Saving persists the revision shown in the preview and changes save status without blocking preview rendering.
- A reload restores an unsaved local draft for the same document only.
- Existing document routes, edit route, preview route, and cache invalidation continue to work.
- Unit tests cover revision ordering, session transitions, stale render rejection, and adapter request mapping.

## Explicitly deferred

- Directives and component/block registry.
- Visual block editing or Milkdown integration.
- Arbitrary MDX/JSX execution.
- Multi-user collaboration and Y.js.
- Distributed render coordination and cache warming policy redesign.

## Future extension path

Directives will later parse into named nodes in the shared rendering model. Plugins will register a validated schema, server renderer, optional client island, and optional editor UI for each node. The revision/session model remains unchanged because it operates on source revisions rather than on a particular editor implementation.
