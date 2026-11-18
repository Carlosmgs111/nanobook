import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { DeleteDocument } from "./DeleteDocument";
import { SessionStorageDocumentStorage } from "../infraestructure/storage/SessionStorageDocumentStorage";
import { EditionWriterError } from "../domain/errors";
import { buildSerializedEntry, FakeStorage } from "./test/factories";

function setup() {
  const entry = buildSerializedEntry();
  const storage = new SessionStorageDocumentStorage(new FakeStorage());
  storage.saveStagedDocument(entry.documentId, entry);
  storage.saveConfirmedDocument(entry.documentId, entry);
  return { storage, entry };
}

describe("DeleteDocument", () => {
  it("borra en el servidor y limpia el estado local", async () => {
    const { storage, entry } = setup();
    const writer = { deleteDocument: vi.fn().mockResolvedValue(Result.ok()) };

    const result = await new DeleteDocument(storage, writer as never).execute(entry.documentId);

    expect(result.isSuccess).toBe(true);
    expect(writer.deleteDocument).toHaveBeenCalledWith(entry.documentId);
    expect(storage.loadStagedDocument(entry.documentId).getValue()).toBeNull();
    expect(storage.loadConfirmedDocument(entry.documentId).getValue()).toBeNull();
  });

  it("conserva el estado local si el servidor rechaza el borrado (403)", async () => {
    const { storage, entry } = setup();
    const error = new EditionWriterError("sin permiso", { status: 403 });
    const writer = { deleteDocument: vi.fn().mockResolvedValue(Result.fail(error)) };

    const result = await new DeleteDocument(storage, writer as never).execute(entry.documentId);

    expect(result.getError()).toBe(error);
    expect(storage.loadStagedDocument(entry.documentId).getValue()).toEqual(entry);
  });
});
