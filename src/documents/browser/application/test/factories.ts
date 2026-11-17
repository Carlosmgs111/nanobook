import type { SerializedEntry } from "../../domain/model/StagedDocument";

export class FakeStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

export function buildSerializedEntry(
  overrides: Partial<SerializedEntry> = {}
): SerializedEntry {
  return {
    documentId: "doc-intro",
    id: "intro",
    path: "intro",
    isIndex: false,
    version: "v1",
    title: "Introduction",
    description: "Getting started",
    content: "# Intro\n\nHello.",
    rawFrontmatter: '---\ntitle: "Introduction"\ndescription: "Getting started"\n---\n',
    slug: "intro",
    parentPath: "index",
    position: 0,
    headings: [],
    metadata: {
      title: "Introduction",
      description: "Getting started",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    ...overrides,
  };
}
