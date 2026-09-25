import { describe, expect, it } from "vitest";
import { HandleEditorChange } from "../HandleEditorChange";
import { YamlDocumentContentParser } from "../../infraestructure/parser/YamlDocumentContentParser";
import { createDocumentStorage, buildSerializedEntry } from "./factories";

describe("HandleEditorChange", () => {
  it("parses and stages the updated document", async () => {
    const storage = createDocumentStorage();
    const useCase = new HandleEditorChange(new YamlDocumentContentParser(), storage);

    const result = await useCase.execute(
      buildSerializedEntry(),
      '---\ntitle: "Updated"\n---\n\n# Body'
    );

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().content).toBe("\n# Body");
    expect(storage.saveStagedDocument).toHaveBeenCalled();
    expect(storage.clearConfirmedDocument).toHaveBeenCalledWith("intro");
  });

  it("returns an error for invalid frontmatter", async () => {
    const storage = createDocumentStorage();
    const useCase = new HandleEditorChange(new YamlDocumentContentParser(), storage);

    const result = await useCase.execute(
      buildSerializedEntry(),
      "---\ntitle: [unclosed\n---\nbody"
    );

    expect(result.isSuccess).toBe(false);
    expect(storage.saveStagedDocument).not.toHaveBeenCalled();
  });
});
