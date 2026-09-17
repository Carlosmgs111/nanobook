import { describe, it, expect, vi } from "vitest";
import { GetEditorInitialContent } from "../GetEditorInitialContent";
import { createDocumentStorage, buildSerializedEntry } from "./factories";
import { Result } from "../../../shared/domain/Result";

describe("GetEditorInitialContent", () => {
  it("returns staged content when staged document matches the base", () => {
    const staged = buildSerializedEntry({
      content: "# Staged",
      rawFrontmatter: '---\ntitle: "Staged"\n---\n',
    });
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(staged)),
    });
    const useCase = new GetEditorInitialContent(storage);

    const base = buildSerializedEntry();
    const result = useCase.execute(base, "fallback");

    expect(result).toBe('---\ntitle: "Staged"\n---\n# Staged');
  });

  it("returns fallback when staged document belongs to another document", () => {
    const staged = buildSerializedEntry({ id: "other" });
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(staged)),
    });
    const useCase = new GetEditorInitialContent(storage);

    const base = buildSerializedEntry();
    const result = useCase.execute(base, "fallback");

    expect(result).toBe("fallback");
  });

  it("returns fallback when there is no staged document", () => {
    const storage = createDocumentStorage();
    const useCase = new GetEditorInitialContent(storage);

    const base = buildSerializedEntry();
    const result = useCase.execute(base, "fallback");

    expect(result).toBe("fallback");
  });
});
