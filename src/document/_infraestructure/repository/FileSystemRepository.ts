import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { parseFrontmatter } from "../../_index";
import { parsePath } from "../../_index";
import type { ContentRepository, Document } from "../../_domain/types";
import {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
} from "../../_domain/errors";
import { buildDocument } from "../../shared/utils/document-builder";

const CONTENT_DIR = "./src/content";

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
    private parseProxies: (
      documents: import("../../_domain/Document").Document[]
    ) => Promise<import("../../_domain/Document").Document[]>
  ) {}

  async list(): Promise<import("../../_domain/Document").Document[]> {
    const contentRoot = resolve(this.contentDir);
    const files = await scanMarkdownFiles(contentRoot);
    const documents: import("../../_domain/Document").Document[] = [];

    for (const file of files) {
      const raw = await readFile(file, "utf-8");
      const { data, body } = parseFrontmatter(raw);
      const id = filePathToId(file, contentRoot);

      documents.push(
        (await import("../../_domain/Document")).Document.create(id, data, body)
      );
    }

    return this.parseProxies(documents);
  }

  async get(
    id: string
  ): Promise<import("../../_domain/Document").Document | null> {
    const documents = await this.list();
    return (
      documents.find((document) => document.getId().getValue() === id) ?? null
    );
  }

  async listChildren(
    parentId: string | null
  ): Promise<import("../../_domain/Document").Document[]> {
    const documents = await this.list();
    return documents.filter(
      (document) => document.getId().getParentId() === parentId
    );
  }

  async create(
    document: import("../../_domain/Document").Document
  ): Promise<void> {
    const filePath = parsePath.idToFilePath(
      document.id,
      document.metadata.index,
      this.contentDir
    );
    if (await fileExists(filePath)) {
      throw new DocumentAlreadyExistsError(document.id);
    }
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      document.rawFrontmatter + document.content,
      "utf-8"
    );
  }

  async update(
    document: import("../../_domain/Document").Document
  ): Promise<void> {
    const filePath = parsePath.idToFilePath(
      document.id,
      document.metadata.index,
      this.contentDir
    );
    if (!(await fileExists(filePath))) {
      throw new DocumentNotFoundError(document.id);
    }
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      document.rawFrontmatter + document.content,
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
