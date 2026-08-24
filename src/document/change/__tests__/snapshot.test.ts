import { describe, it, expect } from "vitest";
import { computeDocumentChanges, hashDocument } from "../snapshot";
import { createDocument } from "../../../navigation/model/__tests__/factory";

describe("hashDocument", () => {
  it("produce hashes diferentes cuando cambia el contenido", () => {
    const a = createDocument({ id: "doc", content: "Hello" });
    const b = createDocument({ id: "doc", content: "World" });

    const hashA = hashDocument(a);
    const hashB = hashDocument(b);

    expect(hashA.id).toBe("doc");
    expect(hashA.contentHash).not.toBe(hashB.contentHash);
    expect(hashA.metadataHash).toBe(hashB.metadataHash);
  });

  it("produce hashes diferentes cuando cambian los metadatos", () => {
    const a = createDocument({ id: "doc", title: "Old title" });
    const b = createDocument({ id: "doc", title: "New title" });

    const hashA = hashDocument(a);
    const hashB = hashDocument(b);

    expect(hashA.metadataHash).not.toBe(hashB.metadataHash);
    expect(hashA.contentHash).toBe(hashB.contentHash);
  });
});

describe("computeDocumentChanges", () => {
  it("detecta documentos agregados", () => {
    const previous: ReturnType<typeof hashDocument>[] = [];
    const current = [hashDocument(createDocument({ id: "new-doc" }))];

    const changes = computeDocumentChanges(previous, current);

    expect(changes).toEqual([{ id: "new-doc", kind: "added" }]);
  });

  it("detecta documentos eliminados", () => {
    const previous = [hashDocument(createDocument({ id: "old-doc" }))];
    const current: ReturnType<typeof hashDocument>[] = [];

    const changes = computeDocumentChanges(previous, current);

    expect(changes).toEqual([{ id: "old-doc", kind: "removed" }]);
  });

  it("detecta cambio de contenido con scope content", () => {
    const previous = [hashDocument(createDocument({ id: "doc", content: "A" }))];
    const current = [hashDocument(createDocument({ id: "doc", content: "B" }))];

    const changes = computeDocumentChanges(previous, current);

    expect(changes).toEqual([{ id: "doc", kind: "modified", scope: "content" }]);
  });

  it("detecta cambio de metadata con scope metadata", () => {
    const previous = [hashDocument(createDocument({ id: "doc", title: "A" }))];
    const current = [hashDocument(createDocument({ id: "doc", title: "B" }))];

    const changes = computeDocumentChanges(previous, current);

    expect(changes).toEqual([{ id: "doc", kind: "modified", scope: "metadata" }]);
  });

  it("detecta cambio de contenido y metadata con scope all", () => {
    const previous = [
      hashDocument(createDocument({ id: "doc", title: "A", content: "A" })),
    ];
    const current = [
      hashDocument(createDocument({ id: "doc", title: "B", content: "B" })),
    ];

    const changes = computeDocumentChanges(previous, current);

    expect(changes).toEqual([{ id: "doc", kind: "modified", scope: "all" }]);
  });

  it("no produce cambios si los hashes son iguales", () => {
    const doc = createDocument({ id: "doc" });
    const previous = [hashDocument(doc)];
    const current = [hashDocument(doc)];

    const changes = computeDocumentChanges(previous, current);

    expect(changes).toEqual([]);
  });
});
