import { readFile } from "node:fs/promises";
import type { Document } from "../src/documents/server/domain/Document";
import { DrizzleContentRepository } from "../src/documents/server/infraestructure/repository/DrizzleContentRepository";
import { FileSystemRepository } from "../src/documents/server/infraestructure/repository/FileSystemRepository";
import { UnifiedDocumentParser } from "../src/documents/server/infraestructure/parse/DocumentParser";
import { DrizzleDocumentUnitOfWork } from "../src/documents/server/infraestructure/database/DrizzleDocumentUnitOfWork";
import { DrizzleNanobookRepository, Nanobook } from "../src/nanobooks/server";
import { db } from "../src/shared/infrastructure/database/drizzleDatabase";
import {
  assignDocuments,
  buildMigratedDocument,
  buildMigrationReport,
  type MigrationManifest,
} from "../src/documents/server/infraestructure/migration/ContentMigration";

const args = process.argv.slice(2);
const manifestPath = valueAfter("--manifest");
const apply = args.includes("--apply");

if (!manifestPath) {
  throw new Error("Uso: npm run content:import-sql -- --manifest migration.json [--dry-run|--apply]");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as MigrationManifest;
if (manifest.source.type !== "filesystem") {
  throw new Error("La importación SQL inicial requiere source.type=filesystem; congela primero el snapshot remoto.");
}

const parser = new UnifiedDocumentParser();
const source = new FileSystemRepository(manifest.source.root ?? "./src/content", parser);
const sourceResult = await source.list();
if (!sourceResult.isSuccess) throw sourceResult.getError();
const sourceDocuments = sourceResult.getValue();
const input = sourceDocuments.map((document) => ({
  id: document.getDocumentId().getValue(),
  path: document.getPublicPath() === "index" ? "index" : document.getPath(),
  nanobook: document.getMetadata().nanobook,
}));
const assignments = assignDocuments(manifest, input);
const report = buildMigrationReport(manifest, input);

if (!apply) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const nanobookRepository = new DrizzleNanobookRepository(db);
for (const destination of manifest.destinations) {
  const existing = await nanobookRepository.findById(destination.nanobookId);
  if (!existing.isSuccess) throw existing.getError();
  const nanobookResult = existing.getValue()
    ? null
    : Nanobook.create({
      id: destination.nanobookId,
      ownerId: destination.ownerId,
      slug: destination.slug,
      name: destination.slug,
      visibility: destination.visibility,
      settings: destination.settings,
    });
  if (nanobookResult && !nanobookResult.isSuccess) throw nanobookResult.getError();

  const repository = new DrizzleContentRepository(db, destination.nanobookId, parser);
  const unitOfWork = new DrizzleDocumentUnitOfWork(db, destination.nanobookId);
  const destinationAssignments = assignments.filter((item) => item.destination === destination.nanobookId);
  const existingDocuments = await repository.list();
  if (!existingDocuments.isSuccess) throw existingDocuments.getError();
  const existingById = new Map(existingDocuments.getValue().map((item) => [item.getDocumentId().getValue(), item]));
  const pending: Array<{ assignment: (typeof destinationAssignments)[number]; document: Document }> = [];

  for (const assignment of destinationAssignments) {
    const sourceDocument = sourceDocuments.find((document) => document.getDocumentId().getValue() === assignment.id);
    if (!sourceDocument) throw new Error(`Documento no encontrado en el snapshot: ${assignment.id}`);
    const documentResult = buildMigratedDocument(sourceDocument, assignment, parser);
    if (!documentResult.isSuccess) throw documentResult.getError();
    const migrated = documentResult.getValue();
    const existingDocument = existingById.get(assignment.id);
    if (existingDocument) {
      const [expectedHash, actualHash] = await Promise.all([
        migrated.hashDocument(),
        existingDocument.hashDocument(),
      ]);
      if (existingDocument.getPath() !== migrated.getPath() || expectedHash.version !== actualHash.version) {
        throw new Error(`El documento ${assignment.id} ya existe y no coincide con la migración esperada`);
      }
      continue;
    }
    pending.push({ assignment, document: migrated });
  }

  await unitOfWork.run(async ({ insertNanobook, insertDocument, appendRevision, enqueueEvent, incrementContentVersion }) => {
    if (nanobookResult) await insertNanobook(nanobookResult.getValue());
    for (const { assignment, document: migrated } of pending) {
      await insertDocument(migrated);
      await appendRevision({
        documentId: assignment.id,
        revision: 1,
        snapshot: migrated.parse(),
        actorId: destination.ownerId,
        operation: "import",
      });
      await incrementContentVersion();
      await enqueueEvent("document.imported", { documentId: assignment.id });
    }
  });
}

console.log(JSON.stringify({ ...report, applied: true }, null, 2));

function valueAfter(flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}
