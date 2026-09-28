import { describe, expect, it, vi } from "vitest";
import { Result } from "../../shared/domain/Result";
import { RenameDocument } from "./RenameDocument";
import { EditionWriterError } from "../domain/errors";
import { buildSerializedEntry, createDocumentStorage } from "./test/factories";

describe("RenameDocument", () => {
  it("renames a staged document while preserving its stable identity", async () => {
    const staged = buildSerializedEntry({
      documentId: "doc-guides",
      path: "guides/index",
      isIndex: true,
    });
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(staged)),
    });
    const writer = {
      updateDocument: vi.fn().mockResolvedValue(Result.ok(staged)),
    };

    const result = await new RenameDocument(storage, writer).execute(
      staged.documentId,
      "reference/index"
    );

    expect(result.isSuccess).toBe(true);
    expect(writer.updateDocument).toHaveBeenCalledWith(
      "doc-guides",
      expect.objectContaining({
        documentId: "doc-guides",
        path: "reference/index",
        isIndex: true,
        slug: "reference/index",
      })
    );
    expect(storage.saveStagedDocument).toHaveBeenCalledWith(
      "doc-guides",
      expect.objectContaining({ path: "reference/index", parentPath: "reference" })
    );
  });

  it("rejects an invalid path without writing", async () => {
    const staged = buildSerializedEntry();
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(staged)),
    });
    const writer = { updateDocument: vi.fn() };

    const result = await new RenameDocument(storage, writer).execute(
      staged.documentId,
      "../outside"
    );

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(Error);
    expect(writer.updateDocument).not.toHaveBeenCalled();
  });

  it("keeps local state unchanged when the remote update fails", async () => {
    const staged = buildSerializedEntry();
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(staged)),
    });
    const writer = {
      updateDocument: vi.fn().mockResolvedValue(
        Result.fail(new EditionWriterError("network error"))
      ),
    };

    const result = await new RenameDocument(storage, writer).execute(
      staged.documentId,
      "renamed"
    );

    expect(result.isSuccess).toBe(false);
    expect(storage.saveStagedDocument).not.toHaveBeenCalled();
  });
});
