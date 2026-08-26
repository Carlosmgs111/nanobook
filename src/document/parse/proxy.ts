import { readFile } from "node:fs/promises";
import { stringify } from "yaml";
import type { Document, DocumentMetadata } from "./types";
import type { ReferenceResolver } from "../reference/types";
import { CompositeReferenceResolver } from "../reference/resolver";
import { InternalReferenceResolver } from "../adapters/reference/internal-resolver";
import { LocalFileReferenceResolver } from "../adapters/reference/local-file-resolver";
import { GitHubReferenceResolver } from "../adapters/reference/github-resolver";

/**
 * Resuelve un documento proxy (con `ref` en frontmatter) reemplazando su
 * contenido y metadatos por los del documento destino, pero conservando su
 * propio id, slug y parentId para que se genere en su propia URL.
 *
 * Devuelve `null` si el documento no tiene `ref`, si no se encuentra el destino,
 * o si el destino también es un proxy (no se permiten cadenas).
 */
export async function resolveProxy(
  sourceDocument: Document,
  resolver: ReferenceResolver,
): Promise<Document | null> {
  const data = sourceDocument.metadata;
  if (!data.ref) return null;

  try {
    const targetEntry = await resolver.resolve(data.ref, sourceDocument);

    if (!targetEntry) {
      console.warn(
        `Proxy reference not found: ${sourceDocument.id} -> ${JSON.stringify(data.ref)}`,
      );
      return null;
    }

    const targetData = targetEntry.data as DocumentMetadata;

    if (targetData.ref) {
      console.warn(
        `Chained proxy references are not supported: ${sourceDocument.id} -> ${JSON.stringify(data.ref)}`,
      );
      return null;
    }

    const mergedData: DocumentMetadata = {
      ...data,
      ...targetData,
      position: data.position,
      index: data.index,
      ref: undefined,
    };

    return {
      id: sourceDocument.id,
      slug: sourceDocument.slug,
      parentId: sourceDocument.parentId,
      position: data.position,
      title: mergedData.title,
      description: mergedData.description,
      content: targetEntry.body ?? "",
      metadata: mergedData,
      rawFrontmatter: sourceDocument.rawFrontmatter,
      proxyTargetId:
        typeof data.ref === "string" ? data.ref : JSON.stringify(data.ref),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to resolve proxy ${sourceDocument.id}: ${message}`);
    return null;
  }
}

/**
 * Crea un resolutor de referencias sobre un conjunto de documentos ya cargados.
 *
 * Se usa para resolver proxies sin depender de `astro:content`.
 */
export function createReferenceResolver(
  documents: Document[],
): ReferenceResolver {
  const documentsById = new Map(documents.map((document) => [document.id, document]));

  return new CompositeReferenceResolver(
    [
      new InternalReferenceResolver(documentsById),
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

/**
 * Resuelve todos los proxies de una lista de documentos.
 *
 * Los documentos que no tengan `ref` se devuelven sin cambios. Los que tengan
 * `ref` y fallen en la resolución se devuelven en su forma original para no
 * romper la navegación.
 */
export async function resolveProxies(
  documents: Document[],
): Promise<Document[]> {
  const resolver = createReferenceResolver(documents);

  return Promise.all(
    documents.map(async (document) => {
      if (!document.metadata.ref) return document;
      return (await resolveProxy(document, resolver)) ?? document;
    }),
  );
}
