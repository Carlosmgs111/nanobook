import { readFile } from "node:fs/promises";
import { FileSystemRepository } from "../src/documents/server/infraestructure/repository/FileSystemRepository";
import { UnifiedDocumentParser } from "../src/documents/server/infraestructure/parse/DocumentParser";
import {
  buildMigrationReport,
  type MigrationManifest,
} from "../src/documents/server/infraestructure/migration/ContentMigration";

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
console.log(JSON.stringify({ verified: true, report: buildMigrationReport(manifest, documents) }, null, 2));
