import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Document } from "../../domain/Document";
import type { DocumentParser } from "../../domain/ports/DocumentParser";
import { FileSystemRepository } from "./FileSystemRepository";

const parser: DocumentParser = {
  parseDocument: () => ({ headings: [] }),
};

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe("FileSystemRepository", () => {
  it("removes an empty directory left behind after moving its index", async () => {
    const contentDir = await mkdtemp(join(tmpdir(), "nanobook-content-"));
    temporaryDirectories.push(contentDir);
    await mkdir(join(contentDir, "guides"), { recursive: true });
    await writeFile(
      join(contentDir, "guides", "index.md"),
      `---\nid: "doc-guides"\ntitle: "Guides"\ndescription: "Guides"\ncreatedAt: 2026-01-01\nupdatedAt: 2026-01-01\nauthor: "Nanobook"\n---\n# Guides\n`
    );

    const repository = new FileSystemRepository(contentDir, parser);
    const moved = Document.create(
      "reference/index",
      {
        id: "doc-guides",
        title: "Guides",
        description: "Guides",
        createdAt: new Date("2026-01-01"),
        author: "Nanobook",
      },
      "# Guides\n"
    );

    expect(moved.isSuccess).toBe(true);
    const result = await repository.update(moved.getValue(), "guides/index");

    expect(result.isSuccess).toBe(true);
    await expect(stat(join(contentDir, "guides"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readFile(join(contentDir, "reference", "index.md"), "utf8")).resolves.toContain(
      'id: "doc-guides"'
    );
  });
});
