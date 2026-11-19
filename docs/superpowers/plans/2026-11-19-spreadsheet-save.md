# Guardar los cambios de una hoja en el documento — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que un escritor edite celdas de un bloque `spreadsheet` en la página publicada y las guarde en el documento con un botón, reescribiendo solo las celdas cambiadas del fence YAML.

**Architecture:** `spreadsheets` gana una parte de servidor (`spreadsheets/server`, tres capas + compositor) que recibe `documentModule` y `Authorizer` por inyección. Un puerto `SpreadsheetDocuments` con un adaptador sobre `documentModule.getDocument.executeRaw` / `updateDocument.execute` (mismo patrón que `DocumentModuleRootDocument` en `nanobooks`). `rendering` solo reenvía un `context` opaco a los bloques.

**Tech Stack:** TypeScript, Astro 7 (SSR), React 19, `yaml` (Document API), `unified` + `remark-parse`, `zod`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-16-block-edit-persistence-design.md`

**Precondiciones**
- Trabajar en el worktree `D:\Documentos\Desktop\nanobook-framework-blocks`, rama `preview`.
- Cerrar antes el merge en curso en `preview` (conflicto en `CHANGELOG.md`). Con un merge abierto los commits de este plan fallan o lo arrastran.
- `CLAUDE.md` exige `npm run build` antes de cada commit: cada paso de commit lo incluye.
- Los mensajes de commit terminan con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

**Comportamiento fijado por este plan**
- La dirección del fence es **su contenido original**: la isla envía `original` (las filas que cargó) y `next`; el servidor reemplaza el primer fence `spreadsheet` de raíz cuyas filas coinciden con `original` (ignorando `null` finales). Sin coincidencia → 409.
- Solo se reescriben las celdas distintas, con el Document API de `yaml`; comentarios y estilo se conservan (los comentarios quedan con un espacio antes de `#`).
- No se añaden ni quitan filas.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/spreadsheets/server/domain/errors.ts` (nuevo) | Errores del dominio de guardado |
| `src/spreadsheets/server/domain/replaceSheetCells.ts` (nuevo) | Función pura: localiza el fence y parchea celdas |
| `src/spreadsheets/server/domain/ports/SpreadsheetDocuments.ts` (nuevo) | Puerto de lectura/escritura de documentos |
| `src/spreadsheets/server/application/SaveSpreadsheet.ts` (nuevo) | Caso de uso: permiso → leer → reemplazar → guardar |
| `src/spreadsheets/server/infraestructure/documents/DocumentModuleSpreadsheetDocuments.ts` (nuevo) | Adaptador sobre `documentModule` |
| `src/spreadsheets/server/infraestructure/rest/SaveSpreadsheetController.ts` (nuevo) | Cuerpo, sesión y traducción de errores a HTTP |
| `src/spreadsheets/server/index.ts` (nuevo) | Compositor `SpreadsheetsServerModule` |
| `src/pages/api/nanobooks/[nanobookId]/spreadsheets.ts` (nuevo) | Ruta `PATCH` |
| `src/documents/server/index.ts` | Exporta `DocumentRevisionConflictError` |
| `src/application/server/Application.ts` | Compone `SpreadsheetsServerModule` |
| `src/spreadsheets/browser/saveSpreadsheet.ts` (nuevo) | Cliente `fetch` del guardado |
| `src/spreadsheets/browser/components/Spreadsheet/SpreadsheetIsland.tsx` | Botón, estado y cambios pendientes |
| `src/spreadsheets/browser/ui/styles/spreadsheets.css` | Estilo de la barra de acciones |
| `src/rendering/browser/ui/RenderedDocument.astro`, `BlockHost.astro` | Reenvío del `context` opaco |
| `src/documents/browser/ui/pages/DocumentPage.astro` | Pasa `context` solo si `canEdit` |

---

### Task 1: Errores y `replaceSheetCells` (dominio puro)

**Files:**
- Create: `src/spreadsheets/server/domain/errors.ts`
- Create: `src/spreadsheets/server/domain/replaceSheetCells.ts`
- Test: `src/spreadsheets/server/domain/replaceSheetCells.test.ts`

- [ ] **Step 1: Crear los errores**

```ts
// src/spreadsheets/server/domain/errors.ts
/** El documento ya no contiene la hoja tal como la cargó el lector. */
export class SheetNotFoundError extends Error {
  constructor() {
    super("La hoja ya no coincide con el documento: recarga la página.");
    this.name = "SheetNotFoundError";
  }
}

/** El cambio pedido no produce una hoja válida. */
export class InvalidSheetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSheetError";
  }
}

export class SheetDocumentNotFoundError extends Error {
  constructor(public readonly documentPath: string) {
    super(`El documento "${documentPath}" no existe`);
    this.name = "SheetDocumentNotFoundError";
  }
}

/** El documento cambió entre la lectura y el guardado. */
export class SheetRevisionConflictError extends Error {
  constructor() {
    super("El documento cambió mientras editabas: recarga la página.");
    this.name = "SheetRevisionConflictError";
  }
}

export class SheetWriteError extends Error {
  constructor(cause: unknown) {
    super("No se pudo guardar el documento", { cause });
    this.name = "SheetWriteError";
  }
}
```

- [ ] **Step 2: Escribir las pruebas que fallan**

```ts
// src/spreadsheets/server/domain/replaceSheetCells.test.ts
import { describe, expect, it } from "vitest";
import { InvalidSheetError, SheetNotFoundError } from "./errors";
import { replaceSheetCells } from "./replaceSheetCells";

const sample = `# Ventas

\`\`\`spreadsheet
# datos oficiales
columns: [Región, Enero]
rows:
  - [Norte, 120] # la mayor
  - [Sur, 98]
\`\`\`

Texto final.
`;
const rows = [["Norte", 120], ["Sur", 98]];
const edited = [["Norte", 120], ["Sur", 105]];

