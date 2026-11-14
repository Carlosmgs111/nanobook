import { useState } from "react";
import Spreadsheet, { type CellBase, type Matrix } from "react-spreadsheet";
import { sheetWidth } from "../../../shared/sheet";
import type { SpreadsheetProps } from "./Spreadsheet.schema";

/**
 * Bloque `spreadsheet`, una isla de React sobre `react-spreadsheet`. El servidor
 * entrega la tabla ya pintada; al hidratar, la hoja admite selección con
 * teclado y, si el autor lo permite (`readOnly: false`), edición local: lo que
 * escribe el lector no se guarda en el documento.
 */
export default function SpreadsheetIsland({ title, columns, rows, readOnly }: SpreadsheetProps) {
  const width = sheetWidth(rows, columns);
  const [data, setData] = useState<Matrix<CellBase>>(() =>
    rows.map((row) => Array.from({ length: width }, (_, index) => ({ value: row[index] ?? "", readOnly }))),
  );

  return (
    <figure className="sheet">
      {title && <figcaption>{title}</figcaption>}
      <div className="sheet-scroll">
        <Spreadsheet data={data} onChange={setData} columnLabels={columns} />
      </div>
    </figure>
  );
}
