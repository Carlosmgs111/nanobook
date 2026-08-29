import { FileSystemRepository } from "./file-system-repository";
import { GitHubRepository } from "./github-repository";
import { MemoryRepository } from "./memory-repository";
import type { ContentRepository } from "../../model/types";

export type RepositorySource = "filesystem" | "github" | "memory";

export interface CreateContentRepositoryOptions {
  source?: RepositorySource;
  initialDocuments?: import("../../model/types").Document[];
}

/**
 * Crea una implementación de ContentRepository según la fuente configurada.
 *
 * - `filesystem`: usa FileSystemRepository, que lee directamente desde
 *   src/content. Es el valor por defecto y funciona en runtime, build y tests.
 * - `github`: usa GitHubRepository, que lee Markdown desde un repo remoto.
 *   Requiere GITHUB_OWNER, GITHUB_REPO y opcionalmente GITHUB_BRANCH,
 *   GITHUB_TOKEN y GITHUB_PATH.
 * - `memory`: usa MemoryRepository. Pensado para tests y desarrollo rápido.
 *
 * La fuente se lee de la variable de entorno CONTENT_SOURCE. Si no está
 * definida, se usa `filesystem`.
 */

export async function createContentRepository(
  sourceOrOptions: RepositorySource | CreateContentRepositoryOptions = getConfiguredSource(),
): Promise<ContentRepository> {
  const options: CreateContentRepositoryOptions =
    typeof sourceOrOptions === "string" ? { source: sourceOrOptions } : sourceOrOptions;

  switch (options.source ?? getConfiguredSource()) {
    case "filesystem":
      return new FileSystemRepository();
    case "github":
      return createGitHubRepository();
    case "memory":
      return new MemoryRepository(options.initialDocuments);
    default:
      throw new Error(`Unsupported content source: ${options.source}`);
  }
}

function getConfiguredSource(): RepositorySource {
  const env =
    typeof process !== "undefined" ? process.env.CONTENT_SOURCE : undefined;

  if (env === "filesystem" || env === "github") {
    return env;
  }

  return "filesystem";
}

function createGitHubRepository(): ContentRepository {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!owner || !repo) {
    throw new Error(
      "GitHubRepository requires GITHUB_OWNER and GITHUB_REPO environment variables.",
    );
  }

  return new GitHubRepository({
    owner,
    repo,
    branch: process.env.GITHUB_BRANCH,
    token: process.env.GITHUB_TOKEN,
    path: process.env.GITHUB_PATH,
  });
}
