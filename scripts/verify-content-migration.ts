import { readFile } from "node:fs/promises";
import { FileSystemRepository } from "../src/documents/server/infraestructure/repository/FileSystemRepository";
import { UnifiedDocumentParser } from "../src/documents/server/infraestructure/parse/DocumentParser";
import {
  assignDocuments,
  buildMigrationReport,
  type MigrationManifest,
} from "../src/documents/server/infraestructure/migration/ContentMigration";
import { DrizzleContentRepository } from "../src/documents/server/infraestructure/repository/DrizzleContentRepository";
import { UnifiedDocumentParser } from "../src/documents/server/infraestructure/parse/DocumentParser";
import { db } from "../src/shared/infrastructure/database/drizzleDatabase";

const manifestPath = process.argv[process.argv.indexOf("--manifest") + 1];
if (!manifestPath) throw new Error("Uso: npm run content:verify-sql -- --manifest migration.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as MigrationManifest;
const source = new FileSystemRepository(manifest.source.root ?? "./src/content", new UnifiedDocumentParser());
const result = await source.list();
if (!result.isSuccess) throw result.getError();
const documents = result.getValue().map((document) => ({
  id: document.getDocumentId().getValue(),
  path: document.getPath(),
  nanobook: document.getMetadata().nanobook,
}));
const report = buildMigrationReport(manifest, documents);
const assignments = assignDocuments(manifest, documents);
const mismatches: Array<{ id: string; nanobookId: string; reason: string }> = [];
for (const destination of manifest.destinations) {
  const repository = new DrizzleContentRepository(db, destination.nanobookId, new UnifiedDocumentParser());
  const destinationResult = await repository.list();
  if (!destinationResult.isSuccess) throw destinationResult.getError();
  const byId = new Map(destinationResult.getValue().map((document) => [document.getDocumentId().getValue(), document]));
  for (const assignment of assignments.filter((item) => item.destination === destination.nanobookId)) {
    const migrated = byId.get(assignment.id);
    if (!migrated) {
      mismatches.push({ id: assignment.id, nanobookId: destination.nanobookId, reason: "missing" });
      continue;
    }
    if (migrated.getPath() !== assignment.targetPath) {
      mismatches.push({ id: assignment.id, nanobookId: destination.nanobookId, reason: "path" });
    }
  }
}
console.log(JSON.stringify({ verified: mismatches.length === 0, mismatches, report }, null, 2));
if (mismatches.length > 0) process.exitCode = 1;
