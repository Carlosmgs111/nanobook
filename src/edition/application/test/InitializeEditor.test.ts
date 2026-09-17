import { describe, it, expect, vi } from "vitest";
import { InitializeEditor } from "../InitializeEditor";
import { StageDocument } from "../StageDocument";
import { ClearEditionStorage } from "../ClearEditionStorage";
import { createDocumentStorage, buildSerializedEntry } from "./factories";
import { Result } from "../../../shared/domain/Result";

describe("InitializeEditor", () => {
  it("stages the base document when no staged document exists", () => {
    const storage = createDocumentStorage();
    const stageDocument = new StageDocument(storage);
    const clearEditionStorage = new ClearEditionStorage(storage);
    const useCase = new InitializeEditor(
      storage,
      stageDocument,
      clearEditionStorage
    );

    const base = buildSerializedEntry();
    const result = useCase.execute(base);

    expect(result.isSuccess).toBe(true);
    expect(storage.saveStagedDocument).toHaveBeenCalledWith(base);
  });

  it("clears storage when staged document belongs to another document", () => {
    const other = buildSerializedEntry({ id: "other" });
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(other)),
    });
    const stageDocument = new StageDocument(storage);
    const clearEditionStorage = new ClearEditionStorage(storage);
    const useCase = new InitializeEditor(
      storage,
      stageDocument,
      clearEditionStorage
    );

    const base = buildSerializedEntry();
    const result = useCase.execute(base);

    expect(result.isSuccess).toBe(true);
    expect(storage.clearAll).toHaveBeenCalled();
    expect(storage.saveStagedDocument).not.toHaveBeenCalled();
  });

  it("does nothing when staged document matches the base document", () => {
    const base = buildSerializedEntry();
    const storage = createDocumentStorage({
      loadStagedDocument: vi.fn().mockReturnValue(Result.ok(base)),
    });
    const stageDocument = new StageDocument(storage);
    const clearEditionStorage = new ClearEditionStorage(storage);
    const useCase = new InitializeEditor(
      storage,
      stageDocument,
      clearEditionStorage
    );

    const result = useCase.execute(base);

    expect(result.isSuccess).toBe(true);
    expect(storage.clearAll).not.toHaveBeenCalled();
    expect(storage.saveStagedDocument).not.toHaveBeenCalled();
  });
});
