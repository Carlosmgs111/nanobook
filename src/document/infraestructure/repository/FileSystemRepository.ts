import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Result } from "../../../shared/utils/result";
import { FrontmatterParser } from "../parse/FrontmatterParser";
import { idToFilePath, filePathToId } from "./fileSystemParsePath";
import type {
  ContentRepository,
  ContentRepositoryListError,
} from "../../domain/types";
import {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
} from "../../domain/errors";

import { Document } from "../../domain/Document";
import type { DocumentId } from "../../domain/DocumentId";
import type { DocumentParser } from "../../domain/DocumentParser";
import {
  DocumentParseError,
  DocumentRepositoryError,
} from "../errors";

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

  async list(): Promise<Result<ContentRepositoryListError, Document[]>> {
    try {
      const contentRoot = resolve(this.contentDir);
      const files = await scanMarkdownFiles(contentRoot);
      const documents: Document[] = [];

      for (const file of files) {
        const raw = await readFile(file, "utf-8");
        const { data, body } = FrontmatterParser.parseFrontmatter(raw);
        const id = filePathToId(file, contentRoot);
        const documentResult = Document.create(id, data, body, this.parser);
        if (!documentResult.isSuccess) {
          return Result.fail(documentResult.getError());
        }
        documents.push(documentResult.getValue());
      }

      return Result.ok(documents);
    } catch (error) {
      return Result.fail(
        new DocumentRepositoryError("Failed to list documents", { cause: error })
      );
    }
  }

  async get(
    id: DocumentId
  ): Promise<Result<ContentRepositoryListError, Document | null>> {
    const documentsResult = await this.list();
    if (!documentsResult.isSuccess) {
      return Result.fail(documentsResult.getError());
    }
    const documents = documentsResult.getValue();
    return Result.ok(
      documents.find((document) => document.getId().getValue() === id.getValue()) ??
        null
    );
  }

  async getBySlug(
    slug: string
  ): Promise<Result<ContentRepositoryListError, Document | null>> {
    const documentsResult = await this.list();
    if (!documentsResult.isSuccess) {
      return Result.fail(documentsResult.getError());
    }
    const documents = documentsResult.getValue();
    return Result.ok(
      documents.find((document) => document.getId().getValue() === slug) ?? null
    );
  }

  async listChildren(
    parentId: string | null
  ): Promise<Result<ContentRepositoryListError, Document[]>> {
    const documentsResult = await this.list();
    if (!documentsResult.isSuccess) {
      return Result.fail(documentsResult.getError());
    }
    const documents = documentsResult.getValue();
    return Result.ok(
      documents.filter((document) => document.getId().getParentId() === parentId)
    );
  }

  async create(
    document: Document
  ): Promise<Result<DocumentRepositoryError | DocumentAlreadyExistsError, void>> {
    try {
      const filePath = idToFilePath(
        document.getId().getValue(),
        document.getMetadata().index,
        this.contentDir
      );
      if (await fileExists(filePath)) {
        return Result.fail(new DocumentAlreadyExistsError(document.getId()));
      }
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(
        filePath,
        document.getRawFrontmatter() + document.getContent(),
        "utf-8"
      );
      return Result.ok();
    } catch (error) {
      return Result.fail(
        new DocumentRepositoryError(
          `Failed to create document "${document.getId().getValue()}"`,
          { cause: error }
        )
      );
    }
  }

  async update(
    document: Document
  ): Promise<Result<DocumentRepositoryError | DocumentNotFoundError, void>> {
    try {
      const filePath = idToFilePath(
        document.getId().getValue(),
        document.getMetadata().index,
        this.contentDir
      );
      if (!(await fileExists(filePath))) {
        return Result.fail(new DocumentNotFoundError(document.getId()));
      }
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(
        filePath,
        document.getRawFrontmatter() + document.getContent(),
        "utf-8"
      );
      return Result.ok();
    } catch (error) {
      return Result.fail(
        new DocumentRepositoryError(
          `Failed to update document "${document.getId().getValue()}"`,
          { cause: error }
        )
      );
    }
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
