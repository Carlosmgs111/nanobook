import { describe, it, expect, vi } from "vitest";
import { StageDocument } from "../StageDocument";
import { createDocumentStorage, buildSerializedEntry } from "./factories";
import { Result } from "../../../shared/domain/Result";
import { EditionStorageError } from "../../domain/errors";

const document = buildSerializedEntry();

describe("StageDocument", () => {
  it("saves the staged document and clears the saved-at marker", () => {
    const storage = createDocumentStorage();
    const useCase = new StageDocument(storage);

    const result = useCase.execute(document);

    expect(result.isSuccess).toBe(true);
    expect(storage.saveStagedDocument).toHaveBeenCalledWith(document);
    expect(storage.clearSavedAt).toHaveBeenCalled();
  });

  it("propagates storage errors", () => {
    const storage = createDocumentStorage({
      saveStagedDocument: vi.fn().mockReturnValue(Result.fail(new EditionStorageError("boom"))),
    });
    const useCase = new StageDocument(storage);

    const result = useCase.execute(document);

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(EditionStorageError);
    expect(storage.clearSavedAt).not.toHaveBeenCalled();
  });
});
