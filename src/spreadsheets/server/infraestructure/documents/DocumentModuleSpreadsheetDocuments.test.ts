import { describe, expect, it, vi } from "vitest";
import { AccessDeniedError } from "../../../../authorization/server";
import { DocumentRevisionConflictError } from "../../../../documents/server";
import { Result } from "../../../../shared/domain/Result";
import { SheetRevisionConflictError, SheetWriteError } from "../../domain/errors";
import { DocumentModuleSpreadsheetDocuments } from "./DocumentModuleSpreadsheetDocuments";

vi.mock("../../../../shared/infrastructure/database/drizzleDatabase", () => ({ db: {} }));
vi.mock("astro:env/server", () => ({ GITHUB_TOKEN: undefined, BETTER_AUTH_SECRET: undefined }));

const githubRef = { source: "github", owner: "acme", repo: "datos", path: "ventas.md", branch: "dev" };

const stored = {
  getDocumentId: () => ({ getValue: () => "doc-1" }),
  getPath: () => "ventas",
  getTitle: () => "Ventas",
  getDescription: () => "Resumen",
  getContent: () => "cuerpo",
  getRevision: () => 4,
  getPosition: () => 2,
  getReference: () => ({ getValue: () => "https://github.com/acme/datos/blob/dev/ventas.md" }),
  getMetadata: () => ({ author: "Autora", cover: "c.png", tags: ["a"], draft: false, ref: githubRef }),
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
      ref: githubRef,
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
      expect.objectContaining({ id: "doc-1", path: "ventas", content: "nuevo", expectedRevision: 4, ref: githubRef }),
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