describe("replaceSheetCells", () => {
  it("changes only the edited cell and keeps comments and style", () => {
    const result = replaceSheetCells(sample, rows, edited);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toContain("- [Sur, 105]");
    expect(result.getValue().replace("[Sur, 105]", "[Sur, 98]")).toBe(sample);
  });

  it("accepts rows padded with nulls, as the island sends them", () => {
    const result = replaceSheetCells(sample, [["Norte", 120, null], ["Sur", 98, null]], [["Norte", 120, null], ["Sur", 105, null]]);

    expect(result.getValue()).toContain("- [Sur, 105]");
  });

  it("extends a short row up to an edited cell", () => {
    const source = "```spreadsheet\nrows:\n  - [Norte, 120]\n  - [Sur]\n```\n";

    const result = replaceSheetCells(source, [["Norte", 120], ["Sur"]], [["Norte", 120], ["Sur", null, 5]]);

    expect(result.getValue()).toContain("- [Sur, null, 5]");
  });

  it("fails when no sheet matches the original rows", () => {
    const result = replaceSheetCells(sample, [["Norte", 1]], edited);

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(SheetNotFoundError);
  });

  it("edits the matching sheet and leaves the others untouched", () => {
    const other = "```spreadsheet\nrows:\n  - [a, 1]\n```\n";
    const source = `${other}\n${sample}`;

    const result = replaceSheetCells(source, rows, edited).getValue();

    expect(result.startsWith(other)).toBe(true);
    expect(result).toContain("- [Sur, 105]");
  });

  it("edits the first of two identical sheets", () => {
    const source = `${sample}\n${sample}`;

    const result = replaceSheetCells(source, rows, edited).getValue();

    expect(result.indexOf("[Sur, 105]")).toBeLessThan(result.lastIndexOf("[Sur, 98]"));
    expect(result.split("[Sur, 105]")).toHaveLength(2);
  });

  it("ignores spreadsheet fences nested in other blocks", () => {
    const nested = "- item\n\n    ```spreadsheet\n    rows:\n      - [a]\n    ```\n";

    const result = replaceSheetCells(nested, [["a"]], [["b"]]);

    expect(result.getError()).toBeInstanceOf(SheetNotFoundError);
  });

  it("rejects an edit that makes the sheet invalid", () => {
    const result = replaceSheetCells(sample, rows, [["Norte", 120], ["Sur", "x".repeat(501)]]);

    expect(result.getError()).toBeInstanceOf(InvalidSheetError);
  });

  it("rejects adding or removing rows", () => {
    const result = replaceSheetCells(sample, rows, [["Norte", 120]]);

    expect(result.getError()).toBeInstanceOf(InvalidSheetError);
  });

  it("keeps CRLF line endings", () => {
    const crlf = sample.replaceAll("\n", "\r\n");

    const result = replaceSheetCells(crlf, rows, edited).getValue();

    expect(result).toContain("[Sur, 105]");
    expect(/(?<!\r)\n/.test(result)).toBe(false);
  });
});
```

- [ ] **Step 3: Ejecutar y ver que falla**

Run: `npx vitest run src/spreadsheets/server/domain/replaceSheetCells.test.ts`
Expected: FAIL (`Cannot find module './replaceSheetCells'`).

- [ ] **Step 4: Implementar**

```ts
// src/spreadsheets/server/domain/replaceSheetCells.ts
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
```

- [ ] **Step 5: Ejecutar y ver que pasa**

Run: `npx vitest run src/spreadsheets/server/domain/replaceSheetCells.test.ts`
Expected: PASS (10 tests). Si falla la igualdad byte a byte del primero, imprimir el resultado y ajustar solo las opciones de `toString` (`flowCollectionPadding`, `lineWidth`, `indentSeq`); no relajar la prueba.

- [ ] **Step 6: Commit**

```bash
npm run build && git add src/spreadsheets/server/domain && git commit -m "feat(spreadsheets): reemplaza celdas de una hoja en el fence conservando el estilo

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Puerto y caso de uso `SaveSpreadsheet`

**Files:**
- Create: `src/spreadsheets/server/domain/ports/SpreadsheetDocuments.ts`
- Create: `src/spreadsheets/server/application/SaveSpreadsheet.ts`
- Test: `src/spreadsheets/server/application/SaveSpreadsheet.test.ts`

- [ ] **Step 1: Crear el puerto**

```ts
// src/spreadsheets/server/domain/ports/SpreadsheetDocuments.ts
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
```

- [ ] **Step 2: Escribir las pruebas que fallan**

