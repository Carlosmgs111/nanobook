import { describe, it, expect, vi } from "vitest";
import { PrepareEditorNavigation } from "../PrepareEditorNavigation";
import { BuildStagedDocument } from "../BuildStagedDocument";
import { StageDocument } from "../StageDocument";
import { RenderPreview } from "../RenderPreview";
import { ClearEditionStorage } from "../ClearEditionStorage";
import { YamlDocumentContentParser } from "../../infraestructure/parser/YamlDocumentContentParser";
import {
  createDocumentStorage,
  createPreviewRenderer,
  buildSerializedEntry,
} from "./factories";
import { Result } from "../../../shared/domain/Result";

const buildDependencies = () => {
  const storage = createDocumentStorage();
  const renderer = createPreviewRenderer();
  const buildStagedDocument = new BuildStagedDocument(
    new YamlDocumentContentParser()
  );
  const stageDocument = new StageDocument(storage);
  const renderPreview = new RenderPreview(storage, renderer);
  const clearEditionStorage = new ClearEditionStorage(storage);

  return {
    storage,
    renderer,
    buildStagedDocument,
    stageDocument,
    renderPreview,
    clearEditionStorage,
  };
};

describe("PrepareEditorNavigation", () => {
  it("stages, renders and clears storage when leaving the document flow", async () => {
    const deps = buildDependencies();
    const useCase = new PrepareEditorNavigation(
      deps.buildStagedDocument,
      deps.stageDocument,
      deps.renderPreview,
      deps.clearEditionStorage
    );

    const base = buildSerializedEntry();
    const content = "# Body";

    const result = await useCase.execute(
      base,
      content,
      base.id,
      new URL("https://example.com/other")
    );

    expect(result.isSuccess).toBe(true);
    expect(deps.storage.saveStagedDocument).toHaveBeenCalled();
    expect(deps.renderer.render).toHaveBeenCalled();
    expect(deps.storage.clearAll).toHaveBeenCalled();
  });

  it("stages and renders without clearing when staying in the document flow", async () => {
    const deps = buildDependencies();
    const useCase = new PrepareEditorNavigation(
      deps.buildStagedDocument,
      deps.stageDocument,
      deps.renderPreview,
      deps.clearEditionStorage
    );

    const base = buildSerializedEntry();
    const content = "# Body";

    const result = await useCase.execute(
      base,
      content,
      base.id,
      new URL("https://example.com/intro/edit")
    );

    expect(result.isSuccess).toBe(true);
    expect(deps.storage.saveStagedDocument).toHaveBeenCalled();
    expect(deps.renderer.render).toHaveBeenCalled();
    expect(deps.storage.clearAll).not.toHaveBeenCalled();
  });
});
