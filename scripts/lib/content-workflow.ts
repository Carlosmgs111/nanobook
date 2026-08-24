import { FileSystemRepository } from "../../src/document/adapters/repository/file-system-repository";
import { ContentChangeService } from "../../src/document/change/change-service";
import { hashDocument } from "../../src/document/change/snapshot";
import {
  loadSnapshot,
  saveSnapshot,
} from "../../src/document/change/snapshot";
import type { DocumentHash } from "../../src/document/model/types";
import { PageRenderer } from "../../src/rendering/page/page-renderer";
import { UnifiedMarkdownRenderer } from "../../src/rendering/adapters/markdown/unified-markdown";
import { FileSystemRenderedPageCache } from "../../src/rendering/adapters/cache/file-system-page-cache";

export interface WorkflowContext {
  repository: FileSystemRepository;
  changeService: ContentChangeService;
  cache: FileSystemRenderedPageCache;
  renderer: PageRenderer;
}

export function createWorkflowContext(): WorkflowContext {
  const repository = new FileSystemRepository();
  const changeService = new ContentChangeService(repository);
  const cache = new FileSystemRenderedPageCache();
  const renderer = new PageRenderer(repository, new UnifiedMarkdownRenderer());

  return { repository, changeService, cache, renderer };
}

export interface WorkflowResult {
  changes: import("../../src/navigation/model/types").DocumentChange[];
  invalidatedIds: string[];
  addedIds: string[];
  removedIds: string[];
  renderedIds: string[];
  currentHashes: DocumentHash[];
}

export async function detectWorkflowChanges(
  context: WorkflowContext,
): Promise<Pick<WorkflowResult, "changes" | "currentHashes">> {
  const previousHashes = await loadSnapshot();
  const documents = await context.repository.list();
  const currentHashes = documents.map(hashDocument);
  const changes = await context.changeService.detectChanges(previousHashes);

  return { changes, currentHashes };
}

export function printChanges(
  changes: import("../../src/navigation/model/types").DocumentChange[],
): void {
  if (changes.length === 0) {
    console.log("No content changes detected.");
    return;
  }

  console.log("Changes detected:");
  for (const change of changes) {
    const scope = change.scope ? ` (${change.scope})` : "";
    console.log(`  [${change.kind}] ${change.id}${scope}`);
  }
}

export function printInvalidation(result: {
  invalidatedIds: string[];
  addedIds: string[];
  removedIds: string[];
}): void {
  if (result.invalidatedIds.length === 0) return;

  console.log("\nInvalidated documents:");
  for (const id of result.invalidatedIds.sort()) {
    console.log(`  - ${id}`);
  }

  if (result.addedIds.length > 0) {
    console.log("\nAdded documents:");
    for (const id of result.addedIds.sort()) {
      console.log(`  - ${id}`);
    }
  }

  if (result.removedIds.length > 0) {
    console.log("\nRemoved documents:");
    for (const id of result.removedIds.sort()) {
      console.log(`  - ${id}`);
    }
  }
}

export async function renderInvalidatedPages(
  context: WorkflowContext,
  invalidatedIds: string[],
  removedIds: string[],
  currentHashes: DocumentHash[],
): Promise<string[]> {
  const renderedIds: string[] = [];

  console.log(`\nRendering ${invalidatedIds.length} invalidated page(s)...`);

  for (const pageId of invalidatedIds) {
    const document = await context.repository.get(pageId);
    if (!document) {
      console.log(`  - skipped (not found): ${pageId}`);
      continue;
    }

    const rendered = await context.renderer.render(pageId);
    if (!rendered) {
      console.log(`  - failed to render: ${pageId}`);
      continue;
    }

    const documentHash = currentHashes.find((hash) => hash.id === pageId);
    if (!documentHash) {
      console.log(`  - skipped (no hash): ${pageId}`);
      continue;
    }

    await context.cache.set(
      pageId,
      documentHash.contentHash,
      rendered.renderedBody,
    );
    renderedIds.push(pageId);
    console.log(`  - rendered: ${pageId}`);
  }

  if (removedIds.length > 0) {
    console.log(
      `\nInvalidating ${removedIds.length} removed page(s) from cache...`,
    );
    await context.cache.invalidate(removedIds);
  }

  return renderedIds;
}
