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

    expect(storage.saveStagedDocument(first)).toEqual(Result.ok());
    expect(storage.saveStagedDocument(second)).toEqual(Result.ok());

    expect(storage.loadStagedDocument("doc-1").getValue()).toEqual(first);
    expect(storage.loadStagedDocument("doc-2").getValue()).toEqual(second);
  });
});
