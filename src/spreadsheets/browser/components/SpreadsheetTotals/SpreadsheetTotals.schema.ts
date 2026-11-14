import { z } from "zod";
import { sheetColumns, sheetRows, totalFunctions } from "../../../shared/sheet";

export const spreadsheetTotalsProps = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    columns: sheetColumns,
    rows: sheetRows,
    functions: z.array(z.enum(totalFunctions)).min(1).max(totalFunctions.length).default(["sum"]),
  })
  .strict();

export type SpreadsheetTotalsProps = z.infer<typeof spreadsheetTotalsProps>;
