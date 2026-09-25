import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Result } from "../../../shared/domain/Result";
import { idToFilePath, filePathToId } from "./fileSystemParsePath";
import type {
  ContentRepository,
  ContentRepositoryListError,
} from "../../domain/ports/ContentRepository";
import {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
  DocumentRepositoryError,
} from "../../domain/errors";
import { Document } from "../../domain/Document";
import type { DocumentParser } from "../../domain/ports/DocumentParser";
import { createDocumentFromRaw } from "./createDocumentFromRaw";

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
        const id = filePathToId(file, contentRoot);
        const documentResult = createDocumentFromRaw(id, raw, this.parser);
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

  async getById(
    id: string
  ): Promise<Result<ContentRepositoryListError, Document | null>> {
    const documentsResult = await this.list();
    if (!documentsResult.isSuccess) {
      return Result.fail(documentsResult.getError());
    }
    const documents = documentsResult.getValue();
    return Result.ok(
      documents.find((document) => document.getDocumentId().getValue() === id) ?? null
    );
  }

  async getByPath(
    path: string
  ): Promise<Result<ContentRepositoryListError, Document | null>> {
    const documentsResult = await this.list();
    if (!documentsResult.isSuccess) return Result.fail(documentsResult.getError());
    return Result.ok(
      documentsResult.getValue().find((document) => document.getPath() === path) ?? null
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
      documents.filter(
        (document) => document.getParentId()?.getValue() === parentId
      )
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
        return Result.fail(new DocumentAlreadyExistsError(document.getId().getValue()));
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
        return Result.fail(new DocumentNotFoundError(document.getId().getValue()));
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
