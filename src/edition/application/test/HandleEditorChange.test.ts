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
    expect(storage.saveStagedDocument).toHaveBeenCalledWith("doc-intro", expect.any(Object));
    expect(storage.clearConfirmedDocument).toHaveBeenCalledWith("doc-intro");
  });

  it("keeps entry fields synchronized with edited frontmatter metadata", async () => {
    const storage = createDocumentStorage();
    const useCase = new HandleEditorChange(new YamlDocumentContentParser(), storage);

    const result = await useCase.execute(
      buildSerializedEntry(),
      '---\ntitle: "Updated title"\ndescription: "Updated description"\nposition: 7\nref: "/README.md"\n---\n\n# Body'
    );

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toMatchObject({
      title: "Updated title",
      description: "Updated description",
      position: 7,
      ref: "/README.md",
      metadata: {
        title: "Updated title",
        description: "Updated description",
        position: 7,
        ref: "/README.md",
      },
    });
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

  it("preserves the source body when editing proxy frontmatter only", async () => {
    const storage = createDocumentStorage();
    const base = buildSerializedEntry({
      content: "source body must remain unchanged",
      metadata: { ref: "/README.md" },
    });
    const result = await new HandleEditorChange(
      new YamlDocumentContentParser(),
      storage
    ).execute(
      base,
      '---\ntitle: "Updated proxy"\n---\n',
      true
    );

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().content).toBe(base.content);
  });
});
