import {
  fetchFileSha,
  fetchGitHubTree,
  fetchGitHubBlob,
  updateFileContent,
} from "../../../shared/github/api";
import { filterContentFiles } from "../../../shared/github/parser";
import { Result } from "../../../shared/domain/Result";
import type {
  ContentRepository,
  ContentRepositoryListError,
} from "../../domain/ports/ContentRepository";
import {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
  DocumentRepositoryError,
} from "../../domain/errors";
import { withRedisClient } from "../../../shared/utils/redis";

import type { GitHubRepositoryConfig } from "../../../shared/github/types";
import type { GitHubTreeItem } from "../../../shared/github/types";
import { Document } from "../../domain/Document";
import type { DocumentParser } from "../../domain/ports/DocumentParser";
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

type NormalizedGitHubRepositoryOptions = Required<
  Pick<GitHubRepositoryOptions, "owner" | "repo" | "branch" | "path" | "pattern">
> &
  Pick<GitHubRepositoryOptions, "token">;

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

const DEFAULT_PATTERN: NonNullable<GitHubRepositoryOptions["pattern"]> = [
  "**/*.md",
  "!README.md",
];
const DEFAULT_CACHE_TTL = 300_000;

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
  private readonly config: NormalizedGitHubRepositoryOptions;
  private readonly cacheTtl: number;
  private readonly treeCacheTtl: number;
  private readonly cacheKey: string;
  private readonly treeCacheKey: string;

  constructor(
    options: GitHubRepositoryOptions,
    private parser: DocumentParser
  ) {
    this.config = {
      ...options,
      branch: options.branch ?? "main",
      path: options.path ?? "",
      pattern: options.pattern ?? DEFAULT_PATTERN,
    };
    this.cacheTtl = options.cacheTtl ?? DEFAULT_CACHE_TTL;
    this.treeCacheTtl = options.treeCacheTtl ?? DEFAULT_CACHE_TTL;
    this.cacheKey = buildCacheKey(options);
    this.treeCacheKey = buildTreeCacheKey(options);
  }

  async getById(
    id: string
  ): Promise<Result<ContentRepositoryListError, Document | null>> {
    return this.findDocument((document) => document.getDocumentId().getValue() === id);
  }

  async getByPath(
    path: string
  ): Promise<Result<ContentRepositoryListError, Document | null>> {
    return this.findDocument((document) => document.getPath() === path);
  }

  async listChildren(
    parentId: string | null
  ): Promise<Result<ContentRepositoryListError, Document[]>> {
    const documentsResult = await this.list();
    if (!documentsResult.isSuccess) return Result.fail(documentsResult.getError());
    return Result.ok(
      documentsResult
        .getValue()
        .filter((document) => document.getParentPath()?.getValue() === parentId)
    );
  }

  async create(
    document: Document
  ): Promise<
    Result<DocumentRepositoryError | DocumentAlreadyExistsError, void>
  > {
    return this.writeDocument(document, "create");
  }

  async update(
    document: Document
  ): Promise<Result<DocumentRepositoryError | DocumentNotFoundError, void>> {
    return this.writeDocument(document, "update");
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

  private async findDocument(
    predicate: (document: Document) => boolean
  ): Promise<Result<ContentRepositoryListError, Document | null>> {
    const documentsResult = await this.list();
    if (!documentsResult.isSuccess) return Result.fail(documentsResult.getError());
    return Result.ok(documentsResult.getValue().find(predicate) ?? null);
  }

  private async writeDocument(
    document: Document,
    operation: "create" | "update"
  ): Promise<
    Result<DocumentRepositoryError | DocumentAlreadyExistsError | DocumentNotFoundError, void>
  > {
    const path = this.idToGitHubPath(document.getPath(), document.getMetadata().index);
    try {
      const sha = await this.fetchFileSha(path);
      if (operation === "create" && sha) {
        return Result.fail(new DocumentAlreadyExistsError(document.getPath()));
      }
      if (operation === "update" && !sha) {
        return Result.fail(new DocumentNotFoundError(document.getPath()));
      }

      await updateFileContent({
        ...this.config,
        path,
        sha: operation === "update" ? sha ?? undefined : undefined,
        content: document.getRawFrontmatter() + document.getContent(),
        message: `${operation === "create" ? "Create" : "Update"} ${path}`,
      });

      operation === "create"
        ? this.clearCache()
        : this.updateCachedDocument(document);
      return Result.ok();
    } catch (error) {
      return Result.fail(
        new DocumentRepositoryError(
          `Failed to ${operation} document "${document.getPath()}" on GitHub`,
          { cause: error }
        )
      );
    }
  }

  private async fetchFileSha(path: string): Promise<string | null> {
    return fetchFileSha({ ...this.config, path });
  }

  private idToGitHubPath(id: string, isIndex: boolean): string {
    const base = this.config.path ? `${this.config.path}/` : "";
    if (id === "index") {
      return `${base}index.md`.replace(/^\/+/, "");
    }
    const filePath = isIndex ? `${base}${id}/index.md` : `${base}${id}.md`;
    return filePath.replace(/^\/+/, "");
  }

  private updateCachedDocument(document: Document): void {
    const cached = globalCache.get(this.cacheKey);
    if (!cached || cached.expiresAt <= Date.now()) {
      return;
    }

    const id = document.getPath();
    const cachedIndex = cached.documents.findIndex(
      (cachedDocument) => cachedDocument.getPath() === id
    );
    if (cachedIndex === -1) {
      return;
    }

    const sourceId = id;
    const documentResult = createDocumentFromRaw(
      sourceId,
      document.getRawFrontmatter() + document.getContent(),
      this.parser
    );
    if (!documentResult.isSuccess) {
      this.clearCache();
      return;
    }

    const documents = [...cached.documents];
    documents[cachedIndex] = documentResult.getValue();
    globalCache.set(this.cacheKey, { ...cached, documents });
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

    const tree = await fetchGitHubTree({
      ...this.config,
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

      const contentFiles = filterContentFiles(tree, this.config.path, this.config.pattern);
      const documents: Document[] = [];

      for (const file of contentFiles) {
        const raw = await fetchGitHubBlob({
          owner: this.config.owner,
          repo: this.config.repo,
          branch: this.config.branch,
          token: this.config.token,
          sha: file.sha,
        });

        const id = toDocumentId(file.path, {
          basePath: this.config.path,
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
