import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSystemRepository } from "../file-system-repository";
import { buildNewDocument } from "../../utils/document-builder";
import {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
} from "../../../model/errors";

describe("FileSystemRepository", () => {
  let contentDir: string;
  let repository: FileSystemRepository;

  beforeEach(async () => {
    contentDir = await mkdtemp(join(tmpdir(), "nanobook-test-"));
    repository = new FileSystemRepository(contentDir);
  });

  afterEach(async () => {
    await rm(contentDir, { recursive: true, force: true });
  });

  it("crea un documento nuevo", async () => {
    const document = buildNewDocument("blog/post", {
      title: "Post",
      description: "Desc",
    });

    await repository.create(document);
    const found = await repository.get("blog/post");

    expect(found).not.toBeNull();
    expect(found?.title).toBe("Post");
  });

  it("crea un índice de directorio", async () => {
    const document = buildNewDocument("blog/index", {
      title: "Blog",
      description: "Índice",
    });

    await repository.create(document);
    const found = await repository.get("blog");

    expect(found).not.toBeNull();
    expect(found?.metadata.index).toBe(true);
  });

  it("rechaza create si el documento ya existe", async () => {
    const document = buildNewDocument("blog/post", {
      title: "Post",
      description: "Desc",
    });

    await repository.create(document);
    await expect(repository.create(document)).rejects.toBeInstanceOf(
      DocumentAlreadyExistsError,
    );
  });

  it("actualiza un documento existente", async () => {
    const document = buildNewDocument("blog/post", {
      title: "Post",
      description: "Desc",
    });

    await repository.create(document);

    const updated = {
      ...document,
      content: "Contenido actualizado",
      rawFrontmatter: document.rawFrontmatter,
    };

    await repository.update(updated);
    const found = await repository.get("blog/post");

    expect(found?.content).toBe("Contenido actualizado");
  });

  it("rechaza update si el documento no existe", async () => {
    const document = buildNewDocument("blog/post", {
      title: "Post",
      description: "Desc",
    });

    await expect(repository.update(document)).rejects.toBeInstanceOf(
      DocumentNotFoundError,
    );
  });

  it("crea directorios padre si no existen", async () => {
    const document = buildNewDocument("deep/nested/post", {
      title: "Post",
      description: "Desc",
    });

    await repository.create(document);
    const found = await repository.get("deep/nested/post");

    expect(found).not.toBeNull();
  });
});
