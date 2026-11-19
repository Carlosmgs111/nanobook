import {
  Subject,
  type AccessCheckFailedError,
  type AccessDeniedError,
  type Authorizer,
} from "../../../authorization/server";
import { Result } from "../../../shared/domain/Result";
import type { Cell } from "../../shared/sheet";
import {
  SheetDocumentNotFoundError,
  type InvalidSheetError,
  type SheetNotFoundError,
  type SheetRevisionConflictError,
  type SheetWriteError,
} from "../domain/errors";
import type { SpreadsheetDocuments } from "../domain/ports/SpreadsheetDocuments";
import { replaceSheetCells } from "../domain/replaceSheetCells";

export interface SaveSpreadsheetCommand {
  nanobookId: string;
  documentPath: string;
  /** Las filas tal como las cargó el lector: identifican la hoja dentro del documento. */
  original: readonly (readonly Cell[])[];
  next: readonly (readonly Cell[])[];
  actorId: string;
}

export type SaveSpreadsheetError =
  | AccessDeniedError
  | AccessCheckFailedError
  | SheetDocumentNotFoundError
  | SheetNotFoundError
  | InvalidSheetError
  | SheetRevisionConflictError
  | SheetWriteError;

/** Guarda en el documento las celdas editadas de una hoja. */
export class SaveSpreadsheet {
  constructor(
    private readonly authorizer: Authorizer,
    private readonly documents: SpreadsheetDocuments,
  ) {}

  async execute({ nanobookId, documentPath, original, next, actorId }: SaveSpreadsheetCommand): Promise<Result<SaveSpreadsheetError, void>> {
    const writable = await this.authorizer.require({
      subject: Subject.of(actorId),
      action: "write",
      resource: { type: "document", id: documentPath, nanobookId },
    });
    if (!writable.isSuccess) return Result.fail(writable.getError());

    const document = await this.documents.read(nanobookId, documentPath);
    if (!document) return Result.fail(new SheetDocumentNotFoundError(documentPath));

    const replaced = replaceSheetCells(document.content, original, next);
    if (!replaced.isSuccess) return Result.fail(replaced.getError());

    return this.documents.write(nanobookId, { ...document, content: replaced.getValue() }, actorId);
  }
}
