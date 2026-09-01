import {
  fetchFileContent,
  fetchFileSha,
  fetchGitHubTree,
  updateFileContent,
} from "../../../shared/github/api";
import { DocumentId } from "../../domain/DocumentId";
import {
  createParsedEntry,
  filterContentFiles,
} from "../../../shared/github/parser";
import type { ContentRepository } from "../../domain/types";
import {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
} from "../../domain/errors";
import { withRedisClient } from "../../../shared/utils/redis";

import type { GitHubLoaderOptions } from "../../../shared/github/types";
import type { GitHubTreeItem } from "../../../shared/github/types";
import { Document } from "../../domain/Document";
import type { DocumentParser } from "../../domain/DocumentParser";

export interface GitHubRepositoryOptions {
  owner: string;
  repo: string;
  branch?: string;
  token?: string;
  path?: string;
  /** Patrón de archivos a incluir/excluir. Por defecto excluye README.md. */
  pattern?: GitHubLoaderOptions["pattern"];
  /** TTL del cache de lista de documentos en milisegundos. Por defecto 5 minutos. */
  cacheTtl?: number;
  /** TTL del cache del tree de GitHub en Redis en milisegundos. Por defecto 5 minutos. */
  treeCacheTtl?: number;
}

interface GitHubRepositoryCache {
  documents: Document[];
  expiresAt: number;
}

const globalCache = new Map<string, GitHubRepositoryCache>();

function buildCacheKey(options: GitHubRepositoryOptions): string {
  const pattern = Array.isArray(options.pattern)
    ? options.pattern.join(",")
    : options.pattern ?? "default";
  return `${options.owner}:${options.repo}:${options.branch ?? "main"}:${
    options.path ?? ""
  }:${pattern}`;
}

function buildTreeCacheKey(options: GitHubRepositoryOptions): string {
  return `nanobook:github:tree:${buildCacheKey(options)}`;
}

/**
 * Repositorio de contenido que lee y escribe Markdown desde un repositorio de
 * GitHub.
 *
 * Útil cuando el contenido vive en un repo separado y se actualiza sin
 * redeploy. Implementa save() a través de la GitHub Contents API, creando o
 * actualizando el archivo correspondiente y commiteando directamente en la
 * rama configurada.
 *
 * Cachea la lista de documentos en memoria compartida y el tree de GitHub en
 * Redis durante un TTL configurable para minimizar las llamadas a la API de
 * GitHub. El cache se invalida automáticamente al expirar el TTL y también se
 * invalida de forma proactiva después de guardar un documento.
 *
 * Por defecto excluye README.md para alinearse con el comportamiento del
 * github-loader de Astro, que también lo excluye del pattern por defecto.
 */
export class GitHubRepository implements ContentRepository {
  private branch: string;
  private path: string;
  private pattern: GitHubLoaderOptions["pattern"];
  private cacheTtl: number;
  private treeCacheTtl: number;
  private cacheKey: string;
  private treeCacheKey: string;
  private listPromise: Promise<Document[]> | null = null;
  private treePromise: Promise<GitHubTreeItem[]> | null = null;

  constructor(
    private options: GitHubRepositoryOptions,
    private parser: DocumentParser
  ) {
    this.branch = options.branch ?? "main";
    this.path = options.path ?? "";
    this.pattern = options.pattern ?? ["**/*.md", "!README.md"];
    this.cacheTtl = options.cacheTtl ?? 300_000;
    this.treeCacheTtl = options.treeCacheTtl ?? 300_000;
    this.cacheKey = buildCacheKey(options);
    this.treeCacheKey = buildTreeCacheKey(options);
  }

  async list(): Promise<Document[]> {
    const now = Date.now();
    const cached = globalCache.get(this.cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.documents;
    }

    if (!this.listPromise) {
      this.listPromise = this.fetchDocuments()
        .then((documents) => {
          globalCache.set(this.cacheKey, {
            documents,
            expiresAt: Date.now() + this.cacheTtl,
          });
          return documents;
        })
        .finally(() => {
          this.listPromise = null;
        });
    }

    return this.listPromise;
  }

