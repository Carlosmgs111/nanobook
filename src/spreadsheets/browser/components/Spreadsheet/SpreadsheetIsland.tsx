import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { columnLabel, compareCells, sheetWidth, type Cell } from "../../../shared/sheet";
import { saveSpreadsheet, type SpreadsheetContext } from "../../saveSpreadsheet";
import type { SpreadsheetProps } from "./Spreadsheet.schema";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});
const helper = createColumnHelper<typeof features, Cell[]>();

const ariaSort = { asc: "ascending", desc: "descending" } as const;

type SaveStatus = "idle" | "saving" | "saved" | "stale" | "error";

const statusMessages: Record<SaveStatus, string> = {
  idle: "",
  saving: "Guardando…",
  saved: "Cambios guardados.",
  stale: "El documento cambió: recarga la página.",
  error: "No se pudo guardar.",
};

/**
 * Bloque `spreadsheet`, una isla de React sobre TanStack Table (sin marcado propio).
 * El servidor entrega la tabla completa, así que se lee sin JavaScript; al
 * hidratar, cada columna se ordena al pulsar su encabezado y, si el autor lo
 * permite (`readOnly: false`), las celdas se editan en el navegador: si la
 * página entrega un contexto de escritura, un botón guarda los cambios en el
 * documento; sin él, lo que escribe el lector queda solo en su pantalla.
 */
export default function SpreadsheetIsland({
  title,
  columns,
  rows,
  readOnly,
  context,
}: SpreadsheetProps & { context?: SpreadsheetContext }) {
  const width = sheetWidth(rows, columns);
  const pad = (source: readonly (readonly Cell[])[]) => source.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? null));
  const [data, setData] = useState<Cell[][]>(() => pad(rows));
  // Lo último que el servidor tiene guardado; identifica la hoja en el documento al guardar.
  const [saved, setSaved] = useState<Cell[][]>(() => pad(rows));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const dirty = JSON.stringify(data) !== JSON.stringify(saved);

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
    setStatus("idle");
  }

  async function save() {
    if (!context) return;
    const next = data;
    setStatus("saving");
    const outcome = await saveSpreadsheet(context, saved, next);
    if (outcome === "saved") setSaved(next);
    setStatus(outcome);
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
      {context && !readOnly && (
        <div className="sheet-actions">
          <button type="button" onClick={save} disabled={!dirty || status === "saving"}>
            Guardar cambios
          </button>
          <span role="status">{statusMessages[status]}</span>
        </div>
      )}
    </figure>
  );
}
