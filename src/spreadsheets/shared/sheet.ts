import { z } from "zod";

/** Una celda de hoja: texto, número o vacía. Las fechas se escriben como texto. */
export const cell = z.union([z.string().max(500), z.number().finite(), z.null()]);
export type Cell = z.infer<typeof cell>;

export const sheetColumns = z.array(z.string().trim().min(1, "La etiqueta de columna no puede estar vacía.").max(60)).min(1).max(26);
export const sheetRows = z.array(z.array(cell).min(1).max(26)).min(1).max(200);

export const totalFunctions = ["sum", "average", "min", "max", "count"] as const;
export type TotalFunction = (typeof totalFunctions)[number];

/** Etiqueta de columna al estilo Excel (A, B, … Z, AA…), para las hojas sin `columns`. */
export function columnLabel(index: number): string {
  let label = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  return label;
}

/** Orden de celdas de una columna: números (de menor a mayor), después texto, y las vacías al final. */
export function compareCells(a: Cell | undefined, b: Cell | undefined): number {
  const rank = (value: Cell | undefined) => (typeof value === "number" ? 0 : value === null || value === undefined || value === "" ? 2 : 1);
  const byRank = rank(a) - rank(b);
  if (byRank !== 0) return byRank;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), "es");
}

/** Ancho de la hoja: la fila más larga o, si hay más etiquetas que celdas, el número de etiquetas. */
export function sheetWidth(rows: readonly (readonly Cell[])[], columns?: readonly string[]): number {
  return Math.max(columns?.length ?? 0, ...rows.map((row) => row.length));
}

/** Resultado de una función sobre los números de una columna; `undefined` si no hay ninguno (salvo `count`, que da 0). */
export function columnTotal(
  rows: readonly (readonly Cell[])[],
  column: number,
  fn: TotalFunction,
): number | undefined {
  const numbers = rows.map((row) => row[column]).filter((value): value is number => typeof value === "number");
  if (fn === "count") return numbers.length;
  if (numbers.length === 0) return undefined;
  switch (fn) {
    case "sum":
      return numbers.reduce((total, value) => total + value, 0);
    case "average":
      return numbers.reduce((total, value) => total + value, 0) / numbers.length;
    case "min":
      return Math.min(...numbers);
    case "max":
      return Math.max(...numbers);
  }
}
