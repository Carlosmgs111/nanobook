import { describe, it, expect } from "vitest";
import {
  createContentRepository,
  type RepositorySource,
} from "../factory";
import { FileSystemRepository } from "../file-system-repository";

describe("createContentRepository", () => {
  it("devuelve FileSystemRepository cuando la fuente es filesystem", async () => {
    const repository = await createContentRepository("filesystem");
    expect(repository).toBeInstanceOf(FileSystemRepository);
  });

  it("lanza error cuando la fuente es github", async () => {
    await expect(
      createContentRepository("github" as RepositorySource),
    ).rejects.toThrow("GitHubRepository is not implemented yet");
  });

  it("lanza error para fuentes desconocidas", async () => {
    await expect(
      createContentRepository("unknown" as RepositorySource),
    ).rejects.toThrow("Unsupported content source");
  });

  // Nota: el caso "astro" no se testea aquí porque AstroCollectionRepository
  // se importa de forma perezosa y requiere el entorno de build de Astro.
  // Ese caso se valida mediante pnpm build.
});
