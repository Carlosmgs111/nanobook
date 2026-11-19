import type { AccessCheckFailedError, AccessDeniedError } from "../../../../authorization/server";
import type { Result } from "../../../../shared/domain/Result";
import type { SheetRevisionConflictError, SheetWriteError } from "../errors";

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
  ref?: string;
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
