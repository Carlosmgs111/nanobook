import { describe, expect, it, vi, afterEach } from "vitest";
import { HttpDocumentWriter } from "./HttpDocumentWriter";
import type { CreateDocumentRequest, SerializedEntry } from "../../../../server/documents";

const documentRequest: CreateDocumentRequest = {
  id: "doc-new",
  path: "new-dir/new file",
  title: "New file",
  description: "A new document",
  content: "# New file",
};

describe("HttpDocumentWriter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a document through its stable id parameter", async () => {
    const responseDocument = { documentId: documentRequest.id, path: documentRequest.path };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(responseDocument), { status: 201 }));

    const result = await new HttpDocumentWriter().createDocument(documentRequest);

    expect(result.isSuccess).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents/doc-new",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("does not send identity or audit fields in an update payload", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const entry = {
      documentId: "doc-immutable",
      id: "doc-immutable",
      path: "guide/intro",
      isIndex: false,
      version: "version",
      title: "Intro",
      description: "Intro",
      position: 0,
      rawFrontmatter: "",
      content: "# Intro",
      slug: "intro",
      headings: [],
      metadata: {
        id: "doc-immutable",
        title: "Intro",
        description: "Intro",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
        author: "Author",
      },
    } as SerializedEntry;

    await new HttpDocumentWriter().updateDocument("doc-immutable", entry);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents/doc-immutable",
      expect.objectContaining({ method: "PATCH" })
    );
    const request = vi.mocked(fetchMock).mock.calls[0][1];
    const payload = JSON.parse(String(request?.body));
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("author");
    expect(payload).not.toHaveProperty("createdAt");
    expect(payload).not.toHaveProperty("updatedAt");
  });

  it("deletes a document through the protected documents endpoint", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    const result = await new HttpDocumentWriter().deleteDocument("doc-delete");

    expect(result.isSuccess).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents/doc-delete",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
