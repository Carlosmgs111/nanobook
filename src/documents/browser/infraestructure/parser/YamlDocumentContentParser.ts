import { Result } from "../../../../shared/domain/Result";
import { parse } from "yaml";
import type {
  SerializedEntry,
  SerializedDocumentMetadata,
} from "../../domain/model/StagedDocument";
import { PROTECTED_FRONTMATTER_FIELDS } from "../../domain/model/protectedFrontmatterFields";
import { InvalidDocumentContentError } from "../../domain/errors";
import type { DocumentContentParser } from "../../domain/ports/DocumentContentParser";

const FRONTMATTER_REGEX = /^---[\s\S]*?---\n?/;

export class YamlDocumentContentParser implements DocumentContentParser {
  parse(
    base: SerializedEntry,
    fullContent: string
  ): Result<InvalidDocumentContentError, SerializedEntry> {
    const rawFrontmatter = fullContent.match(FRONTMATTER_REGEX)?.[0] ?? "";

    let data: Partial<SerializedDocumentMetadata>;
    try {
      data = (parse(rawFrontmatter.replaceAll("---", "")) ??
        {}) as Partial<SerializedDocumentMetadata>;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return Result.fail(new InvalidDocumentContentError(reason));
    }

    // Los campos protegidos nunca se toman del texto editado: se conserva la base.
    const editable: Record<string, unknown> = { ...data };
    for (const field of PROTECTED_FRONTMATTER_FIELDS) delete editable[field];

    return Result.ok({
      ...base,
      title: data.title ?? base.title,
      description: data.description ?? base.description,
      position: data.position ?? base.position,
      ref: typeof data.ref === "string" ? data.ref : base.ref,
      metadata: {
        ...base.metadata,
        ...editable,
        id: base.metadata.id ?? base.documentId,
      },
      content: fullContent.replace(FRONTMATTER_REGEX, ""),
      rawFrontmatter,
    });
  }
}
