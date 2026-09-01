import { FileSystemRepository } from "./FileSystemRepository";
import { GitHubRepository } from "./GitHubRepository";
import { InMemoryRepository } from "./InMemoryRepository";
import type { ContentRepository } from "../../_domain/types";
import type { Document } from "../../_domain/types";
import {
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_BRANCH,
  GITHUB_TOKEN,
  GITHUB_PATH,
  CONTENT_SOURCE,
} from "astro:env/server";

export type RepositorySource = "filesystem" | "github" | "memory";

export interface CreateContentRepositoryOptions {
  source?: RepositorySource;
  initialDocuments?: Document[];
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

const contentSource = CONTENT_SOURCE || "filesystem";

export async function createContentRepository(
  resolveProxies: (
    documents: import("../../_domain/Document").Document[]
  ) => Promise<import("../../_domain/Document").Document[]>,
  sourceOrOptions:
    | RepositorySource
    | CreateContentRepositoryOptions = contentSource as RepositorySource
): Promise<ContentRepository> {
  const options: CreateContentRepositoryOptions =
    typeof sourceOrOptions === "string"
      ? { source: sourceOrOptions }
      : sourceOrOptions;
  switch (options.source ?? contentSource) {
    case "filesystem":
      return new FileSystemRepository(undefined, resolveProxies);
    case "github":
      return createGitHubRepository(resolveProxies);
    case "memory":
      return new InMemoryRepository(options.initialDocuments);
    default:
      throw new Error(`Unsupported content source: ${options.source}`);
  }
}

function createGitHubRepository(
  resolveProxies: (documents: Document[]) => Promise<Document[]>
): ContentRepository {
  const owner = GITHUB_OWNER;
  const repo = GITHUB_REPO;

  if (!owner || !repo) {
    throw new Error(
      "GitHubRepository requires GITHUB_OWNER and GITHUB_REPO environment variables."
    );
  }

  return new GitHubRepository(
    {
      owner,
      repo,
      branch: GITHUB_BRANCH,
      token: GITHUB_TOKEN,
      path: GITHUB_PATH,
    },
    resolveProxies
  );
}
