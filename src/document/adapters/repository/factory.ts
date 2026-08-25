import { FileSystemRepository } from "./file-system-repository";
import { GitHubRepository } from "./github-repository";
import type { ContentRepository } from "../../model/types";

export type RepositorySource = "astro" | "filesystem" | "github";

/**
 * Crea una implementación de ContentRepository según la fuente configurada.
 *
 * - `astro`: usa AstroCollectionRepository, que aprovecha getCollection y
 *   resuelve proxies. Solo funciona en build time de Astro.
 * - `filesystem`: usa FileSystemRepository, que lee directamente desde
 *   src/content. Funciona en runtime y en scripts standalone, pero aún no
 *   resuelve proxies.
 * - `github`: usa GitHubRepository, que lee Markdown desde un repo remoto.
 *   Requiere GITHUB_OWNER, GITHUB_REPO y opcionalmente GITHUB_BRANCH,
 *   GITHUB_TOKEN y GITHUB_PATH.
 *
 * La fuente se lee de la variable de entorno CONTENT_SOURCE. Si no está
 * definida, se usa `astro` para mantener compatibilidad con el comportamiento
 * previo.
 *
 * La función es asíncrona porque AstroCollectionRepository se importa de forma
 * perezosa; esto permite que los tests y scripts que usan filesystem o github
 * no dependan de "astro:content".
 */
export async function createContentRepository(
  source: RepositorySource = getConfiguredSource(),
): Promise<ContentRepository> {
  switch (source) {
    case "astro": {
      const { AstroCollectionRepository } = await import(
        "./astro-collection-repository"
      );
      return new AstroCollectionRepository();
    }
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

  if (env === "filesystem" || env === "github" || env === "astro") {
    return env;
  }

  return "astro";
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
