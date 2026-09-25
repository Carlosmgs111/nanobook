import { randomUUID } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const ID_PATTERN = /^id:\s*(?:"([^"]+)"|'([^']+)'|([^\s#]+))\s*$/m;
const LEGACY_ID_PREFIX = "legacy:";

export interface IdentityMigrationResult {
  content: string;
  id: string;
  changed: boolean;
}

export function ensureDocumentIdentity(
  content: string,
  idFactory: () => string = randomUUID
): IdentityMigrationResult {
  const match = content.match(FRONTMATTER_PATTERN);
  if (!match) {
    throw new Error("Document does not contain YAML frontmatter");
  }

  const existing = match[1].match(ID_PATTERN);
  if (existing) {
    const id = existing[1] ?? existing[2] ?? existing[3];
    if (!id) throw new Error("Document contains an empty id");
    if (id.startsWith(LEGACY_ID_PREFIX)) {
      const migratedId = idFactory();
      const idLine = match[0].match(/^id:.*$/m)?.[0];
      if (!idLine) throw new Error("Document contains an invalid id field");
      const updatedFrontmatter = match[0].replace(
        idLine,
        `id: "${migratedId}"`
      );
      return {
        content: `${updatedFrontmatter}${content.slice(match[0].length)}`,
        id: migratedId,
        changed: true,
      };
    }
    return { content, id, changed: false };
  }

  const id = idFactory();
  const newline = match[0].includes("\r\n") ? "\r\n" : "\n";
  const opening = `---${newline}`;
  const updatedFrontmatter = `${opening}id: "${id}"${newline}${match[0].slice(opening.length)}`;

  return {
    content: `${updatedFrontmatter}${content.slice(match[0].length)}`,
    id,
    changed: true,
  };
}

async function findMarkdownFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) await visit(fullPath);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(fullPath);
    }
  }

  await visit(root);
  return files.sort();
}

export async function migrateDocumentIdentities(
  contentDir: string,
  options: { checkOnly?: boolean } = {}
): Promise<{ scanned: number; changed: number }> {
  const root = resolve(contentDir);
  const files = await findMarkdownFiles(root);
  const prepared = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      result: ensureDocumentIdentity(await readFile(filePath, "utf8")),
    }))
  );

  const byId = new Map<string, string>();
  for (const { filePath, result } of prepared) {
    const previous = byId.get(result.id);
    if (previous) {
      throw new Error(
        `Duplicate document id "${result.id}" in ${relative(root, previous)} and ${relative(root, filePath)}`
      );
    }
    byId.set(result.id, filePath);
  }

  if (!options.checkOnly) {
    await Promise.all(
      prepared
        .filter(({ result }) => result.changed)
        .map(({ filePath, result }) => writeFile(filePath, result.content, "utf8"))
    );
  }

  return {
    scanned: files.length,
    changed: prepared.filter(({ result }) => result.changed).length,
  };
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes("--check");
  const contentDirIndex = process.argv.indexOf("--content-dir");
  const contentDir = contentDirIndex >= 0
    ? process.argv[contentDirIndex + 1] || "./src/content"
    : "./src/content";
  const result = await migrateDocumentIdentities(contentDir, { checkOnly });
  const action = checkOnly ? "would migrate" : "migrated";
  console.log(`Scanned ${result.scanned} documents; ${action} ${result.changed}.`);
}

if (process.argv[1]?.endsWith("migrate-document-identities.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
