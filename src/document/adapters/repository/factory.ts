import { FileSystemRepository } from "./file-system-repository";
import { GitHubRepository } from "./github-repository";
import type { ContentRepository } from "../../model/types";

export type RepositorySource = "filesystem" | "github";

/**
 * Crea una implementación de ContentRepository según la fuente configurada.
 *
 * - `filesystem`: usa FileSystemRepository, que lee directamente desde
 *   src/content. Es el valor por defecto y funciona en runtime, build y tests.
 * - `github`: usa GitHubRepository, que lee Markdown desde un repo remoto.
 *   Requiere GITHUB_OWNER, GITHUB_REPO y opcionalmente GITHUB_BRANCH,
 *   GITHUB_TOKEN y GITHUB_PATH.
 *
 * La fuente se lee de la variable de entorno CONTENT_SOURCE. Si no está
 * definida, se usa `filesystem`.
 */
export async function createContentRepository(
  source: RepositorySource = getConfiguredSource(),
): Promise<ContentRepository> {
  switch (source) {
    case "filesystem":
      return new FileSystemRepository();
    case "github":
      return createGitHubRepository();
    default:
      throw new Error(`Unsupported content source: ${source}`);
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
