import type { AccessCheckFailedError, AccessDeniedError } from "../../../../authorization/server";
import type { DocumentModule } from "../../../../documents/server";
import type { Result } from "../../../../shared/domain/Result";
import type { SheetRevisionConflictError, SheetWriteError } from "../errors";

/** Mismo tipo que acepta `updateDocument` para `ref` (`Ref | string`), derivado sin exportar nada nuevo de `documents`. */
export type SheetRef = Parameters<DocumentModule["updateDocument"]["execute"]>[1]["ref"];

/** Un documento tal como lo necesita `spreadsheets` para leerlo y volver a guardarlo. */
export interface SheetDocument {
  id: string;
  path: string;
  title: string;
  description: string;
  content: string;
  revision: number;
  author?: string;
  cover?: string;
  tags?: string[];
  draft?: boolean;
  position?: number;
  ref?: SheetRef;
}

export type SheetWriteFailure =
  | AccessDeniedError
  | AccessCheckFailedError
  | SheetRevisionConflictError
  | SheetWriteError;

export interface SpreadsheetDocuments {
  /** El documento almacenado (sin proxies resueltos), o `null` si no existe. */
  read(nanobookId: string, documentPath: string): Promise<SheetDocument | null>;
  /** Guarda `document.content` exigiendo que la revisión siga siendo `document.revision`. */
  write(nanobookId: string, document: SheetDocument, actorId: string): Promise<Result<SheetWriteFailure, void>>;
}
