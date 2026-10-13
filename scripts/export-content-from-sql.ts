import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DrizzleContentRepository } from "../src/documents/server/infraestructure/repository/DrizzleContentRepository";
import { UnifiedDocumentParser } from "../src/documents/server/infraestructure/parse/DocumentParser";
import { db } from "../src/shared/infrastructure/database/drizzleDatabase";

const nanobookId = valueAfter("--nanobook-id");
const output = valueAfter("--out") ?? "./exported-content";
if (!nanobookId) throw new Error("Uso: npm run content:export-sql -- --nanobook-id <id> [--out <directorio>]");

const repository = new DrizzleContentRepository(db, nanobookId, new UnifiedDocumentParser());
const result = await repository.list();
if (!result.isSuccess) throw result.getError();

for (const document of result.getValue()) {
  const filePath = join(output, `${document.getPath()}.md`);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${document.getRawFrontmatter()}${document.getContent()}`, "utf8");
}

console.log(JSON.stringify({ exported: result.getValue().length, nanobookId, output }, null, 2));

function valueAfter(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}
