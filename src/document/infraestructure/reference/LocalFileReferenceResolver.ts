import { resolve, sep } from "node:path";
import { readFile } from "node:fs/promises";
import { FrontmatterParser } from "../parse/FrontmatterParser";
import type { ContentEntry } from "../../domain/types";
import { DocumentReference } from "../../domain/DocumentReference";
import type {
  ReferenceResolutionContext,
  ReferenceResolverPlugin,
} from "../../domain/reference/types";

function getPath(ref: string): string {
  if (typeof ref === "string") return ref.slice(1);
  throw new Error("Invalid local reference");
}

function assertWithinProject(filePath: string): void {
  const resolved = resolve(process.cwd(), filePath);
  const root = resolve(process.cwd());
  if (!resolved.startsWith(root + sep) && resolved !== root) {
    throw new Error(`Local reference escapes project root: ${filePath}`);
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
  async resolve(
    ref: DocumentReference,
    context: ReferenceResolutionContext
  ): Promise<ContentEntry | null> {
    if (ref.getRef().source !== "local") return null;
    const relativePath = getPath(ref.getValue());
    console.log({ relativePath });
    assertWithinProject(relativePath);

    const raw = await readFile(relativePath, "utf-8");
    const { data, body } = FrontmatterParser.parseFrontmatter(raw);
    return {
      id: context.sourceId,
      data,
      body,
      rawFrontmatter: extractFrontmatter(raw),
    };
  }
}

function extractFrontmatter(raw: string): string | undefined {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return match ? `---\n${match[1]}---\n\n` : undefined;
}
