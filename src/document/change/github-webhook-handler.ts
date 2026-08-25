import { createHmac } from "node:crypto";
import { generateId } from "../adapters/github-loader/parser";
import type { ContentRepository } from "../model/types";
import type { DocumentChange } from "../../navigation/model/types";
import type { RenderedPageCache } from "../../rendering/model/types";
import { invalidateCache } from "./invalidate-handler";

export interface GitHubWebhookOptions {
  /** Secreto compartido para verificar la firma del webhook. */
  secret: string;
  /** Rama que se espera en el payload (sin o con prefijo refs/heads/). */
  branch: string;
  /** Ruta base dentro del repo donde vive el contenido. */
  path?: string;
}

export interface GitHubPushPayload {
  ref: string;
  commits: Array<{
    added: string[];
    removed: string[];
    modified: string[];
  }>;
}

/**
 * Verifica la firma X-Hub-Signature-256 de GitHub.
 */
export function verifyGitHubWebhookSignature(
  secret: string,
  signature: string,
  body: string,
): boolean {
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  return signature === expected;
}

function mapGitHubPathsToChanges(
  paths: string[],
  basePath: string,
  kind: DocumentChange["kind"],
): DocumentChange[] {
  return paths
    .filter((path) => path.endsWith(".md"))
    .map((path) => {
      const id = generateId(path, basePath);
      return kind === "modified"
        ? { id, kind: "modified", scope: "content" }
        : { id, kind };
    });
}

/**
 * Procesa un payload de push de GitHub, calcula los documentos afectados e
 * invalida el cache.
 */
export async function handleGitHubPushWebhook(
  repository: ContentRepository,
  cache: RenderedPageCache,
  payload: GitHubPushPayload,
  options: GitHubWebhookOptions,
): Promise<{
  invalidatedIds: string[];
  addedIds: string[];
  removedIds: string[];
  message?: string;
}> {
  const branchName = options.branch.replace(/^refs\/heads\//, "");
  const expectedRef = `refs/heads/${branchName}`;

  if (payload.ref !== expectedRef) {
    return {
      invalidatedIds: [],
      addedIds: [],
      removedIds: [],
      message: `Ignored ref ${payload.ref}`,
    };
  }

  const basePath = options.path ?? "";
  const changes: DocumentChange[] = [];

  for (const commit of payload.commits) {
    changes.push(...mapGitHubPathsToChanges(commit.added, basePath, "added"));
    changes.push(
      ...mapGitHubPathsToChanges(commit.removed, basePath, "removed"),
    );
    changes.push(
      ...mapGitHubPathsToChanges(commit.modified, basePath, "modified"),
    );
  }

  if (changes.length === 0) {
    return {
      invalidatedIds: [],
      addedIds: [],
      removedIds: [],
      message: "No Markdown files changed",
    };
  }

  return invalidateCache(repository, cache, { changes });
}
