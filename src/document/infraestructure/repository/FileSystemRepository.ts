import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { FrontmatterParser } from "../parse/FrontmatterParser";
import { idToFilePath, filePathToId } from "./fileSystemParsePath";
import type { ContentRepository } from "../../domain/types";
import {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
} from "../../domain/errors";

import { Document } from "../../domain/Document";
import type { DocumentId } from "../../domain/DocumentId";
import type { DocumentParser } from "../../domain/DocumentParser";

const CONTENT_DIR = "./src/content";


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

/**
 * Repositorio de contenido que lee directamente desde `src/content/`
 * sin depender de Astro.
 *
 * Util para scripts standalone, tests sin build y futuro renderizador
 * incremental.
 */
export class FileSystemRepository implements ContentRepository {
  constructor(
    private contentDir: string = CONTENT_DIR,
    private parser: DocumentParser
  ) {}

  async list(): Promise<Document[]> {
    const contentRoot = resolve(this.contentDir);
    const files = await scanMarkdownFiles(contentRoot);
    const documents: Document[] = [];

    for (const file of files) {
      const raw = await readFile(file, "utf-8");
      const { data, body } = FrontmatterParser.parseFrontmatter(raw);
      const id = filePathToId(file, contentRoot);
      documents.push(await Document.create(id, data, body, this.parser));
    }

    return documents;
  }

  async get(id: DocumentId): Promise<Document | null> {
    const documents = await this.list();
    return (
      documents.find(
        (document) => document.getId().getValue() === id.getValue()
      ) ?? null
    );
  }

  async getBySlug(id: string): Promise<Document | null> {
    const documents = await this.list();
    return (
      documents.find((document) => document.getId().getValue() === id) ?? null
    );
  }

  async listChildren(parentId: string | null): Promise<Document[]> {
    const documents = await this.list();
    return documents.filter(
      (document) => document.getId().getParentId() === parentId
    );
  }

  async create(document: Document): Promise<void> {
    const filePath = idToFilePath(
      document.getId().getValue(),
      document.getMetadata().index,
      this.contentDir
    );
    if (await fileExists(filePath)) {
      throw new DocumentAlreadyExistsError(document.getId());
    }
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      document.getRawFrontmatter() + document.getContent(),
      "utf-8"
    );
  }

  async update(document: Document): Promise<void> {
    const filePath = idToFilePath(
      document.getId().getValue(),
      document.getMetadata().index,
      this.contentDir
    );
    if (!(await fileExists(filePath))) {
      throw new DocumentNotFoundError(document.getId());
    }
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      document.getRawFrontmatter() + document.getContent(),
      "utf-8"
    );
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
