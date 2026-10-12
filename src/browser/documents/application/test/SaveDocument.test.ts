import { describe, expect, it, vi } from "vitest";
import { SaveDocument } from "../SaveDocument";
import { createDocumentStorage, buildSerializedEntry } from "./factories";
import { Result } from "../../../../shared/domain/Result";
import { EditionWriterError } from "../../domain/errors";

describe("SaveDocument", () => {
  it("renders, writes and confirms the staged document", async () => {
    const staged = buildSerializedEntry();
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(staged)),
    });
    const writer = { updateDocument: vi.fn().mockResolvedValue(Result.ok(staged)) };

    const result = await new SaveDocument(storage, writer).execute(staged.documentId);

    expect(result.isSuccess).toBe(true);
    expect(writer.updateDocument).toHaveBeenCalledWith(staged.documentId, staged);
    expect(storage.saveConfirmedDocument).toHaveBeenCalledWith(staged.documentId, staged);
  });

  it("returns an error when the writer fails", async () => {
    const staged = buildSerializedEntry();
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(staged)),
    });
    const writer = {
      updateDocument: vi.fn().mockResolvedValue(
        Result.fail(new EditionWriterError("network error"))
      ),
    };

    const result = await new SaveDocument(storage, writer).execute(staged.documentId);

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(EditionWriterError);
    expect(storage.saveConfirmedDocument).not.toHaveBeenCalled();
  });

  it("returns an error when the staged document does not exist", async () => {
    const storage = createDocumentStorage();
    const writer = { updateDocument: vi.fn() };

    const result = await new SaveDocument(storage, writer).execute("missing");

    expect(result.isSuccess).toBe(false);
    expect(writer.updateDocument).not.toHaveBeenCalled();
  });
});
