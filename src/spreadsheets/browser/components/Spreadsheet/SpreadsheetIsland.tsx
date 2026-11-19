import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { columnLabel, compareCells, parseCellInput, sheetWidth, type Cell } from "../../../shared/sheet";
import { canSaveSpreadsheet } from "../../canSaveSpreadsheet";
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
  // Con `ownerId` la sesión se comprueba en el cliente: hasta entonces no se muestra la barra.
  const [allowed, setAllowed] = useState(Boolean(context) && !context?.ownerId);
  useEffect(() => {
    if (!context?.ownerId) return;
    let active = true;
    void canSaveSpreadsheet(context).then((ok) => {
      if (active) setAllowed(ok);
    });
    return () => {
      active = false;
    };
  }, [context]);
  // Texto que el lector está escribiendo, por celda (`fila:columna`); se convierte en valor al salir de la celda.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const withDrafts = (source: Cell[][], pending: Record<string, string>) =>
    source.map((row, rowIndex) => row.map((cell, columnIndex) => {
      const draft = pending[`${rowIndex}:${columnIndex}`];
      return draft === undefined ? cell : parseCellInput(draft);
    }));
  const dirty = JSON.stringify(withDrafts(data, drafts)) !== JSON.stringify(saved);

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

  function commit(key: string) {
    const draft = drafts[key];
    if (draft === undefined) return;
    setData((current) => withDrafts(current, { [key]: draft }));
    setDrafts(({ [key]: _done, ...rest }) => rest);
    setStatus("idle");
  }

  async function save() {
    if (!context) return;
    const next = withDrafts(data, drafts);
    setData(next);
    setDrafts({});
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
                  const key = `${row.index}:${columnIndex}`;
                  return (
                    <td key={cell.id} className={typeof value === "number" ? "sheet-number" : undefined}>
                      {readOnly ? (
                        value ?? ""
                      ) : (
                        <input
                          value={drafts[key] ?? value ?? ""}
                          aria-label={`${columns?.[columnIndex] ?? columnLabel(columnIndex)}, fila ${row.index + 1}`}
                          onChange={(event) => {
                            const text = event.target.value;
                            setDrafts((current) => ({ ...current, [key]: text }));
                            setStatus("idle");
                          }}
                          onBlur={() => commit(key)}
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
      {allowed && !readOnly && (
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
