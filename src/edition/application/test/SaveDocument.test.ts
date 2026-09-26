import { describe, expect, it, vi } from "vitest";
import { SaveDocument } from "../SaveDocument";
import { RenderPreview } from "../RenderPreview";
import { createDocumentStorage, createPreviewRenderer, buildSerializedEntry } from "./factories";
import { Result } from "../../../shared/domain/Result";

function createEventBus() {
  return { publish: vi.fn().mockResolvedValue(Result.ok()), subscribe: vi.fn() };
}

describe("SaveDocument", () => {
  it("renders, writes and confirms the staged document", async () => {
    const staged = buildSerializedEntry();
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(staged)),
    });
    const writer = { updateDocument: vi.fn().mockResolvedValue(undefined) };
    const renderPreview = new RenderPreview(
      storage,
      createPreviewRenderer(),
      createEventBus()
    );

    const result = await new SaveDocument(storage, writer, renderPreview).execute(
      staged.documentId
    );

    expect(result.isSuccess).toBe(true);
    expect(writer.updateDocument).toHaveBeenCalledWith(staged.path ?? staged.id, staged);
    expect(storage.saveConfirmedDocument).toHaveBeenCalledWith(staged.documentId, staged);
  });

  it("returns an error when the staged document does not exist", async () => {
    const storage = createDocumentStorage();
    const writer = { updateDocument: vi.fn() };
    const renderPreview = new RenderPreview(
      storage,
      createPreviewRenderer(),
      createEventBus()
    );

    const result = await new SaveDocument(storage, writer, renderPreview).execute("missing");

    expect(result.isSuccess).toBe(false);
    expect(writer.updateDocument).not.toHaveBeenCalled();
  });
});
