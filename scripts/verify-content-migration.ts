import { readFile } from "node:fs/promises";
import { FileSystemRepository } from "../src/documents/server/infraestructure/repository/FileSystemRepository";
import { UnifiedDocumentParser } from "../src/documents/server/infraestructure/parse/DocumentParser";
import {
  assignDocuments,
  buildMigratedDocument,
  buildMigrationReport,
  type MigrationManifest,
} from "../src/documents/server/infraestructure/migration/ContentMigration";
import { DrizzleContentRepository } from "../src/documents/server/infraestructure/repository/DrizzleContentRepository";
import { DrizzleNanobookAliasRepository } from "../src/nanobooks/server";
import { db } from "../src/shared/infrastructure/database/drizzleDatabase";

const manifestIndex = process.argv.indexOf("--manifest");
const manifestPath = manifestIndex >= 0 ? process.argv[manifestIndex + 1] : undefined;
if (!manifestPath) throw new Error("Uso: npm run content:verify-sql -- --manifest migration.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as MigrationManifest;
const source = new FileSystemRepository(manifest.source.root ?? "./src/content", new UnifiedDocumentParser());
const result = await source.list();
if (!result.isSuccess) throw result.getError();
const parser = new UnifiedDocumentParser();
const sourceDocuments = result.getValue();
const documents = sourceDocuments.map((document) => ({
  id: document.getDocumentId().getValue(),
  path: document.getPath(),
  nanobook: document.getMetadata().nanobook,
}));
const report = buildMigrationReport(manifest, documents);
const assignments = assignDocuments(manifest, documents);
const mismatches: Array<{ id: string; nanobookId: string; reason: string }> = [];
const aliasRepository = new DrizzleNanobookAliasRepository(db);
for (const destination of manifest.destinations) {
  const repository = new DrizzleContentRepository(db, destination.nanobookId, new UnifiedDocumentParser());
  const destinationResult = await repository.list();
  if (!destinationResult.isSuccess) throw destinationResult.getError();
  const destinationDocuments = destinationResult.getValue();
  const byId = new Map(destinationDocuments.map((document) => [document.getDocumentId().getValue(), document]));
  const destinationAssignments = assignments.filter((item) => item.destination === destination.nanobookId);
  const expectedIds = new Set(destinationAssignments.map((item) => item.id));
  for (const assignment of destinationAssignments) {
    const migrated = byId.get(assignment.id);
    if (!migrated) {
      mismatches.push({ id: assignment.id, nanobookId: destination.nanobookId, reason: "missing" });
      continue;
    }
    if (migrated.getPath() !== assignment.targetPath) {
      mismatches.push({ id: assignment.id, nanobookId: destination.nanobookId, reason: "path" });
      continue;
    }
    const sourceDocument = sourceDocuments.find((document) => document.getDocumentId().getValue() === assignment.id);
    if (!sourceDocument) {
      mismatches.push({ id: assignment.id, nanobookId: destination.nanobookId, reason: "source-missing" });
      continue;
    }
    const expectedResult = buildMigratedDocument(sourceDocument, assignment, parser);
    if (!expectedResult.isSuccess) {
      mismatches.push({ id: assignment.id, nanobookId: destination.nanobookId, reason: "source-invalid" });
      continue;
    }
    const [expectedHash, actualHash] = await Promise.all([
      expectedResult.getValue().hashDocument(),
      migrated.hashDocument(),
    ]);
    if (expectedHash.version !== actualHash.version || expectedHash.contentHash !== actualHash.contentHash) {
      mismatches.push({ id: assignment.id, nanobookId: destination.nanobookId, reason: "hash" });
    }
    const alias = await aliasRepository.findByLegacyPath(sourceDocument.getPublicPath());
    if (!alias.isSuccess) throw alias.getError();
    const aliasValue = alias.getValue();
    if (!aliasValue) {
      mismatches.push({ id: assignment.id, nanobookId: destination.nanobookId, reason: "alias-missing" });
    } else if (
      aliasValue.nanobookId !== destination.nanobookId
      || aliasValue.targetPath !== migrated.getPublicPath()
    ) {
      mismatches.push({ id: assignment.id, nanobookId: destination.nanobookId, reason: "alias" });
    }
  }
  for (const migrated of destinationDocuments) {
    if (!expectedIds.has(migrated.getDocumentId().getValue())) {
      mismatches.push({
        id: migrated.getDocumentId().getValue(),
        nanobookId: destination.nanobookId,
        reason: "unexpected",
      });
    }
  }
}
console.log(JSON.stringify({ verified: mismatches.length === 0, mismatches, report }, null, 2));
if (mismatches.length > 0) process.exitCode = 1;
