import {
  access,
  mkdir,
  readdir,
  readFile,
  rmdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { Result } from "../../../../shared/domain/Result";
import { pathToFilePath, filePathToId } from "./fileSystemParsePath";
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
        new DocumentRepositoryError("Failed to list documents", {
          cause: error,
        })
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
      documents.find(
        (document) => document.getDocumentId().getValue() === id
      ) ?? null
    );
  }

  async getByPath(
    path: string
  ): Promise<Result<ContentRepositoryListError, Document | null>> {
    const documentsResult = await this.list();
    if (!documentsResult.isSuccess)
      return Result.fail(documentsResult.getError());
    return Result.ok(
      documentsResult
        .getValue()
        .find((document) => document.getPath() === path) ?? null
    );
  }

  async getByPublicPath(
    path: string
  ): Promise<Result<ContentRepositoryListError, Document | null>> {
    const documentsResult = await this.list();
    if (!documentsResult.isSuccess)
      return Result.fail(documentsResult.getError());
    return Result.ok(
      documentsResult
        .getValue()
        .find((document) => document.getPublicPath() === path) ?? null
    );
  }

  async listChildren(
    parentPath: string | null
  ): Promise<Result<ContentRepositoryListError, Document[]>> {
    const documentsResult = await this.list();
    if (!documentsResult.isSuccess) {
      return Result.fail(documentsResult.getError());
    }
    const documents = documentsResult.getValue();
    return Result.ok(
      documents.filter(
        (document) => document.getParentPath()?.getPublicValue() === parentPath
      )
    );
  }

  async create(
    document: Document
  ): Promise<
    Result<DocumentRepositoryError | DocumentAlreadyExistsError, void>
  > {
    try {
      const filePath = pathToFilePath(document.getPath(), this.contentDir);
      if (await fileExists(filePath)) {
        return Result.fail(new DocumentAlreadyExistsError(document.getPath()));
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
          `Failed to create document "${document.getPath()}"`,
          { cause: error }
        )
      );
    }
  }

  async update(
    document: Document,
    previousPath?: string
  ): Promise<
    Result<
      | DocumentRepositoryError
      | DocumentNotFoundError
      | DocumentAlreadyExistsError,
      void
    >
  > {
    try {
      const filePath = pathToFilePath(document.getPath(), this.contentDir);
      const sourcePath = previousPath
        ? pathToFilePath(previousPath, this.contentDir)
        : filePath;

      if (!(await fileExists(sourcePath))) {
        return Result.fail(
          new DocumentNotFoundError(previousPath ?? document.getPath())
        );
      }
      if (sourcePath !== filePath && (await fileExists(filePath))) {
        return Result.fail(new DocumentAlreadyExistsError(document.getPath()));
      }
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(
        filePath,
        document.getRawFrontmatter() + document.getContent(),
        "utf-8"
      );
      if (sourcePath !== filePath) {
        await unlink(sourcePath);
        await removeEmptyParentDirectories(
          dirname(sourcePath),
          resolve(this.contentDir)
        );
      }
      return Result.ok();
    } catch (error) {
      return Result.fail(
        new DocumentRepositoryError(
          `Failed to update document "${document.getPath()}"`,
          { cause: error }
        )
      );
    }
  }

  async delete(
    document: Document
  ): Promise<Result<DocumentRepositoryError | DocumentNotFoundError, void>> {
    try {
      const filePath = pathToFilePath(document.getPath(), this.contentDir);
      if (!(await fileExists(filePath))) {
        return Result.fail(new DocumentNotFoundError(document.getPath()));
      }
      await unlink(filePath);
      return Result.ok();
    } catch (error) {
      return Result.fail(
        new DocumentRepositoryError(
          `Failed to delete document "${document.getPath()}"`,
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

async function removeEmptyParentDirectories(
  directory: string,
  contentRoot: string
): Promise<void> {
  let currentDirectory = resolve(directory);
  const root = resolve(contentRoot);

  while (
    currentDirectory !== root &&
    currentDirectory.startsWith(`${root}${sep}`)
  ) {
    const entries = await readdir(currentDirectory);
    if (entries.length > 0) return;
    await rmdir(currentDirectory);
    currentDirectory = dirname(currentDirectory);
  }
}
