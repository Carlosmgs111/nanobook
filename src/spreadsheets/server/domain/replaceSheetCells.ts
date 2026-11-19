import remarkParse from "remark-parse";
import { unified } from "unified";
import { parse, parseDocument } from "yaml";
import { Result } from "../../../shared/domain/Result";
import { sheetRows, type Cell } from "../../shared/sheet";
import { InvalidSheetError, SheetNotFoundError } from "./errors";

type Rows = readonly (readonly Cell[])[];
export type SheetEditError = SheetNotFoundError | InvalidSheetError;

interface FenceNode {
  type: string;
  lang?: string | null;
  value: string;
  position?: { start: { offset?: number }; end: { offset?: number } };
}

/** Un fence `spreadsheet` de raíz: dónde está su cuerpo en el Markdown y sus filas ya leídas. */
interface SheetFence {
  start: number;
  end: number;
  body: string;
  rows: Rows;
}

const CLOSING_FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

function rowsOf(body: string): Rows | undefined {
  try {
    const rows = (parse(body) as { rows?: unknown } | null)?.rows;
    return sheetRows.safeParse(rows).success ? (rows as Rows) : undefined;
  } catch {
    return undefined;
  }
}

/** Solo los hijos directos de la raíz: son los únicos que `rendering` monta como bloque. */
function sheetFences(markdown: string): SheetFence[] {
  const tree = unified().use(remarkParse).parse(markdown) as unknown as { children: FenceNode[] };
  const fences: SheetFence[] = [];
  for (const node of tree.children) {
    const from = node.position?.start.offset;
    const to = node.position?.end.offset;
    if (node.type !== "code" || node.lang !== "spreadsheet" || from === undefined || to === undefined) continue;

    const raw = markdown.slice(from, to);
    const firstBreak = raw.indexOf("\n");
    const lastBreak = raw.lastIndexOf("\n");
    if (firstBreak === -1 || lastBreak <= firstBreak) continue;
    if (!CLOSING_FENCE.test(raw.slice(lastBreak + 1).replace(/\r$/, ""))) continue;

    const start = from + firstBreak + 1;
    const end = from + (raw[lastBreak - 1] === "\r" ? lastBreak - 1 : lastBreak);
    const body = markdown.slice(start, end);
    // Un fence con sangría tiene un cuerpo distinto del que ve el parser: no se reescribe.
    if (body.replaceAll("\r\n", "\n") !== node.value.replaceAll("\r\n", "\n")) continue;

    const rows = rowsOf(body);
    if (rows) fences.push({ start, end, body, rows });
  }
  return fences;
}

const withoutTrailingNulls = (rows: Rows) =>
  rows.map((row) => {
    let end = row.length;
    while (end > 0 && row[end - 1] === null) end--;
    return row.slice(0, end);
  });

const sameRows = (a: Rows, b: Rows) => JSON.stringify(withoutTrailingNulls(a)) === JSON.stringify(withoutTrailingNulls(b));

function patch({ body, rows }: SheetFence, next: Rows): Result<InvalidSheetError, string> {
  if (next.length !== rows.length) return Result.fail(new InvalidSheetError("No se pueden añadir ni quitar filas."));

  const document = parseDocument(body);
  next.forEach((after, r) => {
    const before = rows[r];
    const cell = (index: number) => after[index] ?? null;
    let lastChanged = -1;
    after.forEach((_, c) => {
      if (cell(c) !== (before[c] ?? null)) lastChanged = c;
    });
    // Las celdas más allá del final de la fila se rellenan con null hasta la última editada.
    for (let c = 0; c < Math.max(before.length, lastChanged + 1); c++) {
      if (c >= before.length || cell(c) !== before[c]) document.setIn(["rows", r, c], cell(c));
    }
  });

  const valid = sheetRows.safeParse((document.toJS() as { rows?: unknown }).rows);
  if (!valid.success) return Result.fail(new InvalidSheetError(valid.error.issues.map((issue) => issue.message).join("; ")));

  const text = document
    .toString({ lineWidth: 0, flowCollectionPadding: false, indentSeq: !/^rows:[ \t]*\r?\n-/m.test(body) })
    .replace(/\n$/, "");
  return Result.ok(body.includes("\r\n") ? text.replaceAll("\n", "\r\n") : text);
}

/**
 * Reemplaza en `markdown` las celdas de la hoja cuyo contenido es `original` por las de `next`.
 * Solo toca las celdas distintas, así los comentarios y el estilo del autor se conservan.
 */
export function replaceSheetCells(markdown: string, original: Rows, next: Rows): Result<SheetEditError, string> {
  const fence = sheetFences(markdown).find(({ rows }) => sameRows(rows, original));
  if (!fence) return Result.fail(new SheetNotFoundError());

  const patched = patch(fence, next);
  if (!patched.isSuccess) return Result.fail(patched.getError());
  return Result.ok(markdown.slice(0, fence.start) + patched.getValue() + markdown.slice(fence.end));
}
