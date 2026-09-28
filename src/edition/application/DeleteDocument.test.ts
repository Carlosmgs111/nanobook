import { describe, expect, it, vi } from "vitest";
import { DeleteDocument } from "./DeleteDocument";
import { Result } from "../../shared/domain/Result";
import { EditionWriterError } from "../domain/errors";
import { buildSerializedEntry, createDocumentStorage } from "./test/factories";

describe("Edition DeleteDocument", () => {
  it("deletes the staged document and clears its local state", async () => {
    const staged = buildSerializedEntry({ path: "guides/index" });
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(staged)),
    });
    const writer = { deleteDocument: vi.fn().mockResolvedValue(Result.ok()) };

    const result = await new DeleteDocument(storage, writer).execute(staged.documentId);

    expect(result.isSuccess).toBe(true);
    expect(writer.deleteDocument).toHaveBeenCalledWith(staged.documentId);
    expect(storage.clearAll).toHaveBeenCalledWith(staged.documentId);
  });

  it("does not clear local state when the remote delete fails", async () => {
    const staged = buildSerializedEntry();
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(staged)),
    });
    const writer = {
      deleteDocument: vi.fn().mockResolvedValue(
        Result.fail(new EditionWriterError("network error"))
      ),
    };

    const result = await new DeleteDocument(storage, writer).execute(staged.documentId);

    expect(result.isSuccess).toBe(false);
    expect(storage.clearAll).not.toHaveBeenCalled();
  });
});