```ts
// src/spreadsheets/server/application/SaveSpreadsheet.test.ts
import { describe, expect, it, vi } from "vitest";
import { AccessDeniedError, createAuthorizer, type Policy } from "../../../authorization/server";
import { Result } from "../../../shared/domain/Result";
import { SheetDocumentNotFoundError, SheetNotFoundError, SheetRevisionConflictError } from "../domain/errors";
import type { SheetDocument, SpreadsheetDocuments } from "../domain/ports/SpreadsheetDocuments";
import { SaveSpreadsheet } from "./SaveSpreadsheet";

const policy = (effect: "allow" | "deny"): Policy => ({
  appliesTo: ["document"],
  evaluate: async () => (effect === "allow" ? { effect: "allow" } : { effect: "deny", reason: "forbidden" }),
});

const stored: SheetDocument = {
  id: "doc-1",
  path: "ventas",
  title: "Ventas",
  description: "",
  content: "```spreadsheet\nrows:\n  - [Sur, 98]\n```\n",
  revision: 4,
};
const command = {
  nanobookId: "book-a",
  documentPath: "ventas",
  original: [["Sur", 98]],
  next: [["Sur", 105]],
  actorId: "writer",
};

function setup(effect: "allow" | "deny" = "allow", overrides: Partial<SpreadsheetDocuments> = {}) {
  const documents: SpreadsheetDocuments = {
    read: vi.fn().mockResolvedValue(stored),
    write: vi.fn().mockResolvedValue(Result.ok()),
    ...overrides,
  };
  return { documents, useCase: new SaveSpreadsheet(createAuthorizer([policy(effect)]), documents) };
}

describe("SaveSpreadsheet", () => {
  it("saves the edited content with the revision it read", async () => {
    const { documents, useCase } = setup();

    const result = await useCase.execute(command);

    expect(result.isSuccess).toBe(true);
    expect(documents.write).toHaveBeenCalledWith(
      "book-a",
      { ...stored, content: "```spreadsheet\nrows:\n  - [Sur, 105]\n```\n" },
      "writer",
    );
  });

  it("does not read the document when the actor cannot write", async () => {
    const { documents, useCase } = setup("deny");

    const result = await useCase.execute(command);

    expect(result.getError()).toBeInstanceOf(AccessDeniedError);
    expect(documents.read).not.toHaveBeenCalled();
    expect(documents.write).not.toHaveBeenCalled();
  });

  it("fails when the document does not exist", async () => {
    const { useCase } = setup("allow", { read: vi.fn().mockResolvedValue(null) });

    expect((await useCase.execute(command)).getError()).toBeInstanceOf(SheetDocumentNotFoundError);
  });

  it("does not write when the sheet changed", async () => {
    const { documents, useCase } = setup();

    const result = await useCase.execute({ ...command, original: [["Sur", 1]] });

    expect(result.getError()).toBeInstanceOf(SheetNotFoundError);
    expect(documents.write).not.toHaveBeenCalled();
  });

  it("returns the write failure", async () => {
    const { useCase } = setup("allow", { write: vi.fn().mockResolvedValue(Result.fail(new SheetRevisionConflictError())) });

    expect((await useCase.execute(command)).getError()).toBeInstanceOf(SheetRevisionConflictError);
  });
});
```

- [ ] **Step 3: Ejecutar y ver que falla**

Run: `npx vitest run src/spreadsheets/server/application/SaveSpreadsheet.test.ts`
Expected: FAIL (`Cannot find module './SaveSpreadsheet'`).

- [ ] **Step 4: Implementar**

```ts
// src/spreadsheets/server/application/SaveSpreadsheet.ts
import {
  Subject,
  type AccessCheckFailedError,
  type AccessDeniedError,
  type Authorizer,
} from "../../../authorization/server";
import { Result } from "../../../shared/domain/Result";
import type { Cell } from "../../shared/sheet";
import {
  SheetDocumentNotFoundError,
  type InvalidSheetError,
  type SheetNotFoundError,
  type SheetRevisionConflictError,
  type SheetWriteError,
} from "../domain/errors";
import type { SpreadsheetDocuments } from "../domain/ports/SpreadsheetDocuments";
import { replaceSheetCells } from "../domain/replaceSheetCells";

export interface SaveSpreadsheetCommand {
  nanobookId: string;
  documentPath: string;
  /** Las filas tal como las cargó el lector: identifican la hoja dentro del documento. */
  original: readonly (readonly Cell[])[];
  next: readonly (readonly Cell[])[];
  actorId: string;
}

export type SaveSpreadsheetError =
  | AccessDeniedError
  | AccessCheckFailedError
  | SheetDocumentNotFoundError
  | SheetNotFoundError
  | InvalidSheetError
  | SheetRevisionConflictError
  | SheetWriteError;

/** Guarda en el documento las celdas editadas de una hoja. */
export class SaveSpreadsheet {
  constructor(
    private readonly authorizer: Authorizer,
    private readonly documents: SpreadsheetDocuments,
  ) {}

  async execute({ nanobookId, documentPath, original, next, actorId }: SaveSpreadsheetCommand): Promise<Result<SaveSpreadsheetError, void>> {
    const writable = await this.authorizer.require({
      subject: Subject.of(actorId),
      action: "write",
      resource: { type: "document", id: documentPath, nanobookId },
    });
    if (!writable.isSuccess) return Result.fail(writable.getError());

    const document = await this.documents.read(nanobookId, documentPath);
    if (!document) return Result.fail(new SheetDocumentNotFoundError(documentPath));

    const replaced = replaceSheetCells(document.content, original, next);
    if (!replaced.isSuccess) return Result.fail(replaced.getError());

    return this.documents.write(nanobookId, { ...document, content: replaced.getValue() }, actorId);
  }
}
```

- [ ] **Step 5: Ejecutar y ver que pasa**

Run: `npx vitest run src/spreadsheets/server/application/SaveSpreadsheet.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
npm run build && git add src/spreadsheets/server && git commit -m "feat(spreadsheets): caso de uso SaveSpreadsheet y puerto de documentos

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Adaptador sobre `documentModule`

**Files:**
- Modify: `src/documents/server/index.ts` (línea del `export { DocumentRepositoryError }`)
- Create: `src/spreadsheets/server/infraestructure/documents/DocumentModuleSpreadsheetDocuments.ts`
- Test: `src/spreadsheets/server/infraestructure/documents/DocumentModuleSpreadsheetDocuments.test.ts`

- [ ] **Step 1: Exportar el error de conflicto de revisión**

En `src/documents/server/index.ts`, reemplazar

```ts
export { DocumentRepositoryError } from "./domain/errors";
```

por

```ts
export { DocumentRepositoryError, DocumentRevisionConflictError } from "./domain/errors";
```

- [ ] **Step 2: Escribir las pruebas que fallan**

```ts
// src/spreadsheets/server/infraestructure/documents/DocumentModuleSpreadsheetDocuments.test.ts
import { describe, expect, it, vi } from "vitest";
import { AccessDeniedError } from "../../../../authorization/server";
import { DocumentRevisionConflictError } from "../../../../documents/server";
import { Result } from "../../../../shared/domain/Result";
import { SheetRevisionConflictError, SheetWriteError } from "../../domain/errors";
import { DocumentModuleSpreadsheetDocuments } from "./DocumentModuleSpreadsheetDocuments";

vi.mock("../../../../shared/infrastructure/database/drizzleDatabase", () => ({ db: {} }));
vi.mock("astro:env/server", () => ({ GITHUB_TOKEN: undefined, BETTER_AUTH_SECRET: undefined }));

