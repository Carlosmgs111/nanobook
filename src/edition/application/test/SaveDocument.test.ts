import { describe, it, expect, vi } from "vitest";
import { SaveDocument } from "../SaveDocument";
import { BuildStagedDocument } from "../BuildStagedDocument";
import { StageDocument } from "../StageDocument";
import { MarkDocumentSaved } from "../MarkDocumentSaved";
import { WarmDocumentPage } from "../WarmDocumentPage";
import { RenderPreview } from "../RenderPreview";
import { YamlDocumentContentParser } from "../../infraestructure/parser/YamlDocumentContentParser";
import {
  createDocumentStorage,
  createPreviewRenderer,
  createPageWarmingService,
  buildSerializedEntry,
  buildRenderedPreview,
} from "./factories";
import { Result } from "../../../shared/domain/Result";

const buildDependencies = () => {
  const storage = createDocumentStorage();
  const renderer = createPreviewRenderer();
  const warmingService = createPageWarmingService();
  const buildStagedDocument = new BuildStagedDocument(
    new YamlDocumentContentParser()
  );
  const stageDocument = new StageDocument(storage);
  const markDocumentSaved = new MarkDocumentSaved(storage);
  const warmDocumentPage = new WarmDocumentPage(warmingService);
  const renderPreview = new RenderPreview(storage, renderer);

  return {
    storage,
    renderer,
    warmingService,
    buildStagedDocument,
    stageDocument,
    markDocumentSaved,
    warmDocumentPage,
    renderPreview,
  };
};

describe("SaveDocument", () => {
  it("saves to server, stages, marks saved, warms and renders", async () => {
    const deps = buildDependencies();
    const useCase = new SaveDocument(
      deps.buildStagedDocument,
      deps.stageDocument,
      deps.markDocumentSaved,
      deps.warmDocumentPage,
      deps.renderPreview
    );

    const saveApi = vi.fn().mockResolvedValue(undefined);
    const base = buildSerializedEntry();
    const content = '---\ntitle: "Updated"\n---\n\n# Body';

    const result = await useCase.execute(base, content, saveApi, "/view");

    expect(result.isSuccess).toBe(true);
    expect(saveApi).toHaveBeenCalled();
    expect(deps.storage.saveStagedDocument).toHaveBeenCalled();
    expect(deps.storage.markSavedAt).toHaveBeenCalled();
    expect(deps.warmingService.warm).toHaveBeenCalledWith("/view");
    expect(deps.renderer.render).toHaveBeenCalled();
  });

  it("returns error when saveApi fails", async () => {
    const deps = buildDependencies();
    const useCase = new SaveDocument(
      deps.buildStagedDocument,
      deps.stageDocument,
      deps.markDocumentSaved,
      deps.warmDocumentPage,
      deps.renderPreview
    );

    const saveApi = vi.fn().mockRejectedValue(new Error("network error"));
    const base = buildSerializedEntry();

    const result = await useCase.execute(base, "# Body", saveApi);

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(Error);
    expect(result.getError().message).toBe("network error");
  });

  it("does not warm when viewHref is not provided", async () => {
    const deps = buildDependencies();
    const useCase = new SaveDocument(
      deps.buildStagedDocument,
      deps.stageDocument,
      deps.markDocumentSaved,
      deps.warmDocumentPage,
      deps.renderPreview
    );

    const saveApi = vi.fn().mockResolvedValue(undefined);
    const base = buildSerializedEntry();

    await useCase.execute(base, "# Body", saveApi);

    expect(deps.warmingService.warm).not.toHaveBeenCalled();
  });
});
