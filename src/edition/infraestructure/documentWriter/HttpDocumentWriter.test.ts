import { describe, expect, it, vi, afterEach } from "vitest";
import { HttpDocumentWriter } from "./HttpDocumentWriter";
import type { CreateDocumentRequest } from "../../../document";

const documentRequest: CreateDocumentRequest = {
  id: "doc-new",
  path: "new-dir/new file",
  title: "New file",
  description: "A new document",
  content: "# New file",
  date: "2024-01-01T00:00:00.000Z",
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
      "/api/doc-new",
      expect.objectContaining({ method: "POST" })
    );
  });
});
