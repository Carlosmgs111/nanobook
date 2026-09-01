import { resolveDocumentReference } from "./path-resolver";

const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function isExternalOrAnchor(href: string): boolean {
  return (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("//") ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  );
}

function normalizeAbsolutePath(href: string): string {
  return href.replace(/^\//, "").replace(/\.md$/, "");
}

/**
 * Extrae los IDs de documentos destino a los que un documento apunta
 * mediante links internos de Markdown.
 *
 * Solo considera links relativos (`./doc`, `../doc`) y absolutos dentro
 * del contenido (`/doc`). Ignora URLs externas, anclas y otros protocolos.
 *
 * Los IDs devueltos no se validan contra la colección; es responsabilidad
 * del consumidor filtrar los que no existan.
 */
export function extractInternalLinkTargets(
  sourceId: string,
  content: string,
  isIndex: boolean,
): string[] {
  const targets = new Set<string>();

  for (const match of content.matchAll(MARKDOWN_LINK_REGEX)) {
    const href = match[2];

    if (!href || isExternalOrAnchor(href)) continue;

    let targetId: string;

    if (href.startsWith("/")) {
      targetId = normalizeAbsolutePath(href);
    } else {
      targetId = resolveDocumentReference(href, sourceId, isIndex);
    }

    if (targetId && targetId !== sourceId) {
      targets.add(targetId);
    }
  }

  return Array.from(targets);
}
