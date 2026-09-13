import { createHmac } from "node:crypto";
import type { RenderedPageCache } from "../domain/cache";
import type {
  DocumentChange,
  InvalidationResult,
} from "../../navigation/domain/types";
import { toDocumentId } from "../../shared/utils/documentPath";
import type { NavigationService } from "../../navigation";
import {
  GITHUB_WEBHOOK_SECRET,
  GITHUB_BRANCH,
  GITHUB_PATH,
} from "astro:env/server";

interface GitHubPushPayload {
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
function verifyGitHubWebhookSignature(
  secret: string,
  signature: string,
  body: string
): boolean {
  const expected = `sha256=${createHmac("sha256", secret)
    .update(body)
    .digest("hex")}`;
  return signature === expected;
}

function mapGitHubPathsToChanges(
  paths: string[],
  basePath: string,
  kind: DocumentChange["kind"]
): DocumentChange[] {
  return paths
    .filter((path) => path.endsWith(".md"))
    .map((path) => {
      const id = toDocumentId(path, { basePath, lowercase: true });
      return kind === "modified"
        ? { id, kind: "modified", scope: "content" }
        : { id, kind };
    });
}

export class GitHubWebhookHandler {
  constructor(
    private renderedPageCache: RenderedPageCache,
    private navigationService: NavigationService
  ) {}
  async handle({
    headers,
    body,
  }: {
    headers: Headers;
    body: string;
  }): Promise<InvalidationResult> {
    const secret = GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error("GITHUB_WEBHOOK_SECRET not configured");
    }

    const signature = headers.get("X-Hub-Signature-256") ?? "";

    if (!verifyGitHubWebhookSignature(secret, signature, body)) {
      throw new Error("Invalid signature");
    }

    let payload: GitHubPushPayload;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new Error("Invalid JSON");
    }

    const branchName = (GITHUB_BRANCH ?? "main").replace(/^refs\/heads\//, "");
    const expectedRef = `refs/heads/${branchName}`;
    if (payload.ref !== expectedRef) {
      return {
        invalidatedIds: [],
        addedIds: [],
        removedIds: [],
      };
    }
    const basePath = GITHUB_PATH ?? "";
    const changes: DocumentChange[] = [];

    for (const commit of payload.commits) {
      changes.push(...mapGitHubPathsToChanges(commit.added, basePath, "added"));
      changes.push(
        ...mapGitHubPathsToChanges(commit.removed, basePath, "removed")
      );
      changes.push(
        ...mapGitHubPathsToChanges(commit.modified, basePath, "modified")
      );
    }
    if (changes.length === 0) {
      return {
        invalidatedIds: [],
        addedIds: [],
        removedIds: [],
      };
    }
     const result = await this.navigationService.getInvalidatedIds(changes);
     const invalidateResult = await this.renderedPageCache.invalidate(
       result.invalidatedIds
     );
     if (!invalidateResult.isSuccess) {
       throw invalidateResult.getError();
     }
    return result;
  }
}
