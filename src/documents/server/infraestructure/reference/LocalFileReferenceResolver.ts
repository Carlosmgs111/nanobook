import { resolve, sep } from "node:path";
import { readFile } from "node:fs/promises";
import { FrontmatterParser } from "../parse/FrontmatterParser";
import type { ContentEntry } from "../../domain/types";
import type { DocumentReference } from "../../domain/DocumentReference";
import type { ReferenceResolver } from "../../domain/reference/types";

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
export class LocalFileReferenceResolver implements ReferenceResolver {
  async resolve(ref: DocumentReference): Promise<ContentEntry | null> {
    if (ref.getRef().source !== "local") return null;
    const relativePath = ref.getValue().replace(/^\//, "");
    assertWithinProject(relativePath);

    const raw = await readFile(relativePath, "utf-8");
    const { data, body } = FrontmatterParser.parseFrontmatter(raw);
    return { data, body };
  }
}