const stored = {
  getDocumentId: () => ({ getValue: () => "doc-1" }),
  getPath: () => "ventas",
  getTitle: () => "Ventas",
  getDescription: () => "Resumen",
  getContent: () => "cuerpo",
  getRevision: () => 4,
  getPosition: () => 2,
  getReference: () => null,
  getMetadata: () => ({ author: "Autora", cover: "c.png", tags: ["a"], draft: false }),
};

function setup(update: unknown = Result.ok(stored)) {
  const documents = {
    getDocument: { executeRaw: vi.fn().mockResolvedValue(stored) },
    updateDocument: { execute: vi.fn().mockResolvedValue(update) },
  };
  return { documents, adapter: new DocumentModuleSpreadsheetDocuments(documents as never) };
}

describe("DocumentModuleSpreadsheetDocuments", () => {
  it("reads the stored document by public path", async () => {
    const { documents, adapter } = setup();

    const document = await adapter.read("book-a", "ventas");

    expect(documents.getDocument.executeRaw).toHaveBeenCalledWith("book-a", "ventas");
    expect(document).toEqual({
      id: "doc-1",
      path: "ventas",
      title: "Ventas",
      description: "Resumen",
      content: "cuerpo",
      revision: 4,
      author: "Autora",
      cover: "c.png",
      tags: ["a"],
      draft: false,
      position: 2,
      ref: undefined,
    });
  });

  it("returns null when the document does not exist", async () => {
    const { documents, adapter } = setup();
    documents.getDocument.executeRaw.mockResolvedValue(null);

    expect(await adapter.read("book-a", "nada")).toBeNull();
  });

  it("writes with the revision it read as the expected one", async () => {
    const { documents, adapter } = setup();
    const document = (await adapter.read("book-a", "ventas"))!;

    const result = await adapter.write("book-a", { ...document, content: "nuevo" }, "writer");

    expect(result.isSuccess).toBe(true);
    expect(documents.updateDocument.execute).toHaveBeenCalledWith(
      "book-a",
      expect.objectContaining({ id: "doc-1", path: "ventas", content: "nuevo", expectedRevision: 4 }),
      "writer",
    );
    expect(documents.updateDocument.execute.mock.calls[0][1]).not.toHaveProperty("revision");
  });

  it("maps a revision conflict, keeps access errors and wraps the rest", async () => {
    const denied = new AccessDeniedError({ effect: "deny", reason: "forbidden" });
    const cases: [unknown, unknown][] = [
      [new DocumentRevisionConflictError("doc-1", 4, 5), SheetRevisionConflictError],
      [denied, AccessDeniedError],
      [new Error("boom"), SheetWriteError],
    ];

    for (const [error, expected] of cases) {
      const { adapter } = setup(Result.fail(error));
      const document = (await adapter.read("book-a", "ventas"))!;

      const result = await adapter.write("book-a", document, "writer");

      expect(result.getError()).toBeInstanceOf(expected);
    }
  });
});
```

- [ ] **Step 3: Ejecutar y ver que falla**

Run: `npx vitest run src/spreadsheets/server/infraestructure/documents`
Expected: FAIL (`Cannot find module './DocumentModuleSpreadsheetDocuments'`).

- [ ] **Step 4: Implementar**

```ts
// src/spreadsheets/server/infraestructure/documents/DocumentModuleSpreadsheetDocuments.ts
import { AccessCheckFailedError, AccessDeniedError } from "../../../../authorization/server";
import { DocumentRevisionConflictError, type DocumentModule } from "../../../../documents/server";
import { Result } from "../../../../shared/domain/Result";
import { SheetRevisionConflictError, SheetWriteError } from "../../domain/errors";
import type { SheetDocument, SheetWriteFailure, SpreadsheetDocuments } from "../../domain/ports/SpreadsheetDocuments";

/** Adaptador del puerto sobre las capacidades de lectura y escritura que ya expone `documents`. */
export class DocumentModuleSpreadsheetDocuments implements SpreadsheetDocuments {
  constructor(private readonly documents: Pick<DocumentModule, "getDocument" | "updateDocument">) {}

  async read(nanobookId: string, documentPath: string): Promise<SheetDocument | null> {
    // El documento almacenado, no el resuelto con proxies: lo que se guarda no puede contener contenido ajeno.
    const document = await this.documents.getDocument.executeRaw(nanobookId, documentPath);
    if (!document) return null;

    const metadata = document.getMetadata();
    return {
      id: document.getDocumentId().getValue(),
      path: document.getPath(),
      title: document.getTitle(),
      description: document.getDescription(),
      content: document.getContent(),
      revision: document.getRevision(),
      author: metadata.author,
      cover: metadata.cover,
      tags: metadata.tags,
      draft: metadata.draft,
      position: document.getPosition(),
      ref: document.getReference()?.getValue(),
    };
  }

  async write(nanobookId: string, document: SheetDocument, actorId: string): Promise<Result<SheetWriteFailure, void>> {
    const { revision, ...fields } = document;
    const result = await this.documents.updateDocument.execute(nanobookId, { ...fields, expectedRevision: revision }, actorId);
    if (result.isSuccess) return Result.ok();

    const error = result.getError();
    if (error instanceof AccessDeniedError || error instanceof AccessCheckFailedError) return Result.fail(error);
    if (error instanceof DocumentRevisionConflictError) return Result.fail(new SheetRevisionConflictError());
    return Result.fail(new SheetWriteError(error));
  }
}
```

- [ ] **Step 5: Ejecutar y ver que pasa**

Run: `npx vitest run src/spreadsheets/server/infraestructure/documents`
Expected: PASS (4 tests). Si `tsc`/Astro se queja del tipo de `ref`, ajustar `SheetDocument.ref` al tipo de `DocumentInput.ref` (`Ref | string`).

- [ ] **Step 6: Commit**

```bash
npm run build && git add src/documents/server/index.ts src/spreadsheets/server && git commit -m "feat(spreadsheets): adaptador de documentos sobre documentModule

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Controlador, compositor, ruta y composición

