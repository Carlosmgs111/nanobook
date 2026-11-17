import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { SaveDocument } from "./SaveDocument";
import { SessionStorageDocumentStorage } from "../infraestructure/storage/SessionStorageDocumentStorage";
import { EditionWriterError } from "../domain/errors";
import { buildSerializedEntry, FakeStorage } from "./test/factories";

function setup(staged = buildSerializedEntry()) {
  const storage = new SessionStorageDocumentStorage(new FakeStorage());
  storage.saveStagedDocument(staged.documentId, staged);
  return { storage, staged };
}

describe("SaveDocument", () => {
  it("escribe el borrador y lo confirma con la respuesta del servidor", async () => {
    const { storage, staged } = setup();
    const saved = { ...staged, revision: 2 };
    const writer = { updateDocument: vi.fn().mockResolvedValue(Result.ok(saved)) };

    const result = await new SaveDocument(storage, writer as never).execute(staged.documentId);

    expect(result.getValue()).toEqual(saved);
    expect(writer.updateDocument).toHaveBeenCalledWith(staged.documentId, staged);
    expect(storage.loadStagedDocument(staged.documentId).getValue()).toEqual(saved);
    expect(storage.loadConfirmedDocument(staged.documentId).getValue()).toEqual(saved);
  });

  it.each([401, 403, 409])("con status %i devuelve el error y no confirma nada", async (status) => {
    const { storage, staged } = setup();
    const error = new EditionWriterError("rechazado", { status });
    const writer = { updateDocument: vi.fn().mockResolvedValue(Result.fail(error)) };

    const result = await new SaveDocument(storage, writer as never).execute(staged.documentId);

    expect(result.getError()).toBe(error);
    expect(storage.loadConfirmedDocument(staged.documentId).getValue()).toBeNull();
    expect(storage.loadStagedDocument(staged.documentId).getValue()).toEqual(staged);
  });

  it("falla si no hay borrador", async () => {
    const storage = new SessionStorageDocumentStorage(new FakeStorage());
    const writer = { updateDocument: vi.fn() };

    const result = await new SaveDocument(storage, writer as never).execute("missing");

    expect(result.isSuccess).toBe(false);
    expect(writer.updateDocument).not.toHaveBeenCalled();
  });

  it("no pisa un borrador más nuevo escrito durante el guardado", async () => {
    const { storage, staged } = setup();
    const newer = { ...staged, content: "cambio posterior" };
    const writer = {
      updateDocument: vi.fn().mockImplementation(async () => {
        storage.saveStagedDocument(staged.documentId, newer);
        return Result.ok({ ...staged, revision: 2 });
      }),
    };

    await new SaveDocument(storage, writer as never).execute(staged.documentId);

    expect(storage.loadStagedDocument(staged.documentId).getValue()).toEqual(newer);
    expect(storage.loadConfirmedDocument(staged.documentId).getValue()).toBeNull();
  });
});
