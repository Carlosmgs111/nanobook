import { z } from "zod";
import { sheetColumns, sheetRows } from "../../../shared/sheet";

export const spreadsheetProps = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    columns: sheetColumns.optional(),
    rows: sheetRows,
    /** Por defecto la hoja es de solo lectura; con `false` el lector puede editar las celdas en su navegador. */
    readOnly: z.boolean().default(true),
  })
  .strict();

export type SpreadsheetProps = z.infer<typeof spreadsheetProps>;
