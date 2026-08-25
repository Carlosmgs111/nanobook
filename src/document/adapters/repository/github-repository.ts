import { fetchFileContent, fetchGitHubTree } from "../github-loader/api";
import { createParsedEntry } from "../github-loader/parser";
import { filterContentFiles } from "../github-loader";
import type { ContentRepository, Document } from "../../model/types";
import { buildDocument } from "./document-builder";

import type { GitHubLoaderOptions } from "../github-loader/types";

export interface GitHubRepositoryOptions {
  owner: string;
  repo: string;
  branch?: string;
  token?: string;
  path?: string;
  /** Patrón de archivos a incluir/excluir. Por defecto excluye README.md. */
  pattern?: GitHubLoaderOptions["pattern"];
}

/**
 * Repositorio de contenido que lee Markdown desde un repositorio de GitHub.
 *
 * Útil cuando el contenido vive en un repo separado y se actualiza sin
 * redeploy. No implementa save() porque el proyecto no escribe de vuelta a
 * GitHub.
 *
 * Por defecto excluye README.md para alinearse con el comportamiento del
 * github-loader de Astro, que también lo excluye del pattern por defecto.
 */
export class GitHubRepository implements ContentRepository {
  private branch: string;
  private path: string;
  private pattern: GitHubLoaderOptions["pattern"];

  constructor(private options: GitHubRepositoryOptions) {
    this.branch = options.branch ?? "main";
    this.path = options.path ?? "";
    this.pattern = options.pattern ?? ["**/*.md", "!README.md"];
  }

  async list(): Promise<Document[]> {
    const { owner, repo, token } = this.options;

    const tree = await fetchGitHubTree({
      owner,
      repo,
      branch: this.branch,
      token,
    });

    const contentFiles = filterContentFiles(tree, this.path, this.pattern);
    const documents: Document[] = [];

    for (const file of contentFiles) {
      try {
        const raw = await fetchFileContent({
          owner,
          repo,
          branch: this.branch,
          token,
          path: file.path,
        });

        const { id, data, body } = createParsedEntry(file.path, raw, this.path);
        documents.push(buildDocument(id, data, body, raw));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Failed to load GitHub file ${file.path}: ${message}`);
      }
    }

    return documents;
  }

  async get(id: string): Promise<Document | null> {
    const documents = await this.list();
    return documents.find((document) => document.id === id) ?? null;
  }

  async listChildren(parentId: string | null): Promise<Document[]> {
    const documents = await this.list();
    return documents.filter((document) => document.parentId === parentId);
  }

  async save(): Promise<void> {
    throw new Error("GitHubRepository does not support saving documents.");
  }
}
