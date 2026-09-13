import {
  fetchFileContent,
  fetchFileSha,
  fetchGitHubTree,
  updateFileContent,
} from "../../../shared/github/api";
import { DocumentId } from "../../domain/DocumentId";
import { filterContentFiles } from "../../../shared/github/parser";
import { Result } from "../../../shared/utils/Result";
import type {
  ContentRepository,
  ContentRepositoryListError,
} from "../../domain/types";
import {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
} from "../../domain/errors";
import { withRedisClient } from "../../../shared/utils/redis";

import type { GitHubRepositoryConfig } from "../../../shared/github/types";
import type { GitHubTreeItem } from "../../../shared/github/types";
import { Document } from "../../domain/Document";
import type { DocumentParser } from "../../domain/DocumentParser";
import { DocumentRepositoryError } from "../errors";
import { toDocumentId } from "../../../shared/utils/documentPath";
import { createDocumentFromRaw } from "./createDocumentFromRaw";

export interface GitHubRepositoryOptions {
  owner: string;
  repo: string;
  branch?: string;
  token?: string;
  path?: string;
  /** Patrón de archivos a incluir/excluir. Por defecto excluye README.md. */
  pattern?: GitHubRepositoryConfig["pattern"];
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
const globalListPromises = new Map<
  string,
  Promise<Result<ContentRepositoryListError, Document[]>>
>();
const globalTreePromises = new Map<string, Promise<GitHubTreeItem[]>>();

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
export class GitHubRepository implements ContentRepository {
  private branch: string;
  private path: string;
  private pattern: GitHubRepositoryConfig["pattern"];
  private cacheTtl: number;
  private treeCacheTtl: number;
  private cacheKey: string;
  private treeCacheKey: string;

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

  async getById(
    id: string
  ): Promise<Result<ContentRepositoryListError, Document | null>> {
    const documentsResult = await this.list();
    if (!documentsResult.isSuccess) {
      return Result.fail(documentsResult.getError());
    }
    const documents = documentsResult.getValue();
    return Result.ok(
      documents.find((document) => document.getId().getValue() === id) ?? null
    );
  }

  async listChildren(
    parentId: string | null
  ): Promise<Result<ContentRepositoryListError, Document[]>> {
    const documentsResult = await this.list();
    if (!documentsResult.isSuccess) {
      return Result.fail(documentsResult.getError());
    }
    const documents = documentsResult.getValue();
    return Result.ok(
      documents.filter(
        (document) => document.getId().getParentId() === parentId
      )
    );
  }

  async create(
    document: Document
  ): Promise<
    Result<DocumentRepositoryError | DocumentAlreadyExistsError, void>
  > {
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
        return Result.fail(new DocumentAlreadyExistsError(document.getId().getValue()));
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
      return Result.ok();
    } catch (error) {
      return Result.fail(
        new DocumentRepositoryError(
          `Failed to create document "${document
            .getId()
            .getValue()}" on GitHub`,
          { cause: error }
        )
      );
    }
  }

  async update(
    document: Document
  ): Promise<Result<DocumentRepositoryError | DocumentNotFoundError, void>> {
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

      if (!sha) {
        return Result.fail(new DocumentNotFoundError(document.getId().getValue()));
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
      return Result.ok();
    } catch (error) {
      return Result.fail(
        new DocumentRepositoryError(
          `Failed to update document "${document
            .getId()
            .getValue()}" on GitHub`,
          { cause: error }
        )
      );
    }
  }

  async list(): Promise<Result<ContentRepositoryListError, Document[]>> {
    const now = Date.now();
    const cached = globalCache.get(this.cacheKey);
    if (cached && cached.expiresAt > now) {
      return Result.ok(cached.documents);
    }

    let listPromise = globalListPromises.get(this.cacheKey);
    if (!listPromise) {
      listPromise = this.fetchDocuments()
        .then((result) => {
          if (result.isSuccess) {
            globalCache.set(this.cacheKey, {
              documents: result.getValue(),
              expiresAt: Date.now() + this.cacheTtl,
            });
          }
          return result;
        })
        .finally(() => {
          globalListPromises.delete(this.cacheKey);
        });
      globalListPromises.set(this.cacheKey, listPromise);
    }

    return listPromise;
  }

  private idToGitHubPath(id: string, isIndex: boolean): string {
    const base = this.path ? `${this.path}/` : "";
    if (id === "index") {
      return `${base}index.md`.replace(/^\/+/, "");
    }
    const filePath = isIndex ? `${base}${id}/index.md` : `${base}${id}.md`;
    return filePath.replace(/^\/+/, "");
  }

  private async fetchTree(): Promise<GitHubTreeItem[]> {
    let treePromise = globalTreePromises.get(this.treeCacheKey);
    if (treePromise) {
      return treePromise;
    }

    treePromise = this.doFetchTree().finally(() => {
      globalTreePromises.delete(this.treeCacheKey);
    });
    globalTreePromises.set(this.treeCacheKey, treePromise);

    return treePromise;
  }

  private async doFetchTree(): Promise<GitHubTreeItem[]> {
    try {
      const cachedTree = await withRedisClient(async (client) => {
        const raw = await client.get(this.treeCacheKey);
        return raw ? (JSON.parse(raw) as GitHubTreeItem[]) : null;
      });

      if (cachedTree) {
        return cachedTree;
      }
    } catch {
      // Redis es opcional; si falla continuamos sin cache.
    }

    const { owner, repo, token } = this.options;
    const tree = await fetchGitHubTree({
      owner,
      repo,
      branch: this.branch,
      token,
    });

    try {
      await withRedisClient(async (client) => {
        await client.set(this.treeCacheKey, JSON.stringify(tree), {
          PX: this.treeCacheTtl,
        });
      });
    } catch {
      // Redis es opcional; si falla continuamos sin cachear el tree.
    }

    return tree;
  }

  private async fetchDocuments(): Promise<
    Result<ContentRepositoryListError, Document[]>
  > {
    try {
      const tree = await this.fetchTree();

      const contentFiles = filterContentFiles(tree, this.path, this.pattern);
      const documents: Document[] = [];

      for (const file of contentFiles) {
        const raw = await fetchFileContent({
          owner: this.options.owner,
          repo: this.options.repo,
          branch: this.branch,
          token: this.options.token,
          path: file.path,
        });

        const id = toDocumentId(file.path, {
          basePath: this.path,
          lowercase: true,
        });
        const documentResult = createDocumentFromRaw(id, raw, this.parser);
        if (!documentResult.isSuccess) {
          return Result.fail(documentResult.getError());
        }
        documents.push(documentResult.getValue());
      }

      return Result.ok(documents);
    } catch (error) {
      return Result.fail(
        new DocumentRepositoryError("Failed to fetch documents from GitHub", {
          cause: error,
        })
      );
    }
  }

  /** Invalida el cache de documentos de esta instancia. */
  clearCache(): void {
    globalCache.delete(this.cacheKey);
  }
}
