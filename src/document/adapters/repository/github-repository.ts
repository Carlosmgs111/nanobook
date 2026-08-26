import { fetchFileContent, fetchGitHubTree } from "../github-loader/api";
import { createParsedEntry } from "../github-loader/parser";
import { filterContentFiles } from "../github-loader";
import type { ContentRepository, Document } from "../../model/types";
import { buildDocument } from "./document-builder";
import { resolveProxies } from "../../parse/proxy";
import { withRedisClient } from "../../../shared/utils/redis";

import type { GitHubLoaderOptions } from "../github-loader/types";
import type { GitHubTreeItem } from "../github-loader/types";

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
  return `${options.owner}:${options.repo}:${options.branch ?? "main"}:${options.path ?? ""}:${pattern}`;
}

function buildTreeCacheKey(options: GitHubRepositoryOptions): string {
  return `nanobook:github:tree:${buildCacheKey(options)}`;
}

/**
 * Repositorio de contenido que lee Markdown desde un repositorio de GitHub.
 *
 * Útil cuando el contenido vive en un repo separado y se actualiza sin
 * redeploy. No implementa save() porque el proyecto no escribe de vuelta a
 * GitHub.
 *
 * Cachea la lista de documentos en memoria compartida y el tree de GitHub en
 * Redis durante un TTL configurable para minimizar las llamadas a la API de
 * GitHub. El cache se invalida automáticamente al expirar el TTL.
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

  constructor(private options: GitHubRepositoryOptions) {
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

    const documents = await this.fetchDocuments();
    globalCache.set(this.cacheKey, {
      documents,
      expiresAt: now + this.cacheTtl,
    });
    return documents;
  }

  private async fetchTree(): Promise<GitHubTreeItem[]> {
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
      await client.set(
        this.treeCacheKey,
        JSON.stringify(tree),
        { PX: this.treeCacheTtl },
      );
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
        documents.push(buildDocument(id, data, body, raw));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Failed to load GitHub file ${file.path}: ${message}`);
      }
    }

    return resolveProxies(documents);
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

  /** Invalida el cache de documentos de esta instancia. */
  clearCache(): void {
    globalCache.delete(this.cacheKey);
  }

  /** Invalida todo el cache global de GitHubRepository. */
  static clearAllCache(): void {
    globalCache.clear();
  }
}
