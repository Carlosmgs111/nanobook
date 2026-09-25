import { describe, expect, it, vi } from "vitest";
import { InitializeEditor } from "../InitializeEditor";
import { createDocumentStorage, buildSerializedEntry } from "./factories";
import { Result } from "../../../shared/domain/Result";

describe("InitializeEditor", () => {
  it("stages the base document when no staged version exists", () => {
    const storage = createDocumentStorage();
    const base = buildSerializedEntry();

    const result = new InitializeEditor(storage).execute(base);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toEqual(base);
    expect(storage.saveStagedDocument).toHaveBeenCalledWith(base);
  });

  it("returns the existing staged version", () => {
    const staged = buildSerializedEntry({ content: "# Draft" });
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(staged)),
    });

    const result = new InitializeEditor(storage).execute(buildSerializedEntry());

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toEqual(staged);
    expect(storage.saveStagedDocument).not.toHaveBeenCalled();
  });
});
