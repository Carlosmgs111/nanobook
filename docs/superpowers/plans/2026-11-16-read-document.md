# Protección de lectura y escritura desde `documents` (ReadDocument + WriteAccess) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el módulo `documents` resuelva por sí mismo la protección: la lectura pasa por un único caso de uso `ReadDocument` (`not-found` / `allowed` / `challenge`) y toda mutación comprueba el permiso de escritura del nanobook dentro del propio caso de uso, de modo que ningún llamador pueda saltarse la autorización por olvido.

**Architecture (escritura):** `documents` define un puerto `WriteAccess` (no puede importar `nanobooks`, que es quien construye `DocumentModule`: habría un ciclo). `nanobooks` lo implementa con `RequireNanobookAccess` y lo inyecta en `DocumentModule.create(eventBus, writeAccess)`. `Create/Update/Delete` y `Set/ClearDocumentPassword` lo invocan al empezar; el criterio único pasa a ser el permiso `write` del nanobook y el `ownerId` del documento queda como metadato de auditoría.

**Architecture (lectura):** `ReadDocument` compone `GetDocument.executeChain` (documento almacenado + resuelto por proxy, una sola lectura) con el `AuthorizeDocumentAccess` existente, sin modificarlo. Es fail-closed: ante un desafío sin resolver devuelve el documento almacenado *redactado* (`Document.redacted()`), así el contenido nunca sale del módulo. El visor se identifica con un `userId` perezoso (`viewer.userId()`, solo se resuelve si la cadena tiene un enlace protegido) y el propio módulo decide si es escritor con el mismo `WriteAccess` que usan las mutaciones; el resultado `allowed` lleva la evidencia `via` (`open` / `writer` / `grant`). La página pública y el servicio MCP migran a este caso de uso (el MCP además usa `ListReadableDocuments` para el listado).

**Tech Stack:** TypeScript, Astro SSR, Vitest (`pnpm vitest run`), Drizzle. Convenciones del repo: `CLAUDE.md` (Conventional Commits, `npm run build` antes de commit, `CHANGELOG.md` en `[Unreleased]`).

---

## Contexto que el implementador necesita

- **Proxy chain.** Un documento con `ref` se resuelve contra su destino (`ProxyParser`). Al fusionar, los metadatos del destino pisan los del origen, incluido `secured` (`{ ...data, ...targetData }`). Por eso la protección se evalúa sobre **ambos**: el almacenado (`raw`) y el resuelto (`resolved`). `securedDocuments([raw, resolved])` (en `access/AuthorizeDocumentAccess.ts`) ya implementa esa regla; no la reescribas.
- **Hoy la seguridad es opt-in.** `pages/n/[nanobookSlug]/[...slug]/index.astro` compone `getDocument` + `authorizeDocumentAccess` a mano. `AgentToolService.getDocument/listDocuments` (MCP) solo exigen *lectura del nanobook* y devuelven contenido completo de documentos protegidos: ese es el hueco que este plan cierra.
- **Dónde se corre un test:** `pnpm vitest run <ruta>`. Suite completa: `pnpm test`. Build: `npm run build`.
- **Rutas a partir de la raíz del repo** (`D:\Documentos\Desktop\nanobook`). Dentro de `src/documents/server/`, `application/` contiene los casos de uso y `domain/Document.ts` la entidad.

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/documents/server/domain/Document.ts` | Modificar | Añadir `redacted()` |
| `src/documents/server/domain/DocumentRedacted.test.ts` | Crear | Test de `redacted()` |
| `src/documents/server/application/GetDocument.ts` | Modificar | Añadir `executeChain`; `execute` lo reutiliza |
| `src/documents/server/application/GetDocumentChain.test.ts` | Crear | Test de `executeChain` |
| `src/documents/server/application/ReadDocument.ts` | Crear | Caso de uso de lectura con decisión de acceso |
| `src/documents/server/application/ReadDocument.test.ts` | Crear | Tests de `ReadDocument` |
| `src/documents/server/application/access/UnlockDocument.ts` | Modificar | Usar `executeChain` (una lectura en vez de dos) |
| `src/documents/server/application/access/AuthorizeAndUnlock.test.ts` | Modificar | Adaptar el stub de `getDocument` |
| `src/documents/server/application/ListReadableDocuments.ts` | Crear | Listado que redacta lo protegido para no escritores |
| `src/documents/server/application/ListReadableDocuments.test.ts` | Crear | Tests del listado |
| `src/documents/server/index.ts` | Modificar | Cablear y exponer `readDocument` / `listReadableDocuments`; dejar de exponer `authorizeDocumentAccess` |
| `src/pages/n/[nanobookSlug]/[...slug]/index.astro` | Modificar | Usar `readDocument` |
| `src/agents/server/application/AgentToolService.ts` | Modificar | `getDocument`/`listDocuments` pasan por el módulo |
| `src/agents/server/application/AgentToolService.read.test.ts` | Crear | Tests del hueco MCP |
| `src/documents/server/domain/ports/WriteAccess.ts` | Crear | Puerto: ¿puede el actor escribir en el nanobook? |
| `src/documents/server/domain/errors.ts` | Modificar | `WriteAccessDeniedError` (subclase de `DocumentAccessDeniedError`) |
| `src/documents/server/application/test/factories.ts` | Modificar | Dobles `allowWrites` / `denyWrites` |
| `src/nanobooks/server/infraestructure/documents/NanobookWriteAccess.ts` (+ `.test.ts`) | Crear | Adaptador del puerto sobre `RequireNanobookAccess` |
| `src/nanobooks/server/index.ts` | Modificar | Construir `requireNanobookAccess` antes e inyectar el adaptador |
| `src/documents/server/application/CreateDocument.ts` (+ test) | Modificar | Recibe `actorId`, comprueba escritura, estampa `ownerId` |
| `src/documents/server/application/dto/DocumentInput.ts` | Modificar | Elimina `ownerId` |
| `src/documents/server/infraestructure/rest/CreateDocumentController.ts` (+ test) | Modificar | Pasa `actorId` en vez de `ownerId` |
| `src/nanobooks/server/application/CreateNanobook.ts` | Modificar | Crea el documento raíz con `actorId` |
| `src/documents/server/application/UpdateDocument.ts`, `DeleteDocument.ts` (+ tests) | Modificar | Comprueban `WriteAccess`; se eliminan los chequeos por `ownerId` |
| `src/documents/server/application/access/loadOwnedDocument.ts` | Renombrar → `loadWritableDocument.ts` | Comprueba `WriteAccess` y carga por path |
| `src/documents/server/application/access/SetDocumentPassword.ts`, `ClearDocumentPassword.ts` (+ tests) | Modificar | Inyectan `WriteAccess` |
| `CHANGELOG.md`, `src/content/nanobook-project/` | Modificar | Registro de la decisión |

## Decisiones fijadas (no reabrir durante la implementación)

1. **`getDocument` sigue público.** Lo usan rutas de escritura (`EditPage`, `NewPage`, `PreviewPage`) y `CreateNanobook.executeRaw`. Esas rutas ya exigen permiso `write`; el Task 9 verifica que sea así. Lo que se elimina de la API pública es `authorizeDocumentAccess`.
2. **El documento del desafío es el `raw` redactado**, no el `resolved`: el título del destino de un proxy podría filtrar información de un documento protegido distinto. Cambio de comportamiento menor y deliberado: el formulario de desbloqueo muestra el título del documento almacenado.
3. **`AuthorizeDocumentAccess` y `PasswordAccessPolicy` no se tocan** en este plan (plegarlos es un cambio posterior e independiente).
4. **Fuera de alcance:** `getAllDocuments` para `navigation`, otras superficies que sirvan contenido (búsqueda, `llms.txt`, RSS, endpoints `.md`), el secreto de desarrollo por defecto del codec en `index.ts`.
5. **Criterio único de escritura = permiso `write` del nanobook.** Los chequeos `ownerId !== actorId` de `Update`, `Delete` y `loadOwnedDocument` desaparecen. Efecto buscado: los documentos sin `ownerId` dejan de quedar bloqueados para todos. `ownerId` se sigue guardando como metadato (lo estampa `CreateDocument` con el actor).
6. **`WriteAccessDeniedError extends DocumentAccessDeniedError`**: así los mapeos 403 existentes (`handleServiceError`, `DocumentAccessAdminController.toResponse`, `McpToolResult`) la cubren sin tocarlos. Un nanobook inexistente se informa como denegado (no revela existencia).
7. **Se conservan** `routeProtector` y `withNanobookWriteAccess` (respuestas 401/403 tempranas y protección de origen). Quitar el segundo, ahora redundante, es un cambio posterior. `AgentToolService.require` también se queda: aporta la comprobación de *scope* del token.
8. **Orden de commits compilable:** el Task 1 introduce el puerto `WriteAccess` y cambia la firma de `DocumentModule.create` (único llamador: `nanobooks/server/index.ts`) sin usarlo aún; los Tasks 4, 6 y 7 lo usan para la lectura, y los Tasks 10-12 lo adoptan caso de uso por caso de uso, cada uno con sus llamadores.
9. **La lectura recibe `userId`, no un booleano.** `DocumentViewer.userId()` es perezoso y el módulo resuelve si es escritor con `WriteAccess` (el mismo criterio que la escritura); la página y el agente dejan de importar `AuthorizeNanobook`. Un fallo del puerto cuenta como «no escritor»: la lectura falla cerrada.
10. **Evidencia del resultado:** `allowed` incluye `via: "open" | "writer" | "grant"`. `via: "writer"` solo se conoce cuando el documento está protegido (ahí se resuelve al visor); `DocumentPage` sigue calculando su propio `canEdit` para el botón de editar, para no leer la sesión en lecturas públicas.

---

### Task 1: Puerto `WriteAccess` y su adaptador en `nanobooks`

> Va primero porque `ReadDocument`, `ListReadableDocuments` y las mutaciones dependen del puerto.

**Files:**
- Create: `src/documents/server/domain/ports/WriteAccess.ts`
- Modify: `src/documents/server/domain/errors.ts` (tras `DocumentAccessDeniedError`, ~línea 52)
- Modify: `src/documents/server/application/test/factories.ts`
- Modify: `src/documents/server/index.ts`
- Create: `src/nanobooks/server/infraestructure/documents/NanobookWriteAccess.ts`
- Create: `src/nanobooks/server/infraestructure/documents/NanobookWriteAccess.test.ts`
- Modify: `src/nanobooks/server/index.ts`

- [ ] **Step 1: Escribir el test del adaptador (falla)**

```ts
import { describe, expect, it, vi } from "vitest";

