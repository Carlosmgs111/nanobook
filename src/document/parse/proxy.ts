import { stringify } from "yaml";
import type { CollectionEntry } from "astro:content";
import { getParentId } from "./path";
import type { Document, DocumentMetadata } from "./types";
import type { ReferenceResolver } from "../reference/types";

/**
 * Resuelve un documento proxy (con `ref` en frontmatter) reemplazando su
 * contenido y metadatos por los del documento destino, pero conservando su
 * propio id, slug y parentId para que se genere en su propia URL.
 *
 * Devuelve `null` si el entry no tiene `ref`, si no se encuentra el destino,
 * o si el destino también es un proxy (no se permiten cadenas).
 */
export async function resolveProxy(
  sourceEntry: CollectionEntry<"content">,
  resolver: ReferenceResolver,
): Promise<Document | null> {
  const data = sourceEntry.data as DocumentMetadata;
  if (!data.ref) return null;

  try {
    const targetEntry = await resolver.resolve(data.ref, sourceEntry);

    if (!targetEntry) {
      console.warn(
        `Proxy reference not found: ${sourceEntry.id} -> ${JSON.stringify(data.ref)}`,
      );
      return null;
    }

    const targetData = targetEntry.data as DocumentMetadata;

    if (targetData.ref) {
      console.warn(
        `Chained proxy references are not supported: ${sourceEntry.id} -> ${JSON.stringify(data.ref)}`,
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
      id: sourceEntry.id,
      slug: sourceEntry.id === "index" ? "" : sourceEntry.id,
      parentId: getParentId(sourceEntry.id),
      position: data.position,
      title: mergedData.title,
      description: mergedData.description,
      content: targetEntry.body ?? "",
      metadata: mergedData,
      rawFrontmatter: `---\n${stringify(sourceEntry.data)}---\n\n`,
      proxyTargetId:
        typeof data.ref === "string" ? data.ref : JSON.stringify(data.ref),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to resolve proxy ${sourceEntry.id}: ${message}`);
    return null;
  }
}