**Files:**
- Create: `src/spreadsheets/server/infraestructure/rest/SaveSpreadsheetController.ts`
- Test: `src/spreadsheets/server/infraestructure/rest/SaveSpreadsheetController.test.ts`
- Create: `src/spreadsheets/server/index.ts`
- Create: `src/pages/api/nanobooks/[nanobookId]/spreadsheets.ts`
- Modify: `src/application/server/Application.ts`
- Modify: `src/application/server/Application.test.ts`

- [ ] **Step 1: Escribir las pruebas del controlador**

```ts
// src/spreadsheets/server/infraestructure/rest/SaveSpreadsheetController.test.ts
import { describe, expect, it, vi } from "vitest";
import { AccessDeniedError } from "../../../../authorization/server";
import { Result } from "../../../../shared/domain/Result";
import { InvalidSheetError, SheetNotFoundError, SheetRevisionConflictError } from "../../domain/errors";
import { SaveSpreadsheetController } from "./SaveSpreadsheetController";

const body = { documentPath: "ventas", original: [["Sur", 98]], next: [["Sur", 105]] };

function call(result: Result<unknown, void>, { user = "writer", payload = body as unknown, params = { nanobookId: "book-a" } } = {}) {
  const useCase = { execute: vi.fn().mockResolvedValue(result) };
  const controller = new SaveSpreadsheetController(useCase as never);
  const request = new Request("http://localhost/api", { method: "PATCH", body: typeof payload === "string" ? payload : JSON.stringify(payload) });
  return controller.handle({ params, request, locals: { currentUserId: user } } as never).then((response) => ({ response, useCase }));
}

describe("SaveSpreadsheetController", () => {
  it("passes the command to the use case and answers 200", async () => {
    const { response, useCase } = await call(Result.ok());

    expect(response.status).toBe(200);
    expect(useCase.execute).toHaveBeenCalledWith({ nanobookId: "book-a", actorId: "writer", ...body });
  });

  it("requires a session", async () => {
    const { response, useCase } = await call(Result.ok(), { user: undefined as never });

    expect(response.status).toBe(401);
    expect(useCase.execute).not.toHaveBeenCalled();
  });

  it("rejects an invalid body", async () => {
    expect((await call(Result.ok(), { payload: "no es json" })).response.status).toBe(400);
    expect((await call(Result.ok(), { payload: { documentPath: "" } })).response.status).toBe(400);
  });

  it.each([
    [new SheetNotFoundError(), 409],
    [new SheetRevisionConflictError(), 409],
    [new InvalidSheetError("x"), 422],
    [new AccessDeniedError({ effect: "deny", reason: "forbidden" }), 403],
    [new Error("boom"), 500],
  ])("translates %o to %i", async (error, status) => {
    const { response } = await call(Result.fail(error));

    expect(response.status).toBe(status);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx vitest run src/spreadsheets/server/infraestructure/rest`
Expected: FAIL (`Cannot find module './SaveSpreadsheetController'`).

- [ ] **Step 3: Implementar el controlador**

```ts
// src/spreadsheets/server/infraestructure/rest/SaveSpreadsheetController.ts
import type { APIRoute } from "astro";
import { z } from "zod";
import { AccessCheckFailedError, AccessDeniedError, accessErrorResponse } from "../../../../authorization/server";
import { sheetRows } from "../../../shared/sheet";
import type { SaveSpreadsheet, SaveSpreadsheetError } from "../../application/SaveSpreadsheet";
import {
  InvalidSheetError,
  SheetDocumentNotFoundError,
  SheetNotFoundError,
  SheetRevisionConflictError,
} from "../../domain/errors";

const body = z.object({ documentPath: z.string().min(1), original: sheetRows, next: sheetRows }).strict();

const json = (payload: unknown, status: number) => Response.json(payload, { status });

function toResponse(error: SaveSpreadsheetError): Response {
  if (error instanceof AccessDeniedError || error instanceof AccessCheckFailedError) return accessErrorResponse(error);
  if (error instanceof SheetDocumentNotFoundError) return json({ error: error.message }, 404);
  if (error instanceof SheetNotFoundError || error instanceof SheetRevisionConflictError) return json({ error: error.message }, 409);
  if (error instanceof InvalidSheetError) return json({ error: error.message }, 422);
  console.error(error);
  return json({ error: "Error interno del servidor" }, 500);
}

export class SaveSpreadsheetController {
  constructor(private readonly saveSpreadsheet: SaveSpreadsheet) {}

  handle: APIRoute = async ({ params, request, locals }) => {
    try {
      const { nanobookId } = params;
      if (!nanobookId) return json({ error: "Falta el parámetro nanobookId" }, 400);
      if (!locals.currentUserId) return json({ error: "Autenticación requerida" }, 401);

      const payload = body.safeParse(await request.json().catch(() => undefined));
      if (!payload.success) return json({ error: "Cuerpo inválido" }, 400);

      const result = await this.saveSpreadsheet.execute({ nanobookId, actorId: locals.currentUserId, ...payload.data });
      return result.isSuccess ? json({ ok: true }, 200) : toResponse(result.getError());
    } catch (error) {
      console.error(error);
      return json({ error: "Error interno del servidor" }, 500);
    }
  };
}
```

- [ ] **Step 3b: Ejecutar y ver que pasa**

Run: `npx vitest run src/spreadsheets/server/infraestructure/rest`
Expected: PASS.

- [ ] **Step 4: Crear el compositor**

