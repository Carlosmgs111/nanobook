import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { RenameDocument } from "./RenameDocument";
import { SessionStorageDocumentStorage } from "../infraestructure/storage/SessionStorageDocumentStorage";
import { EditionWriterError } from "../domain/errors";
import { buildSerializedEntry, FakeStorage } from "./test/factories";

function setup() {
  const staged = buildSerializedEntry({ documentId: "doc-guides", path: "guides/index", isIndex: true });
  const storage = new SessionStorageDocumentStorage(new FakeStorage());
  storage.saveStagedDocument(staged.documentId, staged);
  return { storage, staged };
}

describe("RenameDocument", () => {
  it("renombra conservando la identidad y actualiza staged y confirmado", async () => {
    const { storage, staged } = setup();
    const writer = { updateDocument: vi.fn().mockImplementation(async (_id, doc) => Result.ok(doc)) };

    const result = await new RenameDocument(storage, writer as never).execute(
      staged.documentId,
      "reference/index"
    );

    const renamed = result.getValue();
    expect(renamed).toMatchObject({ documentId: "doc-guides", path: "reference/index", isIndex: true, parentPath: "reference" });
    expect(storage.loadStagedDocument("doc-guides").getValue()).toEqual(renamed);
    expect(storage.loadConfirmedDocument("doc-guides").getValue()).toEqual(renamed);
  });

  it("rechaza rutas inválidas sin escribir", async () => {
    const { storage, staged } = setup();
    const writer = { updateDocument: vi.fn() };

    const result = await new RenameDocument(storage, writer as never).execute(staged.documentId, "../outside");

    expect(result.isSuccess).toBe(false);
    expect(writer.updateDocument).not.toHaveBeenCalled();
  });

  it("no toca el estado local si el servidor rechaza (403)", async () => {
    const { storage, staged } = setup();
    const writer = {
      updateDocument: vi.fn().mockResolvedValue(Result.fail(new EditionWriterError("sin permiso", { status: 403 }))),
    };

    const result = await new RenameDocument(storage, writer as never).execute(staged.documentId, "renamed");

    expect(result.isSuccess).toBe(false);
    expect(storage.loadStagedDocument(staged.documentId).getValue()).toEqual(staged);
  });
});
