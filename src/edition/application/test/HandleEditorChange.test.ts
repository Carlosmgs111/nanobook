import { describe, it, expect, vi } from "vitest";
import { HandleEditorChange } from "../HandleEditorChange";
import { BuildStagedDocument } from "../BuildStagedDocument";
import { StageDocument } from "../StageDocument";
import { RenderPreview } from "../RenderPreview";
import { YamlDocumentContentParser } from "../../infraestructure/parser/YamlDocumentContentParser";
import {
  createDocumentStorage,
  createPreviewRenderer,
  buildSerializedEntry,
  buildRenderedPreview,
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

  return { storage, renderer, buildStagedDocument, stageDocument, renderPreview };
};

describe("HandleEditorChange", () => {
  it("stages and renders the updated document", async () => {
    const deps = buildDependencies();
    const useCase = new HandleEditorChange(
      deps.buildStagedDocument,
      deps.stageDocument,
      deps.renderPreview
    );

    const base = buildSerializedEntry();
    const content = '---\ntitle: "Updated"\n---\n\n# Body';

    const result = await useCase.execute(base, content);

    expect(result.isSuccess).toBe(true);
    expect(deps.storage.saveStagedDocument).toHaveBeenCalled();
    expect(deps.storage.clearSavedAt).toHaveBeenCalled();
    expect(deps.renderer.render).toHaveBeenCalled();
  });

  it("returns error for invalid frontmatter", async () => {
    const deps = buildDependencies();
    const useCase = new HandleEditorChange(
      deps.buildStagedDocument,
      deps.stageDocument,
      deps.renderPreview
    );

    const base = buildSerializedEntry();
    const content = '---\ntitle: [unclosed\n---\nbody';

    const result = await useCase.execute(base, content);

    expect(result.isSuccess).toBe(false);
  });
});
