import { describe, expect, it } from "vitest";
import { SessionStorageDocumentStorage } from "./SessionStorageDocumentStorage";
import { Result } from "../../../shared/domain/Result";
import type { SerializedEntry } from "../../domain/model/StagedDocument";

class FakeStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function entry(documentId: string, path: string): SerializedEntry {
  return {
    documentId,
    path,
    version: `version-${documentId}`,
    id: path,
    title: path,
    description: path,
    content: `# ${path}`,
    rawFrontmatter: "---\n---\n",
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

describe("SessionStorageDocumentStorage", () => {
  it("keeps staged documents isolated by stable document identity", () => {
    const storage = new SessionStorageDocumentStorage(new FakeStorage());
    const first = entry("doc-1", "guides/one");
    const second = entry("doc-2", "guides/two");

    expect(storage.saveStagedDocument("doc-1", first)).toEqual(Result.ok());
    expect(storage.saveStagedDocument("doc-2", second)).toEqual(Result.ok());

    expect(storage.loadStagedDocument("doc-1").getValue()).toEqual(first);
    expect(storage.loadStagedDocument("doc-2").getValue()).toEqual(second);
  });

  it("uses the provided documentId as the storage key, not the document id", () => {
    const fake = new FakeStorage();
    const storage = new SessionStorageDocumentStorage(fake);
    const documentId = "stable-doc-id";
    const document = entry(documentId, "mutable/path");

    storage.saveCachedPreview(documentId, {
      rendered: { Content: "<h1>Preview</h1>" },
      source: document,
    });

    const cached = storage.loadCachedPreview(documentId).getValue();
    expect(cached?.rendered.Content).toBe("<h1>Preview</h1>");
    expect(storage.loadCachedPreview("mutable/path").getValue()).toBeNull();
  });

  it("stores confirmed documents under the provided documentId", () => {
    const storage = new SessionStorageDocumentStorage(new FakeStorage());
    const documentId = "stable-doc-id";
    const document = entry(documentId, "mutable/path");

    storage.saveConfirmedDocument(documentId, document);

    expect(storage.loadConfirmedDocument(documentId).getValue()).toEqual(document);
    expect(storage.loadConfirmedDocument("mutable/path").getValue()).toBeNull();
  });
});