import { DocumentRepositoryError, WriteAccessDeniedError } from "../../../../documents/server";
import { Result } from "../../../../shared/domain/Result";
import { NanobookAccessDeniedError } from "../../application/AuthorizeNanobook";
import { NanobookNotFoundError } from "../../application/errors";
import type { NanobookAccessRequirement } from "../../application/RequireNanobookAccess";
import { NanobookWriteAccess } from "./NanobookWriteAccess";

function adapter(result: unknown) {
  const execute = vi.fn().mockResolvedValue(result);
  return { writeAccess: new NanobookWriteAccess({ execute } as unknown as NanobookAccessRequirement), execute };
}

describe("NanobookWriteAccess", () => {
  it("allows when the nanobook grants write permission", async () => {
    const { writeAccess, execute } = adapter(Result.ok({}));

    const result = await writeAccess.require("book-a", "user-1");

    expect(result.isSuccess).toBe(true);
    expect(execute).toHaveBeenCalledWith("user-1", "book-a", "write");
  });

  it("denies when the nanobook rejects the actor", async () => {
    const { writeAccess } = adapter(Result.fail(new NanobookAccessDeniedError("book-a", "write")));

    const result = await writeAccess.require("book-a", "user-1");

    expect(result.getError()).toBeInstanceOf(WriteAccessDeniedError);
  });

  it("reports a missing nanobook as denied", async () => {
    const { writeAccess } = adapter(Result.fail(new NanobookNotFoundError("book-a")));

    const result = await writeAccess.require("book-a", "user-1");

    expect(result.getError()).toBeInstanceOf(WriteAccessDeniedError);
  });

  it("reports repository failures as DocumentRepositoryError", async () => {
    const { writeAccess } = adapter(Result.fail(new Error("db down")));

    const result = await writeAccess.require("book-a", "user-1");

    expect(result.getError()).toBeInstanceOf(DocumentRepositoryError);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `pnpm vitest run src/nanobooks/server/infraestructure/documents/NanobookWriteAccess.test.ts`
Expected: FAIL (módulos `NanobookWriteAccess` y `WriteAccessDeniedError` inexistentes).

- [ ] **Step 3: Puerto, error y exports en `documents`**

`src/documents/server/domain/ports/WriteAccess.ts`:

```ts
import type { Result } from "../../../../shared/domain/Result";
import type { DocumentRepositoryError, WriteAccessDeniedError } from "../errors";

/**
 * Quién puede modificar el contenido de un nanobook. Lo implementa el módulo
 * dueño del nanobook; `documents` solo conoce este contrato.
 */
export interface WriteAccess {
  require(
    nanobookId: string,
    actorId: string,
  ): Promise<Result<WriteAccessDeniedError | DocumentRepositoryError, void>>;
}
```

En `errors.ts`, justo después de `DocumentAccessDeniedError`:

```ts
/** El actor no puede escribir en el nanobook. Subclase para que los mapeos 403 existentes la cubran. */
export class WriteAccessDeniedError extends DocumentAccessDeniedError {
  constructor(public readonly nanobookId: string) {
    super(nanobookId);
    this.message = `No tienes permiso de edición sobre el nanobook "${nanobookId}"`;
    this.name = "WriteAccessDeniedError";
  }
}
```

En `src/documents/server/index.ts` (junto a los demás `export`):

```ts
export type { WriteAccess } from "./domain/ports/WriteAccess";
export { WriteAccessDeniedError, DocumentRepositoryError } from "./domain/errors";
```

y cambiar la firma de la fábrica (sin usar todavía el parámetro):

```ts
import type { WriteAccess } from "./domain/ports/WriteAccess";
// ...
  static async create(eventBus: EventBus, writeAccess: WriteAccess) {
```

- [ ] **Step 4: Dobles de test**

Añadir al final de `src/documents/server/application/test/factories.ts`:

```ts
import { WriteAccessDeniedError } from "../../domain/errors";
import type { WriteAccess } from "../../domain/ports/WriteAccess";

export const allowWrites: WriteAccess = { require: async () => Result.ok() };
export const denyWrites: WriteAccess = {
  require: async (nanobookId) => Result.fail(new WriteAccessDeniedError(nanobookId)),
};
```

(mover los dos `import` al bloque de imports del archivo).

- [ ] **Step 5: Adaptador**

`src/nanobooks/server/infraestructure/documents/NanobookWriteAccess.ts`:

```ts
import { DocumentRepositoryError, WriteAccessDeniedError, type WriteAccess } from "../../../../documents/server";
import { Result } from "../../../../shared/domain/Result";
import { NanobookAccessDeniedError } from "../../application/AuthorizeNanobook";
import { NanobookNotFoundError } from "../../application/errors";
import type { NanobookAccessRequirement } from "../../application/RequireNanobookAccess";

/** Puerto de escritura de `documents` respaldado por el permiso `write` del nanobook. */
export class NanobookWriteAccess implements WriteAccess {
  constructor(private readonly access: NanobookAccessRequirement) {}

  async require(nanobookId: string, actorId: string) {
    const result = await this.access.execute(actorId, nanobookId, "write");
    if (result.isSuccess) return Result.ok();

    const error = result.getError();
    if (error instanceof NanobookAccessDeniedError || error instanceof NanobookNotFoundError) {
      return Result.fail(new WriteAccessDeniedError(nanobookId));
    }
    return Result.fail(
      new DocumentRepositoryError("No fue posible comprobar el permiso sobre el nanobook", { cause: error }),
    );
  }
}
```

- [ ] **Step 6: Composición en `nanobooks/server/index.ts`**

En `NanobookModule.create`, construir el requisito de acceso antes del módulo de documentos y reutilizarlo al final:

```ts
    const authorizeNanobook = new AuthorizeNanobook();
    const requireNanobookAccess = new RequireNanobookAccess(repository, authorizeNanobook);
    const documentModule = await DocumentModule.create(
      eventBus,
      new NanobookWriteAccess(requireNanobookAccess),
    );
```

(mover `const authorizeNanobook = new AuthorizeNanobook();` arriba, eliminar su declaración original), importar `NanobookWriteAccess` desde `./infraestructure/documents/NanobookWriteAccess`, y sustituir el último argumento del `return new NanobookModule(...)` `new RequireNanobookAccess(repository, authorizeNanobook)` por `requireNanobookAccess`.

- [ ] **Step 7: Ejecutar tests y tipos**

Run: `pnpm vitest run src/nanobooks/server/infraestructure/documents/NanobookWriteAccess.test.ts` → Expected: PASS (4 tests).
Run: `pnpm astro check` → Expected: 0 errores.

- [ ] **Step 8: Commit**

```bash
git add src/documents/server src/nanobooks/server
git commit -m "feat(documents): añade el puerto WriteAccess y su adaptador sobre el permiso del nanobook

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `Document.redacted()`

**Files:**
- Modify: `src/documents/server/domain/Document.ts` (junto a `withSecured`, ~línea 204)
- Create: `src/documents/server/domain/DocumentRedacted.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, expect, it } from "vitest";

import { Document } from "./Document";

describe("Document.redacted", () => {
  const full = Document.create(
    "guia",
    {
      id: "doc-1",
      title: "Guía interna",
      description: "Resumen sensible",
      author: "Autora",
      ownerId: "owner-1",
      tags: ["secreto"],
      cover: "https://example.com/cover.png",
      ref: "./otro.md",
      secured: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    },
    "# Contenido secreto",
    null,
    undefined,
    undefined,
    7,
  ).getValue();

  it("keeps identity, path, title, revision and the lock flag", () => {
    const redacted = full.redacted().parse();

    expect(redacted.documentId).toBe("doc-1");
    expect(redacted.path).toBe("guia");
    expect(redacted.title).toBe("Guía interna");
    expect(redacted.revision).toBe(7);
    expect(redacted.metadata.secured).toBe(true);
  });

  it("drops body, description, tags, cover, ref, owner and author", () => {
    const redacted = full.redacted().parse();

    expect(redacted.content).toBe("");
    expect(redacted.description).toBe("");
    expect(redacted.metadata.tags).toEqual([]);
    expect(redacted.metadata.cover).toBeUndefined();
    expect(redacted.metadata.ref).toBeUndefined();
    expect(redacted.ref).toBeUndefined();
    expect(redacted.metadata.ownerId).toBeUndefined();
    expect(redacted.metadata.author).toBe("Nanobook");
    expect(redacted.rawFrontmatter).not.toContain("Resumen sensible");
    expect(redacted.rawFrontmatter).not.toContain("owner-1");
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `pnpm vitest run src/documents/server/domain/DocumentRedacted.test.ts`
Expected: FAIL con `full.redacted is not a function`.

- [ ] **Step 3: Implementar**

En `Document.ts`, justo después del método `withSecured(...)`:

```ts
  /**
   * Copia apta para mostrarse a quien aún no superó el desafío: conserva
   * identidad, path, título, revisión y el candado; nada que describa el
   * contenido ni a su autor.
   */
  redacted(): Document {
    return Document.create(
      this.getPath(),
      {
        id: this.documentId.getValue(),
        title: this.title,
        description: "",
        createdAt: this.metadata.createdAt,
        updatedAt: this.metadata.updatedAt,
        secured: this.metadata.secured,
        position: this.position,
        nanobook: this.metadata.nanobook,
      },
      "",
      null,
      undefined,
      this.documentId.getValue(),
      this.revision,
    ).getValue();
  }
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `pnpm vitest run src/documents/server/domain/DocumentRedacted.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/documents/server/domain/Document.ts src/documents/server/domain/DocumentRedacted.test.ts
git commit -m "feat(documents): añade Document.redacted para vistas sin contenido

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `GetDocument.executeChain`

**Files:**
- Modify: `src/documents/server/application/GetDocument.ts`
- Create: `src/documents/server/application/GetDocumentChain.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../shared/domain/Result";
import { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { DocumentSourceCache } from "./DocumentSourceCache";
import { GetDocument } from "./GetDocument";
import type { ProxyParser } from "./ProxyParser";

const passthroughCache = (): DocumentSourceCache => ({
  getOrLoad: (_nanobookId, _path, load) => load(),
  invalidateNanobook: vi.fn(),
});

function doc(id: string, title: string) {
  return Document.create(
    "proxy",
    { id, title, description: title, createdAt: new Date("2026-01-01") },
    "",
  ).getValue();
}

describe("GetDocument.executeChain", () => {
  it("returns the stored document and its proxy-resolved version from one lookup", async () => {
    const raw = doc("doc-proxy", "Origen");
    const resolved = doc("doc-proxy", "Destino");
    const getByPublicPath = vi.fn().mockResolvedValue(Result.ok(raw));
    const parseProxies = vi.fn().mockResolvedValue([resolved]);
    const getDocument = new GetDocument(
      { getByPublicPath } as unknown as ContentRepository,
      { parseProxies } as unknown as ProxyParser,
      passthroughCache(),
    );

    const chain = await getDocument.executeChain("book-a", "proxy");

    expect(chain).toEqual({ raw, resolved });
    expect(getByPublicPath).toHaveBeenCalledTimes(1);
    expect(parseProxies).toHaveBeenCalledWith("book-a", [raw]);
  });

  it("returns null when the document does not exist", async () => {
    const getDocument = new GetDocument(
      { getByPublicPath: vi.fn().mockResolvedValue(Result.ok(null)) } as unknown as ContentRepository,
      { parseProxies: vi.fn() } as unknown as ProxyParser,
      passthroughCache(),
    );

    expect(await getDocument.executeChain("book-a", "missing")).toBeNull();
  });

  it("reports lookup and proxy durations", async () => {
    const raw = doc("doc-1", "Doc");
    const getDocument = new GetDocument(
      { getByPublicPath: vi.fn().mockResolvedValue(Result.ok(raw)) } as unknown as ContentRepository,
      { parseProxies: vi.fn().mockResolvedValue([raw]) } as unknown as ProxyParser,
      passthroughCache(),
    );
    const timings: Record<string, number> = {};

    await getDocument.executeChain("book-a", "proxy", (name, duration) => {
      timings[name] = duration;
    });

    expect(timings["document-lookup"]).toEqual(expect.any(Number));
    expect(timings["document-proxy"]).toEqual(expect.any(Number));
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `pnpm vitest run src/documents/server/application/GetDocumentChain.test.ts`
Expected: FAIL con `executeChain is not a function`.

- [ ] **Step 3: Implementar**

En `GetDocument.ts`, reemplazar el método `execute` por:

```ts
  async execute(
    nanobookId: string,
    documentPathValue: string,
    observeTiming?: DocumentTimingObserver,
  ): Promise<Document | null> {
    return (await this.executeChain(nanobookId, documentPathValue, observeTiming))?.resolved ?? null;
  }

  /** Stored document and its proxy-resolved version, from a single lookup. */
  async executeChain(
    nanobookId: string,
    documentPathValue: string,
    observeTiming?: DocumentTimingObserver,
  ): Promise<{ raw: Document; resolved: Document } | null> {
    const raw = await measure("document-lookup", observeTiming, () =>
      this.executeRaw(nanobookId, documentPathValue),
    );
    if (!raw) return null;
    const [resolved] = await measure("document-proxy", observeTiming, () =>
      this.parseProxy.parseProxies(nanobookId, [raw]),
    );
    return { raw, resolved };
  }
```

- [ ] **Step 4: Ejecutar los tests de GetDocument**

Run: `pnpm vitest run src/documents/server/application/GetDocumentChain.test.ts src/documents/server/application/GetDocument.test.ts`
Expected: PASS (los 4 tests existentes y los 3 nuevos).

- [ ] **Step 5: Commit**

```bash
git add src/documents/server/application/GetDocument.ts src/documents/server/application/GetDocumentChain.test.ts
git commit -m "refactor(documents): GetDocument expone la cadena almacenado/resuelto en una lectura

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `ReadDocument`

**Files:**
- Create: `src/documents/server/application/ReadDocument.ts`
- Create: `src/documents/server/application/ReadDocument.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../shared/domain/Result";
import { Document } from "../domain/Document";
import { PasswordAccessPolicy } from "../domain/access/DocumentAccessPolicy";
import { DocumentRepositoryError } from "../domain/errors";
import type { WriteAccess } from "../domain/ports/WriteAccess";
import { AuthorizeDocumentAccess } from "./access/AuthorizeDocumentAccess";
import { FakeCodec, InMemoryAccessRepository } from "./access/testDoubles";
import { ReadDocument, type DocumentViewer } from "./ReadDocument";
import { allowWrites, denyWrites } from "./test/factories";

const now = new Date("2026-11-04T12:00:00.000Z");

function document(id: string, secured: boolean, content = "# Secreto") {
  return Document.create(
    "guia",
    {
      id,
      title: `Título ${id}`,
      description: "Descripción",
      author: "Autora",
      ownerId: "owner-1",
      secured,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    content,
  ).getValue();
}

async function setup(chain: { raw: Document; resolved: Document } | null, writeAccess: WriteAccess = denyWrites) {
  const accessRepository = new InMemoryAccessRepository();
  await accessRepository.setPasswordHash("doc-1", "hash:clave");
  const authorize = new AuthorizeDocumentAccess(accessRepository, new FakeCodec(), new PasswordAccessPolicy(), () => now);
  const getDocument = { executeChain: vi.fn().mockResolvedValue(chain) };
  return { read: new ReadDocument(getDocument, authorize, writeAccess), getDocument };
}

function viewer(options: { userId?: string; grants?: Record<string, string> } = {}) {
  const userId = vi.fn().mockResolvedValue(options.userId);
  const value: DocumentViewer = { userId, grantFor: (id) => options.grants?.[id] };
  return { value, userId };
}

function spyWriteAccess(allowed: boolean) {
  const require = vi.fn(async (nanobookId: string, actorId: string) =>
    allowed ? Result.ok() : denyWrites.require(nanobookId, actorId),
  );
  return { writeAccess: { require } as unknown as WriteAccess, require };
}

const input = { nanobookId: "book-a", path: "guia" };

describe("ReadDocument", () => {
  it("reports a missing document", async () => {
    const { read } = await setup(null);

    const result = await read.execute({ ...input, viewer: viewer().value });

    expect(result).toEqual({ kind: "not-found" });
  });

  it("allows an unprotected document without resolving the viewer", async () => {
    const open = document("doc-2", false);
    const { writeAccess, require } = spyWriteAccess(true);
    const { read } = await setup({ raw: open, resolved: open }, writeAccess);
    const v = viewer({ userId: "user-1" });

    const result = await read.execute({ ...input, viewer: v.value });

    expect(result).toEqual({ kind: "allowed", document: open, via: "open" });
    expect(v.userId).not.toHaveBeenCalled();
    expect(require).not.toHaveBeenCalled();
  });

  it("allows a writer of the nanobook on a protected document", async () => {
    const secured = document("doc-1", true);
    const { writeAccess, require } = spyWriteAccess(true);
    const { read } = await setup({ raw: secured, resolved: secured }, writeAccess);

    const result = await read.execute({ ...input, viewer: viewer({ userId: "user-1" }).value });

    expect(result).toEqual({ kind: "allowed", document: secured, via: "writer" });
    expect(require).toHaveBeenCalledWith("book-a", "user-1");
  });

  it("allows readers holding a valid grant", async () => {
    const secured = document("doc-1", true);
    const { read } = await setup({ raw: secured, resolved: secured }, denyWrites);

    const result = await read.execute({
      ...input,
      viewer: viewer({ userId: "user-2", grants: { "doc-1": "doc-1:1" } }).value,
    });

    expect(result).toEqual({ kind: "allowed", document: secured, via: "grant" });
  });

  it("challenges anonymous readers without asking the write port, and never returns content", async () => {
    const secured = document("doc-1", true, "# No debe salir");
    const { writeAccess, require } = spyWriteAccess(true);
    const { read } = await setup({ raw: secured, resolved: secured }, writeAccess);

    const result = await read.execute({ ...input, viewer: viewer().value });

    expect(result.kind).toBe("challenge");
    if (result.kind !== "challenge") throw new Error("unreachable");
    expect(result.method).toBe("password");
    expect(result.document.getContent()).toBe("");
    expect(result.document.getDescription()).toBe("");
    expect(result.document.getTitle()).toBe("Título doc-1");
    expect(require).not.toHaveBeenCalled();
  });

  it("fails closed when the write port cannot be consulted", async () => {
    const secured = document("doc-1", true);
    const broken: WriteAccess = { require: async () => Result.fail(new DocumentRepositoryError("db caída")) };
    const { read } = await setup({ raw: secured, resolved: secured }, broken);

    const result = await read.execute({ ...input, viewer: viewer({ userId: "user-1" }).value });

    expect(result.kind).toBe("challenge");
  });

  it("challenges when only the stored link of a proxy chain is protected", async () => {
    const raw = document("doc-1", true);
    const resolved = document("doc-1", false, "# Contenido del destino");
    const { read } = await setup({ raw, resolved });

    const result = await read.execute({ ...input, viewer: viewer({ userId: "user-2" }).value });

    expect(result.kind).toBe("challenge");
    if (result.kind !== "challenge") throw new Error("unreachable");
    expect(result.document.getContent()).toBe("");
  });

  it("forwards the timing observer to the lookup", async () => {
    const open = document("doc-2", false);
    const { read, getDocument } = await setup({ raw: open, resolved: open });
    const observe = vi.fn();

    await read.execute({ ...input, viewer: viewer().value, observeTiming: observe });

    expect(getDocument.executeChain).toHaveBeenCalledWith("book-a", "guia", observe);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `pnpm vitest run src/documents/server/application/ReadDocument.test.ts`
Expected: FAIL (`Cannot find module './ReadDocument'`).

- [ ] **Step 3: Implementar**

`src/documents/server/application/ReadDocument.ts`:

```ts
import type { Document } from "../domain/Document";
import type { WriteAccess } from "../domain/ports/WriteAccess";
import { securedDocuments, type AuthorizeDocumentAccess } from "./access/AuthorizeDocumentAccess";
import type { DocumentTimingObserver, GetDocument } from "./GetDocument";

/** Quién lee: su identidad (si la hay) y la prueba de acceso que presenta. */
export interface DocumentViewer {
  /**
   * Id del usuario autenticado. Se invoca solo si la cadena tiene un enlace
   * protegido (evita leer la sesión en lecturas públicas).
   */
  userId(): Promise<string | undefined>;
  /** Token presentado para un documento; cómo viaja (cookie) es asunto del llamador. */
  grantFor(documentId: string): string | undefined;
}

export interface ReadDocumentInput {
  nanobookId: string;
  path: string;
  viewer: DocumentViewer;
  observeTiming?: DocumentTimingObserver;
}

export type ReadDocumentResult =
  | { kind: "not-found" }
  /** `via` es la evidencia de por qué se concedió: documento abierto, escritor del nanobook o grant válido. */
  | { kind: "allowed"; document: Document; via: "open" | "writer" | "grant" }
  /** `document` está redactado: sin cuerpo ni descripción. */
  | { kind: "challenge"; method: "password"; document: Document };

/**
 * Único punto de lectura que aplica la protección: quien lo usa no puede
 * obtener contenido protegido sin haber superado el desafío.
 */
export class ReadDocument {
  constructor(
    private readonly getDocument: Pick<GetDocument, "executeChain">,
    private readonly authorize: Pick<AuthorizeDocumentAccess, "execute">,
    private readonly writeAccess: WriteAccess,
  ) {}

  async execute({ nanobookId, path, viewer, observeTiming }: ReadDocumentInput): Promise<ReadDocumentResult> {
    const chain = await this.getDocument.executeChain(nanobookId, path, observeTiming);
    if (!chain) return { kind: "not-found" };

    const documents = [chain.raw, chain.resolved];
    if (securedDocuments(documents).length === 0) {
      return { kind: "allowed", document: chain.resolved, via: "open" };
    }

    const userId = await viewer.userId();
    // Un fallo al consultar el puerto cuenta como «no escritor»: la lectura falla cerrada.
    const canWrite = userId !== undefined && (await this.writeAccess.require(nanobookId, userId)).isSuccess;

    const decision = await this.authorize.execute({ documents, canWrite, grantFor: viewer.grantFor });
    if (decision.kind === "challenge") {
      return { kind: "challenge", method: decision.method, document: chain.raw.redacted() };
    }
    return { kind: "allowed", document: chain.resolved, via: canWrite ? "writer" : "grant" };
  }
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `pnpm vitest run src/documents/server/application/ReadDocument.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/documents/server/application/ReadDocument.ts src/documents/server/application/ReadDocument.test.ts
git commit -m "feat(documents): añade ReadDocument con protección fail-closed

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `UnlockDocument` usa `executeChain`

**Files:**
- Modify: `src/documents/server/application/access/UnlockDocument.ts` (líneas ~40, ~50-54)
- Modify: `src/documents/server/application/access/AuthorizeAndUnlock.test.ts` (setup de `UnlockDocument`, líneas ~137-148)

- [ ] **Step 1: Adaptar el stub del test (rojo)**

En `describe("UnlockDocument")`, sustituir el objeto `getDocument` por:

```ts
    const getDocument = {
      executeChain: vi
        .fn()
        .mockResolvedValue(raw ? { raw, resolved: resolved ?? raw } : null),
    };
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `pnpm vitest run src/documents/server/application/access/AuthorizeAndUnlock.test.ts`
Expected: FAIL en los tests de `UnlockDocument` (`this.getDocument.executeRaw is not a function`).

- [ ] **Step 3: Implementar**

En `UnlockDocument.ts`:

```ts
// constructor
    private readonly getDocument: Pick<GetDocument, "executeChain">,
```

y reemplazar el inicio de `execute`:

```ts
    const found = await this.getDocument.executeChain(input.nanobookId, input.documentPath);
    const chain = securedDocuments(found ? [found.raw, found.resolved] : []);
    if (!found || chain.length === 0) return Result.fail(new DocumentNotFoundError(input.documentPath));

    const now = this.clock();
    // Attempts are counted against the requested document, not the chain link.
    const limiterId = found.raw.getDocumentId().getValue();
```

(eliminar las líneas antiguas `const raw = ...`, `const resolved = ...`, `const chain = ...` y `const limiterId = (raw ?? resolved)!...`).

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `pnpm vitest run src/documents/server/application/access/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/documents/server/application/access/UnlockDocument.ts src/documents/server/application/access/AuthorizeAndUnlock.test.ts
git commit -m "refactor(documents): UnlockDocument lee la cadena una sola vez

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `ListReadableDocuments`

**Files:**
- Create: `src/documents/server/application/ListReadableDocuments.ts`
- Create: `src/documents/server/application/ListReadableDocuments.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../shared/domain/Result";
import { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { WriteAccess } from "../domain/ports/WriteAccess";
import { ListReadableDocuments } from "./ListReadableDocuments";
import type { ProxyParser } from "./ProxyParser";
import { allowWrites, denyWrites } from "./test/factories";

function doc(id: string, secured: boolean, content: string) {
  return Document.create(
    id,
    {
      id,
      title: id,
      description: "Descripción",
      secured,
      createdAt: new Date("2026-01-01"),
    },
    content,
  ).getValue();
}

function setup(raw: Document[], resolved: Document[] = raw, writeAccess: WriteAccess = denyWrites) {
  const repository = { list: vi.fn().mockResolvedValue(Result.ok(raw)) } as unknown as ContentRepository;
  const proxyParser = { parseProxies: vi.fn().mockResolvedValue(resolved) } as unknown as ProxyParser;
  return new ListReadableDocuments(repository, proxyParser, writeAccess);
}

describe("ListReadableDocuments", () => {
  it("returns every resolved document to a writer of the nanobook", async () => {
    const open = doc("abierto", false, "# Abierto");
    const secured = doc("secreto", true, "# Secreto");

    const result = await setup([open, secured], [open, secured], allowWrites).execute("book-a", { userId: "user-1" });

    expect(result).toEqual([open, secured]);
  });

  it("redacts protected documents for everyone else", async () => {
    const open = doc("abierto", false, "# Abierto");
    const secured = doc("secreto", true, "# Secreto");

    const result = await setup([open, secured]).execute("book-a", { userId: "user-2" });

    expect(result[0]).toBe(open);
    expect(result[1].getContent()).toBe("");
    expect(result[1].getDescription()).toBe("");
    expect(result[1].getMetadata().secured).toBe(true);
  });

  it("redacts protected documents for anonymous readers without asking the write port", async () => {
    const secured = doc("secreto", true, "# Secreto");
    const require = vi.fn();

    const result = await setup([secured], [secured], { require } as unknown as WriteAccess).execute("book-a", {
      userId: undefined,
    });

    expect(result[0].getContent()).toBe("");
    expect(require).not.toHaveBeenCalled();
  });

  it("redacts when only the stored link of a proxy is protected", async () => {
    const raw = doc("proxy", true, "");
    const resolved = doc("proxy", false, "# Contenido del destino");

    const result = await setup([raw], [resolved]).execute("book-a", { userId: "user-2" });

    expect(result[0].getContent()).toBe("");
  });

  it("returns an empty list when the repository fails", async () => {
    const repository = { list: vi.fn().mockResolvedValue(Result.fail(new Error("db"))) } as unknown as ContentRepository;
    const list = new ListReadableDocuments(repository, { parseProxies: vi.fn() } as unknown as ProxyParser, denyWrites);

    expect(await list.execute("book-a", { userId: "user-1" })).toEqual([]);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `pnpm vitest run src/documents/server/application/ListReadableDocuments.test.ts`
Expected: FAIL (`Cannot find module './ListReadableDocuments'`).

- [ ] **Step 3: Implementar**

```ts
import type { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { WriteAccess } from "../domain/ports/WriteAccess";
import { securedDocuments } from "./access/AuthorizeDocumentAccess";
import type { ProxyParser } from "./ProxyParser";

/**
 * Lista los documentos de un nanobook para un lector sin desafío posible
 * (por ejemplo un agente): los protegidos se devuelven redactados salvo para
 * quien puede escribir en el nanobook.
 */
export class ListReadableDocuments {
  constructor(
    private readonly repository: ContentRepository,
    private readonly proxyParser: ProxyParser,
    private readonly writeAccess: WriteAccess,
  ) {}

  async execute(nanobookId: string, { userId }: { userId: string | undefined }): Promise<Document[]> {
    const listed = await this.repository.list(nanobookId);
    if (!listed.isSuccess) return [];

    const raw = listed.getValue();
    const resolved = await this.proxyParser.parseProxies(nanobookId, raw);
    // Un fallo al consultar el puerto cuenta como «no escritor».
    const canWrite = userId !== undefined && (await this.writeAccess.require(nanobookId, userId)).isSuccess;
    if (canWrite) return resolved;

    return resolved.map((document, index) =>
      securedDocuments([raw[index], document]).length > 0 ? raw[index].redacted() : document,
    );
  }
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `pnpm vitest run src/documents/server/application/ListReadableDocuments.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/documents/server/application/ListReadableDocuments.ts src/documents/server/application/ListReadableDocuments.test.ts
git commit -m "feat(documents): añade ListReadableDocuments que redacta lo protegido

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Cablear el módulo

**Files:**
- Modify: `src/documents/server/index.ts`

- [ ] **Step 1: Imports**

Añadir junto a los demás imports de `application/`:

```ts
import { ReadDocument } from "./application/ReadDocument";
import { ListReadableDocuments } from "./application/ListReadableDocuments";
```

y re-exportar el tipo del visor junto a los demás `export type`:

```ts
export type { DocumentViewer, ReadDocumentResult } from "./application/ReadDocument";
```

- [ ] **Step 2: Constructor de `DocumentModule`**

Reemplazar `public readonly authorizeDocumentAccess: AuthorizeDocumentAccess,` por:

```ts
    public readonly readDocument: ReadDocument,
    public readonly listReadableDocuments: ListReadableDocuments,
```

- [ ] **Step 3: Composición en `create`**

Tras construir `authorizeDocumentAccess` y `unlockDocument` (la variable local `authorizeDocumentAccess` se mantiene: la usa `ReadDocument`), añadir:

```ts
    const readDocument = new ReadDocument(getDocument, authorizeDocumentAccess, writeAccess);
    const listReadableDocuments = new ListReadableDocuments(contentRepository, proxyParser, writeAccess);
```

y en el `return new DocumentModule(...)` sustituir el argumento `authorizeDocumentAccess,` por `readDocument, listReadableDocuments,` (mismo orden que el constructor).

- [ ] **Step 4: Comprobar tipos**

Run: `pnpm astro check`
Expected: error **solo** en `pages/n/[nanobookSlug]/[...slug]/index.astro` (todavía usa `authorizeDocumentAccess`); se corrige en el Task 8. Cualquier otro error: arreglarlo antes de seguir.

- [ ] **Step 5: Commit** (junto con el Task 8, para que el árbol compile)

---

### Task 8: Migrar la página pública

**Files:**
- Modify: `src/pages/n/[nanobookSlug]/[...slug]/index.astro` (desde `const { nanobook, user } = access;` hasta el `---` de cierre del frontmatter)

- [ ] **Step 1: Reemplazar el bloque**

Sustituir todo desde `const { nanobook, user } = access;` hasta justo antes del segundo `---` por:

```astro
const { nanobook, user } = access;
const nanobookId = nanobook.getId();
const slug = Astro.params.slug || "index";
const documentModule = app.nanobookModule.documentModule;

const read = await measure("document", () =>
  documentModule.readDocument.execute({
    nanobookId,
    path: slug,
    observeTiming: (name, duration) => {
      timings[name] = duration;
    },
    viewer: {
      // Public nanobooks skip the session read; it is resolved only when a link is protected.
      userId: async () =>
        user?.id ?? (await app.authServerModule.getSession(Astro.request, Astro.response.headers))?.id,
      grantFor: grantsFromCookieHeader(Astro.request.headers.get("cookie")),
    },
  })
);
if (read.kind === "not-found") return new Response("Document not found", { status: 404 });

const challenged = read.kind === "challenge";
if (challenged) {
  Astro.response.status = 401;
  Astro.response.headers.set("Cache-Control", "no-store");
}
// Protected content is never indexed, whether it is shown or only challenged.
if (challenged || (read.kind === "allowed" && read.via !== "open")) {
  Astro.response.headers.set("X-Robots-Tag", "noindex, nofollow");
}
Astro.response.headers.set("Server-Timing", formatServerTiming(timings));
```

eliminar el import de `AuthorizeNanobook` (la página ya no decide si el visor es escritor) y cambiar la última línea del archivo a:

```astro
<DocumentPage nanobook={nanobook} user={user} document={read.document} challenged={challenged} />
```

- [ ] **Step 2: Comprobar tipos y build**

Run: `pnpm astro check`
Expected: 0 errores.

- [ ] **Step 3: Verificación manual** (`pnpm dev`, nanobook con un documento protegido)

1. Anónimo sobre documento protegido → 401, formulario de desbloqueo, sin contenido en el HTML, cabeceras `no-store` y `noindex`.
2. Tras desbloquear con la contraseña → 200 con contenido.
3. Dueño → 200 sin desafío.
4. Documento abierto de un nanobook público → 200 y **no** se lee la sesión (cabecera `Server-Timing` sin `route-session` extra; sin cookie de sesión nueva).
5. Proxy con origen protegido y destino abierto → 401.
6. Documento protegido visto por el dueño o con grant → 200 con `X-Robots-Tag: noindex, nofollow`; documento abierto → sin esa cabecera.

- [ ] **Step 4: Commit**

```bash
git add src/documents/server/index.ts "src/pages/n/[nanobookSlug]/[...slug]/index.astro"
git commit -m "refactor(documents): la página pública lee a través de ReadDocument

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Cerrar el hueco MCP

**Files:**
- Modify: `src/agents/server/application/AgentToolService.ts` (`listDocuments`, `getDocument`, ~líneas 101-120)
- Create: `src/agents/server/application/AgentToolService.read.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../shared/domain/Result";
import { Document } from "../../../documents/server/domain/Document";
import { DocumentAccessDeniedError, DocumentNotFoundError } from "../../../documents/server/domain/errors";
import type { NanobookModule } from "../../../nanobooks/server";
import { createMarkdownBlockAdvisor } from "../../../application/server/createMarkdownBlockAdvisor";
import type { AgentActor } from "./dto";
import { AgentToolService } from "./AgentToolService";

const reader: AgentActor = { actorId: "visitante", oauthClientId: "claude", scopes: ["nanobooks:read"] };
const owner: AgentActor = { actorId: "dueño", oauthClientId: "claude", scopes: ["nanobooks:read"] };

function secured() {
  return Document.create(
    "guia",
    { id: "doc-1", title: "Guía", description: "d", secured: true, createdAt: new Date("2026-01-01") },
    "# Secreto",
  ).getValue();
}

function setup(readResult: unknown) {
  const readDocument = { execute: vi.fn().mockResolvedValue(readResult) };
  const listReadableDocuments = { execute: vi.fn().mockResolvedValue([]) };
  const nanobooks = {
    requireNanobookAccess: { execute: vi.fn().mockResolvedValue(Result.ok({})) },
    documentModule: { readDocument, listReadableDocuments },
  } as unknown as NanobookModule;
  const tools = new AgentToolService(nanobooks, { write: vi.fn() }, createMarkdownBlockAdvisor());
  return { tools, readDocument, listReadableDocuments };
}

describe("AgentToolService reads respect document protection", () => {
  it("denies a protected document when the module challenges", async () => {
    const { tools } = setup({ kind: "challenge", method: "password", document: secured().redacted() });

    const result = await tools.getDocument(reader, "book-a", "guia");

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentAccessDeniedError);
  });

  it("reports a missing document", async () => {
    const { tools } = setup({ kind: "not-found" });

    const result = await tools.getDocument(reader, "book-a", "guia");

    expect(result.getError()).toBeInstanceOf(DocumentNotFoundError);
  });

  it("returns the document when access is allowed", async () => {
    const { tools } = setup({ kind: "allowed", document: secured(), via: "writer" });

    const result = await tools.getDocument(owner, "book-a", "guia");

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().content).toBe("# Secreto");
  });

  it("identifies the actor to the module and presents no grants", async () => {
    const { tools, readDocument } = setup({ kind: "not-found" });

    await tools.getDocument(owner, "book-a", "guia");
    await tools.getDocument(reader, "book-a", "guia");

    const [ownerViewer, readerViewer] = readDocument.execute.mock.calls.map((call) => call[0].viewer);
    expect(await ownerViewer.userId()).toBe("dueño");
    expect(await readerViewer.userId()).toBe("visitante");
    expect(readerViewer.grantFor("doc-1")).toBeUndefined();
  });

  it("lists on behalf of the actor and lets the module decide what is readable", async () => {
    const { tools, listReadableDocuments } = setup({ kind: "not-found" });

    await tools.listDocuments(owner, "book-a");
    await tools.listDocuments(reader, "book-a");

    expect(listReadableDocuments.execute).toHaveBeenNthCalledWith(1, "book-a", { userId: "dueño" });
    expect(listReadableDocuments.execute).toHaveBeenNthCalledWith(2, "book-a", { userId: "visitante" });
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `pnpm vitest run src/agents/server/application/AgentToolService.read.test.ts`
Expected: FAIL (`getAllDocuments`/`getDocument` no definidos en el mock del módulo).

- [ ] **Step 3: Implementar**

En `AgentToolService.ts`, importar:

```ts
import { DocumentAccessDeniedError, DocumentNotFoundError } from "../../../documents/server/domain/errors";
```

(sustituye solo el import actual de `DocumentNotFoundError`; no hace falta importar `AuthorizeNanobook`: el módulo decide quién es escritor).

Reemplazar `listDocuments` y `getDocument`:

```ts
  async listDocuments(actor: AgentActor, nanobookId: string) {
    const access = await this.require(actor, nanobookId, "read");
    if (!access.isSuccess) return access;
    const documents = await this.nanobooks.documentModule.listReadableDocuments.execute(nanobookId, {
      userId: actor.actorId,
    });
    return Result.ok(documents.map((document) => serializeEntry(document.parse())));
  }

  async getDocument(actor: AgentActor, nanobookId: string, path: string) {
    const access = await this.require(actor, nanobookId, "read");
    if (!access.isSuccess) return access;
    const read = await this.nanobooks.documentModule.readDocument.execute({
      nanobookId,
      path,
      viewer: {
        userId: async () => actor.actorId,
        // Un agente no tiene cómo superar el desafío de contraseña.
        grantFor: () => undefined,
      },
    });
    if (read.kind === "not-found") return Result.fail(new DocumentNotFoundError(path));
    if (read.kind === "challenge") {
      return Result.fail(new DocumentAccessDeniedError(read.document.getDocumentId().getValue()));
    }
    return Result.ok(serializeEntry(read.document.parse()));
  }
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `pnpm vitest run src/agents/`
Expected: PASS (los tests nuevos y los existentes de `createNanobookMcpServer`).

- [ ] **Step 5: Verificar que las rutas que siguen usando `getDocument` exigen `write`**

Run: `grep -rn "resolveNanobookRoute" src/pages | grep -i "edit\|new\|preview"`
Expected: cada ruta de `edit`, `new` y `preview` llama con `"write"`. Si alguna usa `"read"`, **detenerse y reportarlo**: significa que hay otra superficie sin protección.

- [ ] **Step 6: Commit**

```bash
git add src/agents/server/application/AgentToolService.ts src/agents/server/application/AgentToolService.read.test.ts
git commit -m "fix(agents): get_document y list_documents respetan documentos protegidos

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: `CreateDocument` protegido desde el módulo (y sus llamadores)

**Files:**
- Modify: `src/documents/server/application/CreateDocument.ts`
- Modify: `src/documents/server/application/dto/DocumentInput.ts`
- Modify: `src/documents/server/application/CreateDocument.test.ts`
- Modify: `src/documents/server/infraestructure/rest/CreateDocumentController.ts` y `.test.ts`
- Modify: `src/nanobooks/server/application/CreateNanobook.ts`
- Modify: `src/agents/server/application/AgentToolService.ts` (`createDocument`)
- Modify: `src/documents/server/index.ts` (cableado)
- Create: `src/agents/server/application/AgentToolService.write.test.ts`

- [ ] **Step 1: Tests que fallan en `CreateDocument.test.ts`**

Añadir `allowWrites` y `denyWrites` al import de `./test/factories`. Reemplazar el test «persists the owner assigned by the authenticated flow» por:

```ts
  it("assigns the acting user as owner of the new document", async () => {
    const useCase = new CreateDocument(createRepository(), createEventBus(), allowWrites);

    const result = await useCase.execute(
      "book-a",
      buildDocumentInput({ path: "index" }),
      "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv",
    );

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().getMetadata().ownerId).toBe("toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv");
  });

  it("rejects actors without write access and persists nothing", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    const useCase = new CreateDocument(repository, eventBus, denyWrites);

    const result = await useCase.execute("book-a", buildDocumentInput({ path: "index" }), "intruso");

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(WriteAccessDeniedError);
    expect(repository.create).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
```

(importar `WriteAccessDeniedError` desde `../domain/errors`). En los demás tests del archivo: cada `new CreateDocument(repository, eventBus)` pasa a `new CreateDocument(repository, eventBus, allowWrites)` y cada `.execute("book-a", X)` a `.execute("book-a", X, "owner-1")`. Localiza todos con `grep -n "new CreateDocument(\|\.execute(" src/documents/server/application/CreateDocument.test.ts` (14 constructores).

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `pnpm vitest run src/documents/server/application/CreateDocument.test.ts`
Expected: FAIL (el constructor no acepta `WriteAccess`; el test de denegación crea el documento).

- [ ] **Step 3: Implementar `CreateDocument`**

```ts
import type { WriteAccess } from "../domain/ports/WriteAccess";
// ...
export class CreateDocument {
  constructor(
    private repository: ContentRepository,
    private eventBus: EventBus,
    private writeAccess: WriteAccess,
  ) {}

  async execute(
    nanobookId: string,
    input: DocumentInput,
    actorId: string,
  ): Promise<Result<CreateDocumentError, Document>> {
    const writable = await this.writeAccess.require(nanobookId, actorId);
    if (!writable.isSuccess) return Result.fail(writable.getError());

    const pathResult = DocumentPath.create(input.path);
    // ... (resto sin cambios hasta el objeto de metadatos)
```

y en el objeto de metadatos de `Document.create` sustituir `ownerId: input.ownerId,` por `ownerId: actorId,`. En `dto/DocumentInput.ts` eliminar la línea `ownerId?: string;`.

- [ ] **Step 4: Adaptar llamadores**

`CreateDocumentController.ts`: reemplazar la llamada por

```ts
      const result = await this.createDocument.execute(
        nanobookId,
        toDocumentInput(payload),
        locals.currentUserId,
      );
```

y en su test sustituir la aserción final por:

```ts
    expect(execute).toHaveBeenCalledWith(
      "book-a",
      expect.not.objectContaining({ ownerId: expect.anything() }),
      "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv",
    );
```

(renombrar el test a «passes the authenticated actor and ignores a forged owner»).

`CreateNanobook.ts`: en la llamada al documento raíz, quitar `ownerId: nanobook.getOwnerId(),` del objeto y añadir tercer argumento `nanobook.getOwnerId()`. El nanobook ya está persistido en ese punto (`repository.create` ocurre antes), así que el chequeo de escritura pasa para su dueño. Luego `grep -rn "createDocument" src/nanobooks --include=*.test.ts` y adaptar las aserciones que dependan de la firma anterior.

`AgentToolService.createDocument`:

```ts
    const result = await this.nanobooks.documentModule.createDocument.execute(
      nanobookId,
      { ...input, author: input.author ?? actor.actorId },
      actor.actorId,
    );
```

`src/documents/server/index.ts`: `new CreateDocument(contentRepository, eventBus, writeAccess)`.

- [ ] **Step 5: Test del agente (la entrada ya no lleva `ownerId`)**

`src/agents/server/application/AgentToolService.write.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../shared/domain/Result";
import { createMarkdownBlockAdvisor } from "../../../application/server/createMarkdownBlockAdvisor";
import type { NanobookModule } from "../../../nanobooks/server";
import type { AgentActor } from "./dto";
import { AgentToolService } from "./AgentToolService";

const actor: AgentActor = { actorId: "dueño", oauthClientId: "claude", scopes: ["nanobooks:write"] };

describe("AgentToolService writes", () => {
  it("creates documents on behalf of the actor without sending an owner", async () => {
    const created = { getDocumentId: () => ({ getValue: () => "doc-1" }) };
    const execute = vi.fn().mockResolvedValue(Result.ok(created));
    const nanobooks = {
      requireNanobookAccess: { execute: vi.fn().mockResolvedValue(Result.ok({})) },
      documentModule: { createDocument: { execute } },
    } as unknown as NanobookModule;
    const tools = new AgentToolService(nanobooks, { write: vi.fn() }, createMarkdownBlockAdvisor());

    await tools.createDocument(actor, "book-a", {
      id: "doc-1", path: "guia", title: "Guía", description: "d", content: "# Guía",
    } as never);

    const [nanobookId, input, actorId] = execute.mock.calls[0];
    expect(nanobookId).toBe("book-a");
    expect(input).not.toHaveProperty("ownerId");
    expect(input.author).toBe("dueño");
    expect(actorId).toBe("dueño");
  });
});
```

- [ ] **Step 6: Ejecutar y ver que pasa**

Run: `pnpm vitest run src/documents src/agents src/nanobooks` → Expected: PASS.
Run: `pnpm astro check` → Expected: 0 errores.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat(documents): CreateDocument comprueba el permiso de escritura y estampa el dueño

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: `UpdateDocument` y `DeleteDocument` protegidos desde el módulo

**Files:**
- Modify: `src/documents/server/application/UpdateDocument.ts`
- Modify: `src/documents/server/application/DeleteDocument.ts`
- Modify: `src/documents/server/application/UpdateDocument.test.ts`, `UpdateDocument.secured.test.ts`
- Create: `src/documents/server/application/DeleteDocument.test.ts`
- Modify: `src/documents/server/index.ts` (cableado)

- [ ] **Step 1: Tests que fallan**

En `UpdateDocument.test.ts`, importar `allowWrites`/`denyWrites` y `WriteAccessDeniedError`, cambiar el constructor a `new UpdateDocument(repository, eventBus, allowWrites)` y añadir:

```ts
  it("rejects actors without write access before reading anything", async () => {
    const repository = createRepository();
    const useCase = new UpdateDocument(repository, createEventBus(), denyWrites);

    const result = await useCase.execute(
      "book-a",
      { id: "doc-1", path: "intro", title: "T", description: "D", createdAt: new Date("2024-01-02"), content: "# T" },
      "intruso",
    );

    expect(result.getError()).toBeInstanceOf(WriteAccessDeniedError);
    expect(repository.getById).not.toHaveBeenCalled();
    expect(repository.updateMany).not.toHaveBeenCalled();
  });

  it("lets a nanobook writer edit a document whose stored owner is someone else", async () => {
    const existing = createDocument(
      "intro",
      { title: "Old", description: "Old", createdAt: new Date("2024-01-01"), ownerId: "otro-usuario" },
      "# Old",
    );
    const repository = createRepository({ getById: vi.fn().mockResolvedValue(Result.ok(existing)) });

    const result = await new UpdateDocument(repository, createEventBus(), allowWrites).execute(
      "book-a",
      { id: existing.getDocumentId().getValue(), path: "intro", title: "New", description: "New", createdAt: new Date("2024-01-02"), content: "# New" },
      "escritor",
    );

    expect(result.isSuccess).toBe(true);
  });
```

En `UpdateDocument.secured.test.ts`: los dos `new UpdateDocument(repository, createEventBus())` pasan a llevar `, allowWrites` (importarlo de `./test/factories`).

`DeleteDocument.test.ts` (nuevo):

```ts
import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../shared/domain/Result";
import { WriteAccessDeniedError } from "../domain/errors";
import { DeleteDocument } from "./DeleteDocument";
import { allowWrites, createDocument, createEventBus, createRepository, denyWrites } from "./test/factories";

const stored = createDocument(
  "intro",
  { title: "Intro", description: "d", createdAt: new Date("2024-01-01"), ownerId: "otro-usuario" },
  "# Intro",
);

function repository() {
  return createRepository({
    getById: vi.fn().mockResolvedValue(Result.ok(stored)),
    list: vi.fn().mockResolvedValue(Result.ok([stored])),
  });
}

describe("DeleteDocument", () => {
  it("rejects actors without write access before reading anything", async () => {
    const repo = repository();

    const result = await new DeleteDocument(repo, createEventBus(), denyWrites).execute("book-a", "doc-1", "intruso");

    expect(result.getError()).toBeInstanceOf(WriteAccessDeniedError);
    expect(repo.getById).not.toHaveBeenCalled();
    expect(repo.deleteMany).not.toHaveBeenCalled();
  });

  it("lets a nanobook writer delete a document whose stored owner is someone else", async () => {
    const repo = repository();

    const result = await new DeleteDocument(repo, createEventBus(), allowWrites).execute(
      "book-a",
      stored.getDocumentId().getValue(),
      "escritor",
    );

    expect(result.isSuccess).toBe(true);
    expect(repo.deleteMany).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `pnpm vitest run src/documents/server/application/UpdateDocument.test.ts src/documents/server/application/DeleteDocument.test.ts`
Expected: FAIL (constructores sin `WriteAccess`; el actor distinto del `ownerId` recibe `DocumentAccessDeniedError`).

- [ ] **Step 3: Implementar**

`UpdateDocument.ts`: constructor `(private contentRepository, private eventBus, private writeAccess: WriteAccess)`; al principio de `execute`, antes de leer `documentDelta.id`:

```ts
    const writable = await this.writeAccess.require(nanobookId, actorId);
    if (!writable.isSuccess) return Result.fail(writable.getError());
```

Eliminar el bloque `if (existingDocument.getMetadata().ownerId !== actorId) { ... }` y el bloque `const unauthorizedDocument = documentsToUpdate ... if (unauthorizedDocument) { ... }`, y quitar `DocumentAccessDeniedError` de los imports si queda sin uso.

`DeleteDocument.ts`: igual: constructor con `private writeAccess: WriteAccess`, comprobación al inicio de `execute`, eliminar el `if (document.getMetadata().ownerId !== actorId)` y el bloque `unauthorizedDocument`, limpiar imports.

`index.ts`: `new UpdateDocument(contentRepository, eventBus, writeAccess)` y `new DeleteDocument(contentRepository, eventBus, writeAccess)`.

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `pnpm vitest run src/documents src/agents` → Expected: PASS.
Run: `pnpm astro check` → Expected: 0 errores.

- [ ] **Step 5: Commit**

```bash
git add src/documents
git commit -m "refactor(documents): Update y Delete autorizan por permiso de escritura del nanobook

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Contraseña de documentos protegida desde el módulo

**Files:**
- Rename: `src/documents/server/application/access/loadOwnedDocument.ts` → `loadWritableDocument.ts`
- Modify: `SetDocumentPassword.ts`, `ClearDocumentPassword.ts`
- Modify: `src/documents/server/application/access/DocumentPasswordAdmin.test.ts`
- Modify: `src/documents/server/index.ts` (cableado)

- [ ] **Step 1: Tests que fallan**

En `DocumentPasswordAdmin.test.ts`: importar `allowWrites`, `denyWrites` de `../test/factories` y `WriteAccessDeniedError` de `../../domain/errors`. Los constructores pasan a `new SetDocumentPassword(contentRepository, accessRepository, new FakeHasher(), eventBus, allowWrites)` y `new ClearDocumentPassword(contentRepository, accessRepository, eventBus, allowWrites)` (8 sitios: `grep -n "new SetDocumentPassword\|new ClearDocumentPassword"`). Los tests que hoy aserten `DocumentAccessDeniedError` por actor distinto del dueño pasan a construir el caso de uso con `denyWrites` y a esperar `WriteAccessDeniedError`. Añadir, para cada caso de uso, la aserción de que no se escribe nada al ser denegado:

```ts
  it("does not store a password when the actor cannot write", async () => {
    const { contentRepository, accessRepository, eventBus } = setup(document());

    const result = await new SetDocumentPassword(contentRepository, accessRepository, new FakeHasher(), eventBus, denyWrites)
      .execute("book-a", "guia", "una-clave-segura", "intruso");

    expect(result.getError()).toBeInstanceOf(WriteAccessDeniedError);
    expect(accessRepository.records.size).toBe(0);
    expect(contentRepository.updateMany).not.toHaveBeenCalled();
  });
```

(y el equivalente para `ClearDocumentPassword` con `setup(document(true))`).

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `pnpm vitest run src/documents/server/application/access/DocumentPasswordAdmin.test.ts`
Expected: FAIL (constructores sin `WriteAccess`).

- [ ] **Step 3: Implementar**

```bash
git mv src/documents/server/application/access/loadOwnedDocument.ts src/documents/server/application/access/loadWritableDocument.ts
```

Contenido de `loadWritableDocument.ts`:

```ts
import { Result } from "../../../../shared/domain/Result";
import type { Document } from "../../domain/Document";
import { DocumentPath } from "../../domain/DocumentPath";
import {
  DocumentNotFoundError,
  type DocumentRepositoryError,
  type InvalidDocumentError,
  type WriteAccessDeniedError,
} from "../../domain/errors";
import type { ContentRepository, ContentRepositoryListError } from "../../domain/ports/ContentRepository";
import type { WriteAccess } from "../../domain/ports/WriteAccess";

export type LoadWritableDocumentError =
  | WriteAccessDeniedError
  | DocumentRepositoryError
  | ContentRepositoryListError
  | DocumentNotFoundError
  | InvalidDocumentError;

/** Loads a document by public path, requiring write access to its nanobook. */
export async function loadWritableDocument(
  writeAccess: WriteAccess,
  contentRepository: ContentRepository,
  nanobookId: string,
  documentPath: string,
  actorId: string,
): Promise<Result<LoadWritableDocumentError, Document>> {
  const writable = await writeAccess.require(nanobookId, actorId);
  if (!writable.isSuccess) return Result.fail(writable.getError());

  const pathResult = DocumentPath.create(documentPath);
  if (!pathResult.isSuccess) return Result.fail(new DocumentNotFoundError(documentPath));

  const found = await contentRepository.getByPublicPath(nanobookId, pathResult.getValue().getPublicValue());
  if (!found.isSuccess) return Result.fail(found.getError());

  const document = found.getValue();
  if (!document) return Result.fail(new DocumentNotFoundError(documentPath));
  return Result.ok(document);
}
```

`SetDocumentPassword.ts`: importar `loadWritableDocument`/`LoadWritableDocumentError` y `WriteAccess`; en `DocumentAccessAdminError` sustituir `LoadOwnedDocumentError` por `LoadWritableDocumentError`; constructor `(contentRepository, accessRepository, hasher, eventBus, writeAccess: WriteAccess, clock = ...)`; la carga pasa a `loadWritableDocument(this.writeAccess, this.contentRepository, nanobookId, documentPath, actorId)`.

`ClearDocumentPassword.ts`: constructor `(contentRepository, accessRepository, eventBus, writeAccess: WriteAccess, clock = ...)` y la misma sustitución de la carga.

`index.ts`: `new SetDocumentPassword(contentRepository, accessRepository, hasher, eventBus, writeAccess)` y `new ClearDocumentPassword(contentRepository, accessRepository, eventBus, writeAccess)`.

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `pnpm vitest run src/documents` → Expected: PASS (incluye `DocumentAccessControllers.test.ts`, que usa dobles de los casos de uso).
Run: `pnpm astro check` → Expected: 0 errores.

- [ ] **Step 5: Commit**

```bash
git add src/documents
git commit -m "refactor(documents): Set y Clear de contraseña autorizan por permiso de escritura del nanobook

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Verificación final y registro

**Files:**
- Modify: `CHANGELOG.md` (sección `[Unreleased]`)
- Modify/Create: nota en `src/content/nanobook-project/` (decisión arquitectónica)

- [ ] **Step 1: Comprobar que no quedan consumidores del camino antiguo**

Run: `grep -rn "authorizeDocumentAccess" src --include=*.ts --include=*.astro | grep -v "documents/server/index.ts"`
Expected: sin resultados.

Run: `grep -rn "ownerId !== actorId\|loadOwnedDocument\|input.ownerId" src --include=*.ts`
Expected: sin resultados (ninguna autorización por `ownerId` de documento ni entrada `ownerId` en `CreateDocument`).

Run: `grep -rn "createDocument.execute\|updateDocument.execute\|deleteDocument.execute" src --include=*.ts | grep -v test`
Expected: toda llamada pasa `actorId` como último argumento.

- [ ] **Step 2: Suite completa y build**

Run: `pnpm test` → Expected: todo en verde.
Run: `npm run build` → Expected: build correcto (requisito de `CLAUDE.md` antes de commitear).

- [ ] **Step 3: Documentar**

`CHANGELOG.md`, bajo `[Unreleased]`:

```markdown
### Fixed
- MCP: `get_document` y `list_documents` ya no devuelven el contenido de documentos protegidos a quien no es dueño del nanobook.

### Changed
- `documents` expone `readDocument`, que resuelve la protección por sí mismo (`not-found` / `allowed` / `challenge`). La página pública ya no compone la autorización y marca como `noindex` todo acceso a contenido protegido. El desafío muestra el título del documento almacenado, no el del destino de un proxy.
- Las mutaciones de documentos (crear, actualizar, borrar, fijar o quitar contraseña) comprueban el permiso de escritura del nanobook dentro del propio módulo, mediante el puerto `WriteAccess`. Ya no se autoriza por el `ownerId` del documento: los documentos sin dueño dejan de quedar bloqueados para su escritor. `CreateDocument` estampa `ownerId` con el actor y `DocumentInput.ownerId` desaparece.
```

En `src/content/nanobook-project/`, añadir (o ampliar la nota existente sobre documentos protegidos) un párrafo: *la lectura protegida pasa siempre por `ReadDocument`/`ListReadableDocuments`; `getDocument` queda solo para rutas de escritura; el documento de un desafío es el almacenado redactado; superficies pendientes de revisar: `navigation` (`getAllDocuments`), búsqueda, `llms.txt`, RSS, endpoints `.md`.*

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md src/content/nanobook-project
git commit -m "docs(docs): registra ReadDocument y el cierre del hueco MCP

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Riesgos a vigilar durante la ejecución

- **Cambio de comportamiento en escritura (Tasks 10-12):** un escritor del nanobook ahora puede editar o borrar documentos cuyo `ownerId` es otro usuario o está vacío. Es el efecto buscado (decisión 5), pero conviene confirmarlo con una consulta antes de desplegar: `SELECT COUNT(*) FROM document WHERE owner_id IS NULL OR owner_id <> (SELECT owner_id FROM nanobook WHERE nanobook.id = document.nanobook_id)` (ajusta nombres de tabla/columna al esquema Drizzle de `DrizzleDocumentSchema.ts`). Si devuelve filas, hay documentos con dueño distinto al del nanobook y debe decidirse si eso es legítimo.
- **Ciclo de dependencias:** `documents` nunca debe importar de `nanobooks`. Si el compilador sugiere importar `AuthorizeNanobook` en `documents`, la respuesta correcta es ampliar el puerto, no importar.
- **`CreateNanobook` y el chequeo de escritura:** funciona porque el nanobook se persiste antes de crear el documento raíz. Si alguien reordena esos pasos, el chequeo devolverá denegado.
- **Mensajes de error:** `WriteAccessDeniedError` sobrescribe `message` tras `super(...)`. Si algún test existente compara el mensaje de `DocumentAccessDeniedError` con `WriteAccessDeniedError`, ajusta el test, no la jerarquía.

- **`Document.create(...).getValue()`** en `redacted()` asume que un path ya válido sigue siéndolo; si `getValue` lanzara en algún caso límite (índice con `nanobook: true`), el test del Task 2 no lo cubre: añade ahí un caso con documento índice si aparece.
- **Orden de `parseProxies`:** `ListReadableDocuments` supone que devuelve los documentos en el mismo orden que recibe (`Promise.all` sobre `map`, hoy cierto). El test de proxy del Task 6 lo fija.
- **Sesión perezosa:** el paso 4 de la verificación manual del Task 8 es lo único que comprueba que no se lee la sesión en lecturas públicas; no tiene test automático.
