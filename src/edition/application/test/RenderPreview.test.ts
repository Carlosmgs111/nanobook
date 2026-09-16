import { describe, it, expect, vi } from "vitest";
import { RenderPreview } from "../RenderPreview";
import {
  createDocumentStorage,
  createPreviewRenderer,
  buildSerializedEntry,
  buildRenderedPreview,
} from "./factories";
import { Result } from "../../../shared/domain/Result";
import { EditionStorageError, EditionRenderError } from "../../domain/errors";

const document = buildSerializedEntry();
const rendered = buildRenderedPreview();

describe("RenderPreview", () => {
  it("renders and caches the preview when nothing is cached", async () => {
    const storage = createDocumentStorage();
    const renderer = createPreviewRenderer();
    const useCase = new RenderPreview(storage, renderer);

    const result = await useCase.execute(document);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toEqual(rendered);
    expect(renderer.render).toHaveBeenCalledWith(document);
    expect(storage.saveRenderedDocument).toHaveBeenCalledWith(rendered);
    expect(storage.saveRenderedSource).toHaveBeenCalledWith(document);
    expect(storage.clearPendingDocument).toHaveBeenCalled();
  });

  it("returns cached preview when the source matches the document", async () => {
    const storage = createDocumentStorage({
      loadRenderedSource: vi.fn().mockReturnValue(Result.ok(document)),
      loadRenderedDocument: vi.fn().mockReturnValue(Result.ok(rendered)),
    });
    const renderer = createPreviewRenderer();
    const useCase = new RenderPreview(storage, renderer);

    const result = await useCase.execute(document);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toEqual(rendered);
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it("returns null when the same document is already pending", async () => {
    const storage = createDocumentStorage({
      loadPendingDocument: vi.fn().mockReturnValue(Result.ok(document)),
    });
    const renderer = createPreviewRenderer();
    const useCase = new RenderPreview(storage, renderer);

    const result = await useCase.execute(document);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toBeNull();
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it("does not cache the rendered preview when the staged document changed", async () => {
    const otherDocument = buildSerializedEntry({ id: "other" });
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(otherDocument)),
    });
    const renderer = createPreviewRenderer();
    const useCase = new RenderPreview(storage, renderer);

    const result = await useCase.execute(document);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toBeNull();
    expect(renderer.render).toHaveBeenCalledWith(document);
    expect(storage.saveRenderedDocument).not.toHaveBeenCalled();
  });

  it("propagates renderer errors", async () => {
    const storage = createDocumentStorage();
    const renderer = createPreviewRenderer({
      render: vi.fn().mockResolvedValue(Result.fail(new EditionRenderError("boom"))),
    });
    const useCase = new RenderPreview(storage, renderer);

    const result = await useCase.execute(document);

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(EditionRenderError);
    expect(storage.clearPendingDocument).toHaveBeenCalled();
  });

  it("propagates storage errors and clears pending", async () => {
    const storage = createDocumentStorage({
      savePendingDocument: vi.fn().mockReturnValue(Result.fail(new EditionStorageError("boom"))),
    });
    const renderer = createPreviewRenderer();
    const useCase = new RenderPreview(storage, renderer);

    const result = await useCase.execute(document);

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(EditionStorageError);
    expect(renderer.render).not.toHaveBeenCalled();
    expect(storage.clearPendingDocument).toHaveBeenCalled();
  });
});
