import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpDocumentWriter } from "./HttpDocumentWriter";
import { EditionWriterError } from "../../domain/errors";
import { buildSerializedEntry } from "../../application/test/factories";

const createRequest = { id: "doc-new", path: "dir/new", title: "New", description: "", content: "# New" };

function respondWith(status: number, body?: unknown) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    new Response(body === undefined ? null : JSON.stringify(body), { status })
  );
}

describe("HttpDocumentWriter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("crea y borra por id estable con el método HTTP correcto", async () => {
    const fetchMock = respondWith(201, { documentId: "doc-new" });
    const writer = new HttpDocumentWriter();

    expect((await writer.createDocument(createRequest)).isSuccess).toBe(true);
    expect((await writer.deleteDocument("doc-new")).isSuccess).toBe(true);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/me/documents/doc-new", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/me/documents/doc-new", expect.objectContaining({ method: "DELETE" }));
  });

  it("al actualizar solo envía campos editables y la revisión esperada", async () => {
    const fetchMock = respondWith(200, {});
    const entry = buildSerializedEntry({
      revision: 3,
      metadata: {
        id: "x", author: "A", ownerId: "u1", secured: true, tags: ["t"],
        createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-02T00:00:00.000Z",
      } as never,
    });

    await new HttpDocumentWriter().updateDocument(entry.documentId, entry);

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ expectedRevision: 3, path: "intro", tags: ["t"] });
    for (const field of ["id", "author", "ownerId", "secured", "createdAt", "updatedAt", "metadata"]) {
      expect(body).not.toHaveProperty(field);
    }
  });

  it.each([401, 403, 409])("traduce la respuesta %i a EditionWriterError con status y mensaje", async (status) => {
    respondWith(status, { error: `rechazado ${status}`, expectedRevision: 3, actualRevision: 4 });
    const writer = new HttpDocumentWriter();

    for (const result of [
      await writer.createDocument(createRequest),
      await writer.updateDocument("doc-new", buildSerializedEntry()),
      await writer.deleteDocument("doc-new"),
    ]) {
      const error = result.getError();
      expect(error).toBeInstanceOf(EditionWriterError);
      expect(error).toMatchObject({ status, message: `rechazado ${status}`, expectedRevision: 3, actualRevision: 4 });
    }
  });

  it("usa un mensaje genérico sin cuerpo JSON y captura fallos de red", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("nope", { status: 403 }));
    const forbidden = await new HttpDocumentWriter().deleteDocument("doc-x");
    expect(forbidden.getError()).toMatchObject({ status: 403, message: "Error al eliminar" });

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));
    const offline = await new HttpDocumentWriter().deleteDocument("doc-x");
    expect(offline.getError()).toMatchObject({ message: "offline", status: undefined });
  });
});
