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

  it("does not write when nothing changed", async () => {
    const { documents, useCase } = setup();

    const result = await useCase.execute({ ...command, next: command.original });

    expect(result.isSuccess).toBe(true);
    expect(documents.write).not.toHaveBeenCalled();
  });

  it("returns the write failure", async () => {
    const { useCase } = setup("allow", { write: vi.fn().mockResolvedValue(Result.fail(new SheetRevisionConflictError())) });

    expect((await useCase.execute(command)).getError()).toBeInstanceOf(SheetRevisionConflictError);
  });
});