  private async fetchTree(): Promise<GitHubTreeItem[]> {
    if (this.treePromise) {
      return this.treePromise;
    }

    this.treePromise = this.doFetchTree().finally(() => {
      this.treePromise = null;
    });

    return this.treePromise;
  }

  private async doFetchTree(): Promise<GitHubTreeItem[]> {
    const cachedTree = await withRedisClient(async (client) => {
      const raw = await client.get(this.treeCacheKey);
      return raw ? (JSON.parse(raw) as GitHubTreeItem[]) : null;
    });

    if (cachedTree) {
      return cachedTree;
    }

    const { owner, repo, token } = this.options;
    const tree = await fetchGitHubTree({
      owner,
      repo,
      branch: this.branch,
      token,
    });

    await withRedisClient(async (client) => {
      await client.set(this.treeCacheKey, JSON.stringify(tree), {
        PX: this.treeCacheTtl,
      });
    });

    return tree;
  }

  private async fetchDocuments(): Promise<Document[]> {
    const tree = await this.fetchTree();

    const contentFiles = filterContentFiles(tree, this.path, this.pattern);
    const documents: Document[] = [];

    for (const file of contentFiles) {
      try {
        const raw = await fetchFileContent({
          owner: this.options.owner,
          repo: this.options.repo,
          branch: this.branch,
          token: this.options.token,
          path: file.path,
        });

        const { id, data, body } = createParsedEntry(file.path, raw, this.path);
        documents.push(Document.create(id, data, body));
      } catch (error) {
        // console.log(error);
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Failed to load GitHub file ${file.path}: ${message}`);
      }
    }

    return documents;
  }

  async get(id: DocumentId): Promise<Document | null> {
    const documents = await this.list();
    return (
      documents.find(
        (document) => document.getId().getValue() === id.getValue()
      ) ?? null
    );
  }

  async getBySlug(slug: string): Promise<Document | null> {
    const documents = await this.list();
    return documents.find((document) => document.getSlug() === slug) ?? null;
  }

  async listChildren(parentId: string | null): Promise<Document[]> {
    const documents = await this.list();
    return documents.filter(
      (document) => document.getId().getParentId() === parentId
    );
  }

  private idToGitHubPath(id: string, isIndex: boolean): string {
    const base = this.path ? `${this.path}/` : "";
    if (id === "index") {
      return `${base}index.md`.replace(/^\/+/, "");
    }
    const filePath = isIndex ? `${base}${id}/index.md` : `${base}${id}.md`;
    return filePath.replace(/^\/+/, "");
  }

  async create(document: Document): Promise<void> {
    try {
      const path = this.idToGitHubPath(
        document.getId().getValue(),
        document.getMetadata().index
      );
      const { owner, repo, token } = this.options;

      const sha = await fetchFileSha({
        owner,
        repo,
        branch: this.branch,
        token,
        path,
      });

      if (sha) {
        throw new DocumentAlreadyExistsError(document.getId());
      }

      await updateFileContent({
        owner,
        repo,
        branch: this.branch,
        token,
        path,
        content: document.getRawFrontmatter() + document.getContent(),
        message: `Create ${path}`,
      });

      this.clearCache();
    } catch (error) {
      console.error(error);
      throw new DocumentAlreadyExistsError(document.getId());
    }
  }

  async update(document: Document): Promise<void> {
    const path = this.idToGitHubPath(
      document.getId().getValue(),
      document.getMetadata().index
    );
    const { owner, repo, token } = this.options;

    const sha = await fetchFileSha({
      owner,
      repo,
      branch: this.branch,
      token,
      path,
    });

    if (!sha) {
      throw new DocumentNotFoundError(document.getId());
    }

    await updateFileContent({
      owner,
      repo,
      branch: this.branch,
      token,
      path,
      content: document.getRawFrontmatter() + document.getContent(),
      sha,
      message: `Update ${path}`,
    });

    this.clearCache();
  }

  /** Invalida el cache de documentos de esta instancia. */
  clearCache(): void {
    globalCache.delete(this.cacheKey);
  }

  /** Invalida todo el cache global de GitHubRepository. */
  static clearAllCache(): void {
    globalCache.clear();
  }
}
