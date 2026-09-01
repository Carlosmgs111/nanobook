import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DocumentHash } from "../_domain/types";
import { hashDocument } from "../_domain/hash";
import type { DocumentChange } from "../../navigation/domain/types";

export { hashDocument };

function buildHashMap(hashes: DocumentHash[]): Map<string, DocumentHash> {
  return new Map(hashes.map((hash) => [hash.id, hash]));
}

function determineScope(
  previous: DocumentHash,
  current: DocumentHash,
): DocumentChange["scope"] {
  const contentChanged = previous.contentHash !== current.contentHash;
  const metadataChanged = previous.metadataHash !== current.metadataHash;

  if (contentChanged && metadataChanged) return "all";
  if (metadataChanged) return "metadata";
  if (contentChanged) return "content";
  return undefined;
}

/**
 * Compara dos snapshots de documentos y produce un `ChangeSet`.
 *
 * Nota: los renombramientos no se detectan automaticamente; un documento
 * renombrado se reporta como `removed(previousId)` + `added(newId)`.
 */
export function computeDocumentChanges(
  previousHashes: DocumentHash[],
  currentHashes: DocumentHash[],
): DocumentChange[] {
  const previousMap = buildHashMap(previousHashes);
  const currentMap = buildHashMap(currentHashes);
  const changes: DocumentChange[] = [];

  for (const current of currentHashes) {
    const previous = previousMap.get(current.id);

    if (!previous) {
      changes.push({ id: current.id, kind: "added" });
      continue;
    }

    const scope = determineScope(previous, current);
    if (scope) {
      changes.push({ id: current.id, kind: "modified", scope });
    }
  }

  for (const previous of previousHashes) {
    if (!currentMap.has(previous.id)) {
      changes.push({ id: previous.id, kind: "removed" });
    }
  }

  return changes;
}

const DEFAULT_SNAPSHOT_PATH = join(
  process.cwd(),
  ".nanobook",
  "content-snapshot.json",
);

export interface SnapshotPersistenceOptions {
  path?: string;
}

export async function loadSnapshot(
  options: SnapshotPersistenceOptions = {},
): Promise<DocumentHash[]> {
  const snapshotPath = options.path ?? DEFAULT_SNAPSHOT_PATH;
  if (!existsSync(snapshotPath)) return [];
  const raw = await readFile(snapshotPath, "utf-8");
  return JSON.parse(raw) as DocumentHash[];
}

export async function saveSnapshot(
  hashes: DocumentHash[],
  options: SnapshotPersistenceOptions = {},
): Promise<void> {
  const snapshotPath = options.path ?? DEFAULT_SNAPSHOT_PATH;
  await mkdir(dirname(snapshotPath), { recursive: true });
  await writeFile(snapshotPath, JSON.stringify(hashes, null, 2), "utf-8");
}
