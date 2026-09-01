import type { DocumentId } from "../DocumentId";
/**
 * Resuelve una referencia relativa a documentos de la colección.
 *
 * Normaliza el ref (elimina `.md` y `/index`) y lo resuelve desde el
 * directorio base del documento origen. El comportamiento respeta el campo
 * `index` del frontmatter, alineado con `InternalRefere  nceResolver`.
 */
export function normalizeRef(ref: string): string {
  return ref.replace(/\.md$/, "").replace(/\/index$/, "");
}

export function resolveDocumentReference(
  ref: string,
  sourceId: DocumentId,
  isIndex: boolean,
): string {
  const refPath = normalizeRef(ref);
  const refSegments = refPath.split("/").filter(Boolean);

  const sourceSegments =
    sourceId.getValue() === "index"
      ? []
      : isIndex
        ? sourceId.getValue().split("/")
        : sourceId.getValue().split("/").slice(0, -1);

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
