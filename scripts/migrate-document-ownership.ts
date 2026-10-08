import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const FRONTMATTER_PATTERN = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const OWNER_LINE_PATTERN = /^ownerId:\s*[^\r\n]*(?=\r?$)/m;
const ID_LINE_PATTERN = /^id:\s*[^\r\n]*(?:\r?\n|$)/m;

export interface DocumentOwnershipMigrationResult {
  content: string;
  changed: boolean;
}

export function assignDocumentOwner(
  content: string,
  ownerId: string,
): DocumentOwnershipMigrationResult {
  if (!ownerId.trim()) throw new Error("ownerId is required");

  const frontmatter = content.match(FRONTMATTER_PATTERN)?.[0];
  if (!frontmatter) {
    throw new Error("Document does not contain YAML frontmatter");
  }

  const ownerLine = `ownerId: "${ownerId}"`;
  const existingOwner = frontmatter.match(OWNER_LINE_PATTERN)?.[0];
  if (existingOwner === ownerLine) return { content, changed: false };

  const updatedFrontmatter = existingOwner
    ? frontmatter.replace(OWNER_LINE_PATTERN, ownerLine)
    : insertOwnerAfterDocumentId(frontmatter, ownerLine);

  return {
    content: `${updatedFrontmatter}${content.slice(frontmatter.length)}`,
    changed: true,
  };
}

function insertOwnerAfterDocumentId(
  frontmatter: string,
  ownerLine: string,
): string {
  const idLine = frontmatter.match(ID_LINE_PATTERN)?.[0];
  if (!idLine) throw new Error("Document does not contain an id");

  const newline = frontmatter.includes("\r\n") ? "\r\n" : "\n";
  return frontmatter.replace(ID_LINE_PATTERN, `${idLine}${ownerLine}${newline}`);
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

export async function migrateDocumentOwnership(
  contentDir: string,
  ownerId: string,
  options: { checkOnly?: boolean } = {},
): Promise<{ scanned: number; changed: number }> {
  const files = await findMarkdownFiles(resolve(contentDir));
  const prepared = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      result: assignDocumentOwner(await readFile(filePath, "utf8"), ownerId),
    })),
  );

  if (!options.checkOnly) {
    await Promise.all(
      prepared
        .filter(({ result }) => result.changed)
        .map(({ filePath, result }) => writeFile(filePath, result.content, "utf8")),
    );
  }

  return {
    scanned: files.length,
    changed: prepared.filter(({ result }) => result.changed).length,
  };
}

async function main(): Promise<void> {
  const ownerIdIndex = process.argv.indexOf("--owner-id");
  const ownerId = ownerIdIndex >= 0 ? process.argv[ownerIdIndex + 1] : undefined;
  if (!ownerId) throw new Error("Use --owner-id <Better Auth user id>");

  const checkOnly = process.argv.includes("--check");
  const contentDirIndex = process.argv.indexOf("--content-dir");
  const contentDir = contentDirIndex >= 0
    ? process.argv[contentDirIndex + 1] || "./src/content"
    : "./src/content";
  const result = await migrateDocumentOwnership(contentDir, ownerId, { checkOnly });
  const action = checkOnly ? "would assign" : "assigned";
  console.log(`Scanned ${result.scanned} documents; ${action} ${result.changed}.`);
}

if (process.argv[1]?.endsWith("migrate-document-ownership.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