```ts
// src/spreadsheets/server/index.ts
import type { Authorizer } from "../../authorization/server";
import type { DocumentModule } from "../../documents/server";
import { SaveSpreadsheet } from "./application/SaveSpreadsheet";
import { DocumentModuleSpreadsheetDocuments } from "./infraestructure/documents/DocumentModuleSpreadsheetDocuments";
import { SaveSpreadsheetController } from "./infraestructure/rest/SaveSpreadsheetController";

/** Compositor del lado servidor de `spreadsheets`: guarda en el documento los cambios de una hoja. */
export class SpreadsheetsServerModule {
  private constructor(
    public readonly saveSpreadsheet: SaveSpreadsheet,
    public readonly saveSpreadsheetController: SaveSpreadsheetController,
  ) {}

  static create(documents: Pick<DocumentModule, "getDocument" | "updateDocument">, authorizer: Authorizer): SpreadsheetsServerModule {
    const saveSpreadsheet = new SaveSpreadsheet(authorizer, new DocumentModuleSpreadsheetDocuments(documents));
    return new SpreadsheetsServerModule(saveSpreadsheet, new SaveSpreadsheetController(saveSpreadsheet));
  }
}
```

- [ ] **Step 5: Crear la ruta**

```ts
// src/pages/api/nanobooks/[nanobookId]/spreadsheets.ts
import type { APIRoute } from "astro";
import { getApp } from "../../../../application/server/Application";

export const prerender = false;

const app = await getApp();

export const PATCH: APIRoute = app.routeProtector.protect(app.spreadsheetsServerModule.saveSpreadsheetController.handle);
```

- [ ] **Step 6: Componer en `Application`**

En `src/application/server/Application.ts`:

1. Añadir el import junto a `SpreadsheetsModule`:

```ts
import { SpreadsheetsServerModule } from "../../spreadsheets/server";
```

2. Añadir al constructor, después de `public readonly authorizer: Authorizer,`:

```ts
    public readonly spreadsheetsServerModule: SpreadsheetsServerModule,
```

3. En `create`, después de `renderingModule.blocks.register([counterDemoBlock]);`:

```ts
    const spreadsheetsServerModule = SpreadsheetsServerModule.create(nanobookModule.documentModule, authorizer);
```

4. En el `new Application(...)`, después de `authorizer,`:

```ts
      spreadsheetsServerModule,
```

- [ ] **Step 7: Prueba de composición**

En `src/application/server/Application.test.ts`, dentro del `describe("Application", ...)`, añadir:

```ts
  it("composes the spreadsheets server module with the documents capabilities", async () => {
    const app = await Application.create();

    expect(app.spreadsheetsServerModule.saveSpreadsheetController.handle).toBeTypeOf("function");
  });
```

Run: `npx vitest run src/application/server/Application.test.ts src/spreadsheets`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
npm run build && git add src/spreadsheets/server src/pages/api/nanobooks src/application/server && git commit -m "feat(spreadsheets): endpoint para guardar los cambios de una hoja

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Cliente `saveSpreadsheet`

**Files:**
- Create: `src/spreadsheets/browser/saveSpreadsheet.ts`
- Test: `src/spreadsheets/browser/saveSpreadsheet.test.ts`

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// src/spreadsheets/browser/saveSpreadsheet.test.ts
import { describe, expect, it, vi } from "vitest";
import { saveSpreadsheet } from "./saveSpreadsheet";

const context = { nanobookId: "book a", documentPath: "guias/ventas" };
const original = [["Sur", 98]];
const next = [["Sur", 105]];

describe("saveSpreadsheet", () => {
  it("sends the original and the edited rows to the nanobook endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));

    const outcome = await saveSpreadsheet(context, original, next, fetcher);

    expect(outcome).toBe("saved");
    expect(fetcher).toHaveBeenCalledWith("/api/nanobooks/book%20a/spreadsheets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentPath: "guias/ventas", original, next }),
    });
  });

  it("reports a stale sheet on 409 and an error otherwise", async () => {
    expect(await saveSpreadsheet(context, original, next, vi.fn().mockResolvedValue(new Response("{}", { status: 409 })))).toBe("stale");
    expect(await saveSpreadsheet(context, original, next, vi.fn().mockResolvedValue(new Response("{}", { status: 403 })))).toBe("error");
    expect(await saveSpreadsheet(context, original, next, vi.fn().mockRejectedValue(new Error("offline")))).toBe("error");
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx vitest run src/spreadsheets/browser/saveSpreadsheet.test.ts`
Expected: FAIL (`Cannot find module './saveSpreadsheet'`).

- [ ] **Step 3: Implementar**

```ts
// src/spreadsheets/browser/saveSpreadsheet.ts
import type { Cell } from "../shared/sheet";

/** Lo que la página entrega a la isla cuando el visitante puede escribir en el documento. */
export interface SpreadsheetContext {
  nanobookId: string;
  documentPath: string;
}

export type SaveOutcome = "saved" | "stale" | "error";

/** Pide al servidor que guarde en el documento las celdas cambiadas; nunca lanza. */
export async function saveSpreadsheet(
  context: SpreadsheetContext,
  original: readonly (readonly Cell[])[],
  next: readonly (readonly Cell[])[],
  fetcher: typeof fetch = fetch,
): Promise<SaveOutcome> {
  try {
    const response = await fetcher(`/api/nanobooks/${encodeURIComponent(context.nanobookId)}/spreadsheets`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentPath: context.documentPath, original, next }),
    });
    if (response.ok) return "saved";
    return response.status === 409 ? "stale" : "error";
  } catch {
    return "error";
  }
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npx vitest run src/spreadsheets/browser/saveSpreadsheet.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
npm run build && git add src/spreadsheets/browser/saveSpreadsheet.ts src/spreadsheets/browser/saveSpreadsheet.test.ts && git commit -m "feat(spreadsheets): cliente para guardar los cambios de una hoja

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Botón Guardar en la isla

**Files:**
- Modify: `src/spreadsheets/browser/components/Spreadsheet/SpreadsheetIsland.tsx`
- Modify: `src/spreadsheets/browser/ui/styles/spreadsheets.css`

La isla no tiene prueba unitaria propia (no hay entorno de DOM); el comportamiento del guardado ya está cubierto en las tareas 1-5 y se verifica de extremo a extremo en la tarea 8.

- [ ] **Step 1: Importar el cliente**

En `SpreadsheetIsland.tsx`, después de la línea `import { columnLabel, compareCells, sheetWidth, type Cell } from "../../../shared/sheet";` añadir:

