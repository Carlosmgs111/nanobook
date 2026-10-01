import { createHmac } from "node:crypto";
import type { RenderedPageCache } from "../domain/cache";
import type {
  DocumentChange,
  InvalidationResult,
} from "../../navigation/domain/types";
import { toDocumentId } from "../../shared/utils/documentPath";
import type { NavigationService } from "../../navigation";
import { DocumentPath } from "../../documents/domain/DocumentPath";
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
  kind: DocumentChange["kind"],
  navigationService: NavigationService
): DocumentChange[] {
  return paths
    .filter((path) => path.endsWith(".md"))
    .flatMap((path) => {
      const publicPath = toDocumentId(path, { basePath, lowercase: true });
      const documentId = navigationService.getDocumentIdByPath(publicPath);

      if (documentId) {
        return kind === "modified"
          ? [{ id: documentId, kind: "modified", scope: "content" as const }]
          : [{ id: documentId, kind }];
      }

      // A newly added file is not in the graph yet, so it has no resolvable
      // identity here. Invalidate its known parent instead of leaking the
      // public path into DocumentChange.id.
      if (kind === "added") {
        const pathResult = DocumentPath.create(publicPath);
        const parentPath = pathResult.isSuccess
          ? pathResult.getValue().getParentPath()?.getPublicValue() ?? "index"
          : null;
        const parentId = parentPath
          ? navigationService.getDocumentIdByPath(parentPath)
          : undefined;
        if (parentId) {
          return [{ id: parentId, kind: "modified", scope: "metadata" as const }];
        }
      }

      return [];
    });
}

export class GitHubWebhookHandler {
  constructor(
    private renderedPageCache: RenderedPageCache,
    private navigationService: NavigationService,
    private refreshNavigation: () => Promise<void> = async () => {}
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
      changes.push(
        ...mapGitHubPathsToChanges(
          commit.added,
          basePath,
          "added",
          this.navigationService
        )
      );
      changes.push(
        ...mapGitHubPathsToChanges(
          commit.removed,
          basePath,
          "removed",
          this.navigationService
        )
      );
      changes.push(
        ...mapGitHubPathsToChanges(
          commit.modified,
          basePath,
          "modified",
          this.navigationService
        )
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
     await this.refreshNavigation();
     const invalidateResult = await this.renderedPageCache.invalidate(
       result.invalidatedIds
     );
     if (!invalidateResult.isSuccess) {
       throw invalidateResult.getError();
     }
    return result;
  }
}
