import { resolve, sep } from "node:path";
import { parseFrontmatter } from "../frontmatter";
import type { ContentEntry, DocumentMetadata, RefValue } from "../types";
import type { ReferenceResolutionContext, ReferenceResolverPlugin } from "./types";

function isLocalRef(ref: RefValue): boolean {
  if (typeof ref === "string") return ref.startsWith("/");
  return ref && typeof ref === "object" && ref.source === "local";
}

function getPath(ref: RefValue): string {
  if (typeof ref === "string") return ref.slice(1);
  if (ref && typeof ref === "object" && ref.source === "local") {
    return (ref as { path: string }).path;
  }
  throw new Error("Invalid local reference");
}

function assertWithinProject(filePath: string, projectRoot: string): void {
  const resolved = resolve(projectRoot, filePath);
  const root = resolve(projectRoot);
  if (!resolved.startsWith(root + sep) && resolved !== root) {
    throw new Error(
      `Local reference escapes project root: ${filePath}`,
    );
  }
}

/**
 * Resolutor para archivos Markdown locales fuera de la colección de contenido.
 *
 * Soporta:
 * - Forma corta: `ref: /README.md` (relativo a la raíz del proyecto).
 * - Forma estructurada: `ref: { source: "local", path: "README.md" }`.
 */
export class LocalFileReferenceResolver implements ReferenceResolverPlugin {
  name = "local";

  canResolve(ref: RefValue): boolean {
    return isLocalRef(ref);
  }

  async resolve(
    ref: RefValue,
    context: ReferenceResolutionContext,
  ): Promise<ContentEntry | null> {
    const relativePath = getPath(ref);
    assertWithinProject(relativePath, context.projectRoot);

    const raw = await context.readFile(relativePath);
    const { data, body } = parseFrontmatter(raw);

    return {
      id: context.sourceId,
      data: data as DocumentMetadata,
      body,
      rawFrontmatter: extractFrontmatter(raw),
    };
  }
}

function extractFrontmatter(raw: string): string | undefined {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return match ? `---\n${match[1]}---\n\n` : undefined;
}