```tsx
import { saveSpreadsheet, type SpreadsheetContext } from "../../saveSpreadsheet";
```

- [ ] **Step 2: Aceptar `context` y llevar el estado de guardado**

Reemplazar

```tsx
export default function SpreadsheetIsland({ title, columns, rows, readOnly }: SpreadsheetProps) {
  const width = sheetWidth(rows, columns);
  const [data, setData] = useState<Cell[][]>(() => rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? null)));
```

por

```tsx
type SaveStatus = "idle" | "saving" | "saved" | "stale" | "error";

const statusMessages: Record<SaveStatus, string> = {
  idle: "",
  saving: "Guardando…",
  saved: "Cambios guardados.",
  stale: "El documento cambió: recarga la página.",
  error: "No se pudo guardar.",
};

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
```

- [ ] **Step 3: Marcar el estado al editar y añadir `save`**

Reemplazar

```tsx
    setData((current) => current.map((row, index) => (index === rowIndex ? row.map((cell, i) => (i === columnIndex ? value : cell)) : row)));
  }
```

por

```tsx
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
```

- [ ] **Step 4: Pintar la barra de acciones**

Justo después del cierre `</div>` de `<div className="sheet-scroll">` (y antes de `</figure>`) añadir:

```tsx
      {context && !readOnly && (
        <div className="sheet-actions">
          <button type="button" onClick={save} disabled={!dirty || status === "saving"}>
            Guardar cambios
          </button>
          <span role="status">{statusMessages[status]}</span>
        </div>
      )}
```

- [ ] **Step 5: Actualizar el comentario del componente**

En el comentario JSDoc de la isla, reemplazar la frase `lo que escribe el lector no se guarda en el documento.` por `si la página entrega un contexto de escritura, un botón guarda los cambios en el documento; sin él, lo que escribe el lector queda solo en su pantalla.`

- [ ] **Step 6: Estilo**

Añadir al final de `src/spreadsheets/browser/ui/styles/spreadsheets.css`:

```css
.sheet-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-block-start: 0.5rem;
}

.sheet-actions button {
  padding: 0.35rem 0.9rem;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-panel-radius);
  background: var(--theme-surface-bg);
  color: var(--theme-content-primary);
  cursor: pointer;
}

.sheet-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.sheet-actions button:focus-visible {
  outline: 2px solid var(--theme-focus-ring);
  outline-offset: 2px;
}
```

- [ ] **Step 7: Verificar que compila**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 8: Commit**

```bash
git add src/spreadsheets/browser && git commit -m "feat(spreadsheets): botón para guardar los cambios de la hoja en el documento

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Reenviar el `context` hasta los bloques

**Files:**
- Modify: `src/rendering/browser/ui/BlockHost.astro`
- Modify: `src/rendering/browser/ui/RenderedDocument.astro`
- Modify: `src/documents/browser/ui/pages/DocumentPage.astro`

`rendering` trata `context` como un registro opaco: no interpreta su contenido ni importa otros módulos.

- [ ] **Step 1: `BlockHost.astro`**

Reemplazar el contenido completo por:

```astro
---
import { loadBlockComponent } from "./blockComponents";

interface Props {
  /** Ruta del .astro registrado para el bloque. */
  component: string;
  props: Record<string, unknown>;
  /** Datos opacos que la página entrega a todos los bloques (p. ej. el permiso de escritura); `rendering` no los interpreta. */
  context?: Record<string, unknown>;
}

// Etiqueta dinámica: la directiva client:*, si el bloque se hidrata, la declara
// el propio componente registrado, no este host.
const Block = await loadBlockComponent(Astro.props.component);
const { context } = Astro.props;
---

<Block {...Astro.props.props} {...(context ? { context } : {})} />
```

- [ ] **Step 2: `RenderedDocument.astro`**

En la interfaz `Props`, después de `html: string;` añadir:

```ts
  /** Datos opacos para los bloques; se reenvían tal cual. */
  context?: Record<string, unknown>;
```

Reemplazar `const { html, ...attributes } = Astro.props;` por:

```ts
const { html, context, ...attributes } = Astro.props;
```

Y reemplazar `<BlockHost component={piece.component} props={piece.props} />` por:

```astro
<BlockHost component={piece.component} props={piece.props} context={context} />
```

- [ ] **Step 3: `DocumentPage.astro`**

Reemplazar

```astro
        <RenderedDocument
          id="document-body"
          data-document-id={entry.documentId}
          data-document-ref={entry.ref ?? ""}
          html={renderedBody}
        />
```

por

```astro
        <RenderedDocument
          id="document-body"
          data-document-id={entry.documentId}
          data-document-ref={entry.ref ?? ""}
          html={renderedBody}
          context={canEdit ? { nanobookId, documentPath: slug } : undefined}
        />
```

- [ ] **Step 4: Comprobar que ningún bloque rompe con la prop extra**

Run: `npx vitest run && npx vitest run --config vitest.astro.config.ts`
Expected: todo PASS (incluye `rendering/boundary.test.ts`: `rendering` no importa otros módulos).

Los bloques `price-chart` y `counter-demo` propagan `Astro.props` a su isla de React, así que reciben `context` de más cuando el visitante puede escribir; es inofensivo (solo viaja `nanobookId` y la ruta, que el escritor ya conoce). Los `Financial*` leen campos concretos de `Astro.props`.

- [ ] **Step 5: Commit**

```bash
npm run build && git add src/rendering/browser src/documents/browser && git commit -m "feat(rendering): reenvía a los bloques un context opaco que entrega la página

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Integración, documentación y verificación de extremo a extremo

**Files:**
- Modify: `src/spreadsheets/shared/test/SpreadsheetsIntegration.test.ts`
- Modify: `CHANGELOG.md`
- Create: `src/content/nanobook-project/arquitectura/guardado-de-hojas.md`

- [ ] **Step 1: Prueba de integración sobre el fixture real**

En `SpreadsheetsIntegration.test.ts` añadir el import:

