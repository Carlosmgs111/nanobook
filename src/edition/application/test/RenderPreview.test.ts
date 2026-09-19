import { describe, it, expect, vi } from "vitest";
import { RenderPreview } from "../RenderPreview";
import {
  createDocumentStorage,
  createPreviewRenderer,
  buildSerializedEntry,
  buildRenderedPreview,
  buildCachedPreview,
} from "./factories";
import { Result } from "../../../shared/domain/Result";
import { EditionStorageError, EditionRenderError } from "../../domain/errors";

const document = buildSerializedEntry();
const rendered = buildRenderedPreview();

describe("RenderPreview", () => {
  it("returns null when there is no staged document", async () => {
    const storage = createDocumentStorage();
    const renderer = createPreviewRenderer();
    const useCase = new RenderPreview(storage, renderer);

    const result = await useCase.execute(document.id);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toBeNull();
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it("returns null when the staged document belongs to another id", async () => {
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(document)),
    });
    const renderer = createPreviewRenderer();
    const useCase = new RenderPreview(storage, renderer);

    const result = await useCase.execute("other");

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toBeNull();
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it("renders and caches the preview when nothing is cached", async () => {
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(document)),
    });
    const renderer = createPreviewRenderer();
    const useCase = new RenderPreview(storage, renderer);

    const result = await useCase.execute(document.id);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toEqual(rendered);
    expect(renderer.render).toHaveBeenCalledWith(document);
    expect(storage.saveCachedPreview).toHaveBeenCalledWith({
      rendered,
      source: document,
    });
  });

  it("returns cached preview when the source matches the staged document", async () => {
    const cached = buildCachedPreview({ source: document });
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(document)),
      loadCachedPreview: vi.fn().mockReturnValue(Result.ok(cached)),
    });
    const renderer = createPreviewRenderer();
    const useCase = new RenderPreview(storage, renderer);

    const result = await useCase.execute(document.id);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toEqual(cached.rendered);
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it("returns null while another render is in progress", async () => {
    let finishRender: (value: ReturnType<typeof createPreviewRenderer>["render"]) => void;
    const renderPromise = new Promise<ReturnType<typeof createPreviewRenderer>["render"]>((resolve) => {
      finishRender = resolve;
    });
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(document)),
    });
    const renderer = createPreviewRenderer({
      render: vi.fn().mockReturnValue(renderPromise),
    });
    const useCase = new RenderPreview(storage, renderer);

    const firstCall = useCase.execute(document.id);
    const secondCall = useCase.execute(document.id);

    finishRender!(Result.ok(rendered));

    const [firstResult, secondResult] = await Promise.all([firstCall, secondCall]);

    expect(firstResult.isSuccess).toBe(true);
    expect(firstResult.getValue()).toEqual(rendered);
    expect(secondResult.isSuccess).toBe(true);
    expect(secondResult.getValue()).toBeNull();
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  it("does not cache the rendered preview when the staged document changed", async () => {
    const otherDocument = buildSerializedEntry({
      id: document.id,
      content: "# Changed",
    });
    const storage = createDocumentStorage({
      loadStagedDocument: vi
        .fn()
        .mockReturnValueOnce(Result.ok(document))
        .mockReturnValueOnce(Result.ok(otherDocument)),
    });
    const renderer = createPreviewRenderer();
    const useCase = new RenderPreview(storage, renderer);

    const result = await useCase.execute(document.id);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toBeNull();
    expect(renderer.render).toHaveBeenCalledWith(document);
    expect(storage.saveCachedPreview).not.toHaveBeenCalled();
  });

  it("propagates renderer errors", async () => {
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(document)),
    });
    const renderer = createPreviewRenderer({
      render: vi.fn().mockResolvedValue(Result.fail(new EditionRenderError("boom"))),
    });
    const useCase = new RenderPreview(storage, renderer);

    const result = await useCase.execute(document.id);

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(EditionRenderError);
  });

  it("propagates storage errors when saving the cached preview", async () => {
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(document)),
      saveCachedPreview: vi.fn().mockReturnValue(Result.fail(new EditionStorageError("boom"))),
    });
    const renderer = createPreviewRenderer();
    const useCase = new RenderPreview(storage, renderer);

    const result = await useCase.execute(document.id);

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(EditionStorageError);
    expect(renderer.render).toHaveBeenCalled();
  });
});
