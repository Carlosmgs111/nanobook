import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { stringify } from "yaml";
import { parseFrontmatter } from "../../parse/frontmatter";
import { getParentId, idToFilePath } from "../../parse/path";
import type { ContentRepository, Document, DocumentMetadata } from "../../model/types";

const CONTENT_DIR = "./src/content";

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function extractFrontmatter(raw: string): string {
  const match = raw.match(FRONTMATTER_REGEX);
  return match ? `---\n${match[1]}---\n\n` : "";
}

function filePathToId(filePath: string, contentDir: string): string {
  const relativePath = relative(contentDir, filePath).replace(/\\/g, "/");
  const withoutExt = relativePath.replace(/\.md$/, "");

  if (withoutExt.endsWith("/index")) {
    return (withoutExt.slice(0, -"/index".length) || "index").toLowerCase();
  }

  return withoutExt.toLowerCase();
}

async function scanMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

function assertRequiredField<T>(
  value: T | undefined,
  field: string,
  documentId: string,
): T {
  if (value === undefined || value === null) {
    throw new Error(
      `Missing required field "${field}" in document "${documentId}"`,
    );
  }
  return value;
}

function toDocumentMetadata(
  data: Record<string, unknown>,
  documentId: string,
): DocumentMetadata {
  return {
    title: assertRequiredField(data.title as string, "title", documentId),
    description: assertRequiredField(
      data.description as string,
      "description",
      documentId,
    ),
    date: assertRequiredField(data.date as Date, "date", documentId),
    author: assertRequiredField(data.author as string, "author", documentId),
    tags: (data.tags as string[]) ?? [],
    cover: data.cover as string | undefined,
    draft: (data.draft as boolean) ?? false,
    index: (data.index as boolean) ?? false,
    position: (data.position as number) ?? 0,
    ref: data.ref as DocumentMetadata["ref"],
  };
}

/**
 * Repositorio de contenido que lee directamente desde `src/content/`
 * sin depender de Astro.
 *
 * Util para scripts standalone, tests sin build y futuro renderizador
 * incremental.
 */
export class FileSystemRepository implements ContentRepository {
  constructor(private contentDir: string = CONTENT_DIR) {}

  async list(): Promise<Document[]> {
    const contentRoot = join(process.cwd(), this.contentDir);
    const files = await scanMarkdownFiles(contentRoot);
    const documents: Document[] = [];

    for (const file of files) {
      const raw = await readFile(file, "utf-8");
      const { data, body } = parseFrontmatter(raw);
      const id = filePathToId(file, contentRoot);
      const metadata = toDocumentMetadata(data, id);

      documents.push({
        id,
        slug: id === "index" ? "" : id,
        parentId: getParentId(id),
        position: metadata.position,
        title: metadata.title,
        description: metadata.description,
        content: body,
        metadata,
        rawFrontmatter: extractFrontmatter(raw),
      });
    }

    return documents;
  }

  async get(id: string): Promise<Document | null> {
    const documents = await this.list();
    return documents.find((document) => document.id === id) ?? null;
  }

  async listChildren(parentId: string | null): Promise<Document[]> {
    const documents = await this.list();
    return documents.filter((document) => document.parentId === parentId);
  }

  async save(document: Document): Promise<void> {
    const filePath = idToFilePath(document.id, this.contentDir);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      document.rawFrontmatter + document.content,
      "utf-8",
    );
  }
}