```ts
import { replaceSheetCells } from "../../server/domain/replaceSheetCells";
```

y al final del archivo:

```ts
it("saves an edited cell leaving the rest of the document byte for byte", () => {
  const source = document.replaceAll("\r\n", "\n");
  const rows = [
    ["Norte", 120, 135, 128, 150, 162, 171],
    ["Sur", 98, 101, 110, 108, 115, 124],
    ["Este", 76, 80, null, 91, 95, 99],
    ["Oeste", 143, 139, 150, 158, 166, 180],
  ];
  const next = rows.map((row) => [...row]);
  next[2][3] = 90;

  const result = replaceSheetCells(source, rows, next);

  expect(result.isSuccess).toBe(true);
  expect(result.getValue()).toBe(source.replace("  - [Este, 76, 80, null, 91, 95, 99]", "  - [Este, 76, 80, 90, 91, 95, 99]"));
});
```

Run: `npx vitest run src/spreadsheets/shared/test/SpreadsheetsIntegration.test.ts`
Expected: PASS. (La hoja `spreadsheet-totals` tiene las mismas filas pero otro lenguaje de fence, así que no se toca.)

- [ ] **Step 2: Nota de arquitectura**

Crear `src/content/nanobook-project/arquitectura/guardado-de-hojas.md` copiando el bloque de frontmatter de `bloques-de-componentes.md` (mismo formato, título y descripción propios) con este cuerpo:

```md
# Guardado de las ediciones de una hoja

El bloque `spreadsheet` con `readOnly: false` permite editar celdas en la página publicada. Si el visitante
puede escribir en el documento, un botón **Guardar cambios** persiste las celdas modificadas en el fence.

- **Capacidades de otros módulos, sin crear nuevas.** `spreadsheets/server` recibe `documentModule` y
  `Authorizer` por inyección (`SpreadsheetsServerModule.create`). Un puerto (`SpreadsheetDocuments`) y su adaptador
  (`DocumentModuleSpreadsheetDocuments`) usan `getDocument.executeRaw` y `updateDocument.execute`, igual que
  `DocumentModuleRootDocument` en `nanobooks`.
- **Cómo se localiza el fence.** La isla envía las filas originales y las nuevas; el servidor reemplaza el primer
  fence `spreadsheet` de raíz cuyas filas coinciden con las originales (ignorando `null` finales). Sin coincidencia
  responde 409: el documento cambió. No hay índice ni huella en el marcador.
- **Cómo se reescribe.** `replaceSheetCells` usa el Document API de `yaml` y solo cambia las celdas distintas:
  los comentarios y el estilo se conservan (los comentarios quedan con un espacio antes de `#`). No se añaden ni
  quitan filas.
- **Permisos y concurrencia.** `SaveSpreadsheet` pide permiso de escritura a `Authorizer` antes de leer, y guarda
  con la revisión leída (`expectedRevision`): un conflicto de revisión también responde 409.
- **Quién ve el botón.** `DocumentPage` pasa a `RenderedDocument` un `context` (`nanobookId`, `documentPath`) solo
  si `canEdit`; `rendering` lo reenvía opaco a los bloques. Quien no escribe sigue editando solo en su pantalla.
- **Límites conocidos.** Una hoja idéntica a otra en el mismo documento: se edita la primera. Un fence con sangría
  no se reescribe.
```

- [ ] **Step 3: CHANGELOG**

En `CHANGELOG.md`, bajo `## [Unreleased]`, añadir:

```md
- **Added:** los escritores pueden guardar en el documento las ediciones de un bloque `spreadsheet` con `readOnly: false` (botón **Guardar cambios**). `spreadsheets/server` usa las capacidades de `documents` y `authorization` por inyección, reescribe solo las celdas cambiadas conservando los comentarios del fence y responde 409 si el documento cambió. `rendering` reenvía a los bloques un `context` opaco que entrega la página solo si el visitante puede escribir.
```

- [ ] **Step 4: Suite completa y build**

Run: `npm test && npm run build`
Expected: todo PASS y build OK.

- [ ] **Step 5: Verificación en el navegador (guardar y recargar)**

1. `npx astro dev --port 4413` (en segundo plano).
2. Como propietario de un nanobook, crear un documento con una hoja editable y un comentario en el fence:

````md
```spreadsheet
# datos de prueba
columns: [Región, Enero]
readOnly: false
rows:
  - [Norte, 120]
  - [Sur, 98]
```
````

3. Abrir la página del documento: las celdas son `<input>` y aparece **Guardar cambios** deshabilitado.
4. Cambiar `98` por `105`: el botón se habilita. Pulsarlo: "Cambios guardados." y el botón se deshabilita.
5. Recargar la página: la celda muestra `105`. Abrir el editor: solo cambió esa línea y el comentario `# datos de prueba` sigue ahí.
6. Con la página abierta, editar el documento desde otra pestaña y volver a pulsar **Guardar cambios**: aparece "El documento cambió: recarga la página."
7. Abrir la página sin sesión (ventana privada): no hay botón y las celdas siguen editándose solo en local.
8. Parar el servidor: `npx astro dev stop`.

- [ ] **Step 6: Commit**

```bash
git add -f src/content/nanobook-project/arquitectura/guardado-de-hojas.md && git add CHANGELOG.md src/spreadsheets/shared/test && git commit -m "docs(docs): guardado de las ediciones de una hoja

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Cobertura de la spec

| Requisito de la spec | Tarea |
|---|---|
| `replaceSheetCells` (fence, parche, validación, errores) | 1 |
| Puerto + `SaveSpreadsheet` (permiso → leer → reemplazar → guardar) | 2 |
| Adaptador sobre `documentModule` + export del error de revisión | 3 |
| Controlador, compositor, ruta `PATCH`, composición en `Application` | 4 |
| Cliente y estados de la isla, botón Guardar | 5, 6 |
| `context` opaco desde `DocumentPage` solo si `canEdit` | 7 |
| Pruebas, CHANGELOG, nota de arquitectura, verificación manual | 8 |
