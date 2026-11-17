import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../../shared/domain/Result";
import { Document } from "../../domain/Document";
import { DocumentReference } from "../../domain/DocumentReference";
import type { ContentRepository } from "../../domain/ports/ContentRepository";
import { InternalReferenceResolver } from "./InternalReferenceResolver";

const date = new Date("2026-01-01");
const make = (path: string, metadata = {}) =>
  Document.create(path, { id: path.replace("/", "-"), title: path, description: path, createdAt: date, updatedAt: date, ...metadata }, `# ${path}`).getValue();

describe("InternalReferenceResolver", () => {
  it("resolves a relative ref to a document of the same nanobook, keeping its protection flag", async () => {
    const target = make("guias/secreto", { secured: true });
    const getByPublicPath = vi.fn().mockResolvedValue(Result.ok(target));
    const resolver = new InternalReferenceResolver({ getByPublicPath } as unknown as ContentRepository);

    const entry = await resolver.resolve(new DocumentReference("./secreto"), {
      nanobookId: "book",
      sourcePath: make("guias/atajo").getDocumentPath(),
    });

    expect(getByPublicPath).toHaveBeenCalledWith("book", "guias/secreto");
    expect(entry?.body).toBe("# guias/secreto");
    expect(entry?.data.secured).toBe(true);
  });

  it("ignores absolute refs and missing targets", async () => {
    const getByPublicPath = vi.fn().mockResolvedValue(Result.ok(null));
    const resolver = new InternalReferenceResolver({ getByPublicPath } as unknown as ContentRepository);
    const context = { nanobookId: "book", sourcePath: make("atajo").getDocumentPath() };

    expect(await resolver.resolve(new DocumentReference("/README.md"), context)).toBeNull();
    expect(await resolver.resolve(new DocumentReference("./no-existe"), context)).toBeNull();
  });
});
