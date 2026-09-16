import { describe, it, expect } from "vitest";
import { BuildStagedDocument } from "../BuildStagedDocument";
import { buildSerializedEntry } from "./factories";
import { InvalidDocumentContentError } from "../../domain/errors";

const useCase = new BuildStagedDocument();

const base = buildSerializedEntry();

describe("BuildStagedDocument", () => {
  it("parses frontmatter and body from full markdown content", () => {
    const content = `---\ntitle: "Updated title"\ndescription: "Updated description"\ndate: 2026-09-15T00:00:00.000Z\n---\n\n# Updated body`;

    const result = useCase.execute(base, content);

    expect(result.isSuccess).toBe(true);
    const document = result.getValue();
    expect(document.metadata.title).toBe("Updated title");
    expect(document.metadata.description).toBe("Updated description");
    expect(document.metadata.date).toBe("2026-09-15T00:00:00.000Z");
    expect(document.content).toBe("\n# Updated body");
    expect(document.rawFrontmatter).toBe(
      '---\ntitle: "Updated title"\ndescription: "Updated description"\ndate: 2026-09-15T00:00:00.000Z\n---\n'
    );
  });

  it("keeps base metadata when frontmatter does not override it", () => {
    const content = `# Body only`;

    const result = useCase.execute(base, content);

    expect(result.isSuccess).toBe(true);
    const document = result.getValue();
    expect(document.metadata.title).toBe(base.metadata.title);
    expect(document.content).toBe("# Body only");
  });

  it("returns InvalidDocumentContentError for malformed yaml frontmatter", () => {
    const content = `---\ntitle: [unclosed\n---\nbody`;

    const result = useCase.execute(base, content);

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(InvalidDocumentContentError);
  });
});
