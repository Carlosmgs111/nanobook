import type { CollectionEntry } from "astro:content";
import type {
  ContentEntry,
  DocumentMetadata,
  RefValue,
} from "../types";
import type { ReferenceResolutionContext, ReferenceResolverPlugin } from "./types";

function normalizeRef(ref: string): string {
  return ref.replace(/\.md$/, "").replace(/\/index$/, "");
}

function resolveReference(
  ref: string,
  sourceId: string,
  isIndex: boolean,
): string {
  const refPath = normalizeRef(ref);
  const refSegments = refPath.split("/").filter(Boolean);

  const sourceSegments =
    sourceId === "index"
      ? []
      : isIndex
        ? sourceId.split("/")
        : sourceId.split("/").slice(0, -1);

  const targetSegments: string[] = [...sourceSegments];
  for (const segment of refSegments) {
    if (segment === ".") continue;
    if (segment === "..") {
      targetSegments.pop();
    } else {
      targetSegments.push(segment);
    }
  }

  return targetSegments.join("/") || "index";
}

/**
 * Resolutor para referencias internas a otros documentos de la colección.
 *
 * Acepta strings que parecen rutas relativas: `./doc.md`, `../doc.md`,
 * `sibling.md`. No acepta rutas absolutas (`/README.md`) ni prefijos como
 * `github:` o URLs.
 */
export class InternalReferenceResolver implements ReferenceResolverPlugin {
  name = "internal";

  constructor(
    private entriesById: Map<string, CollectionEntry<"content">>,
  ) {}

  canResolve(ref: RefValue): boolean {
    return (
      typeof ref === "string" &&
      !ref.startsWith("/") &&
      !ref.includes(":")
    );
  }

  async resolve(
    ref: RefValue,
    context: ReferenceResolutionContext,
  ): Promise<ContentEntry | null> {
    const refStr = ref as string;
    const targetId = resolveReference(
      refStr,
      context.sourceId,
      context.sourceData.index,
    );
    const targetEntry = this.entriesById.get(targetId);

    if (!targetEntry) return null;

    return {
      id: targetEntry.id,
      data: targetEntry.data as DocumentMetadata,
      body: targetEntry.body,
    };
  }
}
