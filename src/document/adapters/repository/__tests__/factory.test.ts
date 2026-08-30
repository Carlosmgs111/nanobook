import { describe, it, expect } from "vitest";
import {
  createContentRepository,
  type RepositorySource,
} from "../factory";
import { resolveProxies } from "../../../../document/parse/proxy";
import { FileSystemRepository } from "../file-system-repository";
import { GitHubRepository } from "../github-repository";

describe("createContentRepository", () => {
  it("devuelve FileSystemRepository cuando la fuente es filesystem", async () => {
    const repository = await createContentRepository("filesystem", resolveProxies);
    expect(repository).toBeInstanceOf(FileSystemRepository);
  });

  it("devuelve FileSystemRepository por defecto", async () => {
    const repository = await createContentRepository(undefined, resolveProxies);
    expect(repository).toBeInstanceOf(FileSystemRepository);
  });

  it("devuelve GitHubRepository cuando la fuente es github y hay credenciales", async () => {
    const originalOwner = process.env.GITHUB_OWNER;
    const originalRepo = process.env.GITHUB_REPO;

    process.env.GITHUB_OWNER = "test-owner";
    process.env.GITHUB_REPO = "test-repo";

    try {
      const repository = await createContentRepository("github", resolveProxies);
      expect(repository).toBeInstanceOf(GitHubRepository);
    } finally {
      process.env.GITHUB_OWNER = originalOwner;
      process.env.GITHUB_REPO = originalRepo;
    }
  });

  it("lanza error cuando la fuente es github pero faltan credenciales", async () => {
    const originalOwner = process.env.GITHUB_OWNER;
    const originalRepo = process.env.GITHUB_REPO;

    delete process.env.GITHUB_OWNER;
    delete process.env.GITHUB_REPO;

    try {
      await expect(
        createContentRepository("github" as RepositorySource, resolveProxies),
      ).rejects.toThrow(
        "GitHubRepository requires GITHUB_OWNER and GITHUB_REPO",
      );
    } finally {
      process.env.GITHUB_OWNER = originalOwner;
      process.env.GITHUB_REPO = originalRepo;
    }
  });

  it("lanza error para fuentes desconocidos", async () => {
    await expect(
      createContentRepository("unknown" as RepositorySource, resolveProxies),
    ).rejects.toThrow("Unsupported content source");
  });
});
