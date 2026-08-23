import { getAstroEntries } from "../core/astro-cache";
import type { ContentRepository, Document } from "../core/types";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { idToFilePath } from "../core/path";
import { resolveProxy } from "../core/proxy";
import { toDocument } from "../core/document";
import { CompositeReferenceResolver } from "../core/reference/resolver";
import { InternalReferenceResolver } from "../core/reference/internal-resolver";
import { LocalFileReferenceResolver } from "../core/reference/local-file-resolver";
import { GitHubReferenceResolver } from "./github-loader/reference-resolver";

let cachedDocuments: Document[] | null = null;

function createReferenceResolver(
  entriesById: Map<string, import("astro:content").CollectionEntry<"content">>,
) {
  return new CompositeReferenceResolver(
    [
      new InternalReferenceResolver(entriesById),
      new LocalFileReferenceResolver(),
      new GitHubReferenceResolver(),
    ],
    {
      projectRoot: process.cwd(),
      githubToken: import.meta.env.GITHUB_TOKEN,
      readFile: (path) => readFile(path, "utf-8"),
    },
  );
}

export class AstroCollectionRepository implements ContentRepository {
  async list(): Promise<Document[]> {
    if (cachedDocuments) return cachedDocuments;

    const entries = await getAstroEntries();
    const entriesById = new Map(entries);
    const resolver = createReferenceResolver(entriesById);

    const documents = await Promise.all(
      Array.from(entries.values())
        .filter((entry) => !entry.data.draft)
        .map(async (entry) => {
          const proxy = await resolveProxy(entry, resolver);
          return proxy ?? toDocument(entry);
        }),
    );

    cachedDocuments = documents;
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
