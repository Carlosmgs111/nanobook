import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { columnLabel, compareCells, sheetWidth, type Cell } from "../../../shared/sheet";
import type { SpreadsheetProps } from "./Spreadsheet.schema";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});
const helper = createColumnHelper<typeof features, Cell[]>();

const ariaSort = { asc: "ascending", desc: "descending" } as const;

/**
 * Bloque `spreadsheet`, una isla de React sobre TanStack Table (sin marcado propio).
 * El servidor entrega la tabla completa, así que se lee sin JavaScript; al
 * hidratar, cada columna se ordena al pulsar su encabezado y, si el autor lo
 * permite (`readOnly: false`), las celdas se editan en el navegador: lo que
 * escribe el lector no se guarda en el documento.
 */
export default function SpreadsheetIsland({ title, columns, rows, readOnly }: SpreadsheetProps) {
  const width = sheetWidth(rows, columns);
  const [data, setData] = useState<Cell[][]>(() => rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? null)));

  const columnDefs = useMemo(
    () =>
      helper.columns(
        Array.from({ length: width }, (_, index) =>
          // Las celdas vacías son `undefined` para que `sortUndefined` las deje al final en ambos sentidos.
          helper.accessor((row) => (row[index] === null || row[index] === "" ? undefined : row[index]), {
            id: String(index),
            header: columns?.[index] ?? columnLabel(index),
            sortFn: (a, b, columnId) => compareCells(a.getValue(columnId), b.getValue(columnId)),
            sortUndefined: "last",
            sortDescFirst: false,
          }),
        ),
      ),
    [width, columns],
  );

  const table = useTable({ features, columns: columnDefs, data });

  function edit(rowIndex: number, columnIndex: number, text: string) {
    const value: Cell = text.trim() !== "" && Number.isFinite(Number(text)) ? Number(text) : text;
    setData((current) => current.map((row, index) => (index === rowIndex ? row.map((cell, i) => (i === columnIndex ? value : cell)) : row)));
  }

  return (
    <figure className="sheet">
      {title && <figcaption>{title}</figcaption>}
      <div className="sheet-scroll">
        <table>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th key={header.id} scope="col" aria-sort={sorted ? ariaSort[sorted] : "none"}>
                      <button type="button" onClick={header.column.getToggleSortingHandler()}>
                        <table.FlexRender header={header} />
                        <span aria-hidden="true">{sorted === "asc" ? " ▲" : sorted === "desc" ? " ▼" : ""}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getAllCells().map((cell, columnIndex) => {
                  const value = (cell.getValue() ?? null) as Cell;
                  return (
                    <td key={cell.id} className={typeof value === "number" ? "sheet-number" : undefined}>
                      {readOnly ? (
                        value ?? ""
                      ) : (
                        <input
                          value={value ?? ""}
                          aria-label={`${columns?.[columnIndex] ?? columnLabel(columnIndex)}, fila ${row.index + 1}`}
                          onChange={(event) => edit(row.index, columnIndex, event.target.value)}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
