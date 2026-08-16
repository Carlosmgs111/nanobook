import type { CollectionEntry } from "astro:content";
import { getAstroEntries } from "../astro-cache";
import type { ContentRepository, Document, DocumentMetadata } from "../types";
import { stringify } from "yaml";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

const CONTENT_DIR = "./src/content";
const ALLOWED_ID_PATTERN = /^(?:[\p{L}\p{N}_-]+\/)*[\p{L}\p{N}_-]+$/u;

function idToFilePath(id: string): string {
  if (!ALLOWED_ID_PATTERN.test(id)) {
    throw new Error(`Id de documento inválido: ${id}`);
  }

  const filePath = resolve(join(CONTENT_DIR, `${id}.md`));
  const contentRoot = resolve(CONTENT_DIR);

  if (!filePath.startsWith(contentRoot + sep) && filePath !== contentRoot) {
    throw new Error(`Id de documento fuera del directorio de contenido: ${id}`);
  }

  return filePath;
}

function getParentId(id: string): string | null {
  if (id === "index") return null;
  const lastSlash = id.lastIndexOf("/");
  return lastSlash === -1 ? "index" : id.slice(0, lastSlash);
}

function toDocument(entry: CollectionEntry<"content">): Document {
  const data = entry.data as DocumentMetadata;

  return {
    id: entry.id,
    slug: entry.id === "index" ? "" : entry.id,
    parentId: getParentId(entry.id),
    position: data.position,
    title: data.title,
    description: data.description,
    content: entry.body ?? "",
    metadata: data,
    rawFrontmatter: `---\n${stringify(entry.data)}---\n\n`,
  };
}

let cachedDocuments: Document[] | null = null;

export class AstroCollectionRepository implements ContentRepository {
  async list(): Promise<Document[]> {
    if (cachedDocuments) return cachedDocuments;

    const entries = await getAstroEntries();

    cachedDocuments = Array.from(entries.values())
      .filter((entry) => !entry.data.draft)
      .map((entry) => toDocument(entry));

    return cachedDocuments;
  }

  async get(id: string): Promise<Document | null> {
    const entries = await this.list();
    return entries.find((entry) => entry.id === id) ?? null;
  }

  async listChildren(parentId: string | null): Promise<Document[]> {
    const entries = await this.list();
    return entries.filter((entry) => entry.parentId === parentId);
  }

  async save(document: Document): Promise<void> {
    const filePath = idToFilePath(document.id);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      document.rawFrontmatter + document.content,
      "utf-8"
    );
  }
}

export type { ContentRepository };
