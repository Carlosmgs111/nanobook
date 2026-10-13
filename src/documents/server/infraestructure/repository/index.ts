import { FileSystemRepository } from "./FileSystemRepository";
import { GitHubRepository } from "./GitHubRepository";
import { InMemoryRepository } from "./InMemoryRepository";
import { DrizzleContentRepository } from "./DrizzleContentRepository";
import { db } from "../../../../shared/infrastructure/database/drizzleDatabase";
import type { ContentRepository } from "../../domain/ports/ContentRepository";
import type { Document } from "../../domain/Document";
import { UnifiedDocumentParser } from "../parse/DocumentParser";
import {
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_BRANCH,
  GITHUB_TOKEN,
  GITHUB_PATH,
  CONTENT_SOURCE,
} from "astro:env/server";

export type RepositorySource = "filesystem" | "github" | "memory" | "sql";

export interface CreateContentRepositoryOptions {
  source?: RepositorySource;
  initialDocuments?: Document[];
  nanobookId?: string;
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
      return new FileSystemRepository(undefined, new UnifiedDocumentParser());
    case "github":
      return createGitHubRepository();
    case "memory":
      return new InMemoryRepository(options.initialDocuments);
    case "sql":
      if (!options.nanobookId) {
        throw new Error("SQL content repositories require nanobookId.");
      }
      return new DrizzleContentRepository(
        db,
        options.nanobookId,
        new UnifiedDocumentParser(),
      );
    default:
      throw new Error(`Unsupported content source: ${options.source}`);
  }
}

function createGitHubRepository(): ContentRepository {
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
    new UnifiedDocumentParser()
  );
}
