import { Result } from "../../shared/domain/Result";
import type { SerializedEntry } from "../domain/model/StagedDocument";
import type { EditionStorageError } from "../domain/errors";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import type { DocumentWriter } from "../application/ports/DocumentWriter";
import type { RenderPreview } from "./RenderPreview";

export type SaveDocumentError = EditionStorageError | Error;

export class SaveDocument {
  constructor(
    private storage: DocumentStorage,
    private writer: DocumentWriter,
    private renderPreview: RenderPreview
  ) {}

  async execute(documentId: string): Promise<Result<SaveDocumentError, SerializedEntry>> {
    const stageResult = this.storage.loadStagedDocument(documentId);
    if (!stageResult.isSuccess) {
      return Result.fail(stageResult.getError());
    }
    const staged = stageResult.getValue();
    if (!staged) return Result.fail(new Error("Staged document not found"));

    let renderResult = await this.renderPreview.execute(documentId);
    if (renderResult.isSuccess && !renderResult.getValue()) {
      renderResult = await this.renderPreview.execute(documentId);
    }
    if (!renderResult.isSuccess) return Result.fail(renderResult.getError());
    if (!renderResult.getValue()) {
      return Result.fail(new Error("Rendered preview not available"));
    }

    try {
      await this.writer.updateDocument(staged.path ?? staged.id, staged);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail(new Error(message));
    }

    const currentStageResult = this.storage.loadStagedDocument(documentId);
    if (!currentStageResult.isSuccess) return Result.fail(currentStageResult.getError());
    if (!sameDocument(currentStageResult.getValue(), staged)) return Result.ok(staged);

    const confirmationResult = this.storage.saveConfirmedDocument(documentId, staged);
    if (!confirmationResult.isSuccess) return Result.fail(confirmationResult.getError());
    return Result.ok(staged);
  }
}

function sameDocument(
  current: SerializedEntry | null,
  saved: SerializedEntry
): boolean {
  return JSON.stringify(current) === JSON.stringify(saved);
}
