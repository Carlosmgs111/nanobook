import { describe, expect, it } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { SessionStorageDocumentStorage } from "../../infraestructure/storage/SessionStorageDocumentStorage";
import { YamlDocumentContentParser } from "../../infraestructure/parser/YamlDocumentContentParser";
import { InitializeEditor } from "../InitializeEditor";
import { HandleEditorChange } from "../HandleEditorChange";
import { RenderPreview } from "../RenderPreview";
import { GetRenderedDocument } from "../GetRenderedDocument";
import type { PreviewRenderer } from "../../domain/ports/PreviewRenderer";
import type { SerializedEntry } from "../../domain/model/StagedDocument";
import type { EventBus } from "../../../shared/domain/bus/EventBus";

class FakeStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function createEventBus(): EventBus {
  return {
    publish: () => Promise.resolve(Result.ok()),
    subscribe: () => {},
  };
}

function createPreviewRenderer(): PreviewRenderer {
  return {
    render: async () => Result.ok({ Content: "<h1>Preview</h1>" }),
  };
}

function baseEntry(documentId: string, path: string): SerializedEntry {
  return {
    documentId,
    path,
    version: `version-${documentId}`,
    id: path,
    title: path,
    description: path,
    content: `# ${path}`,
    rawFrontmatter: `---\nid: "${documentId}"\ntitle: "${path}"\ndescription: "${path}"\ndate: 2026-01-01T00:00:00.000Z\nindex: false\n---\n`,
    slug: path,
    position: 0,
    headings: [],
    metadata: {
      title: path,
      description: path,
      date: "2026-01-01T00:00:00.000Z",
      index: false,
    },
  };
}

describe("Preview flow", () => {
  it("exposes a rendered preview after the editor changes and renders", async () => {
    const storage = new SessionStorageDocumentStorage(new FakeStorage());
    const parser = new YamlDocumentContentParser();
    const renderer = createPreviewRenderer();
    const eventBus = createEventBus();
    const initializeEditor = new InitializeEditor(storage);
    const handleEditorChange = new HandleEditorChange(parser, storage);
    const renderPreview = new RenderPreview(storage, renderer, eventBus);
    const getRenderedDocument = new GetRenderedDocument(storage);

    const documentId = "doc-flow-01";
    const path = "guides/flow";
    const base = baseEntry(documentId, path);
    const fullContent = base.rawFrontmatter + "# Updated\n\nnew content.";

    initializeEditor.execute(base);
    const changeResult = await handleEditorChange.execute(base, fullContent);
    expect(changeResult.isSuccess).toBe(true);

    const staged = changeResult.getValue();
    const renderResult = await renderPreview.execute(staged.documentId);
    expect(renderResult.isSuccess).toBe(true);
    expect(renderResult.getValue()).toEqual({ Content: "<h1>Preview</h1>" });

    const cachedResult = getRenderedDocument.execute(documentId);
    expect(cachedResult.isSuccess).toBe(true);
    expect(cachedResult.getValue().rendered).toEqual({ Content: "<h1>Preview</h1>" });
  });
});
