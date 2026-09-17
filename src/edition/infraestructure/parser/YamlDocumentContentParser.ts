import { Result } from "../../../shared/domain/Result";
import { parse } from "yaml";
import type {
  SerializedEntry,
  SerializedDocumentMetadata,
} from "../../domain/model/StagedDocument";
import { InvalidDocumentContentError } from "../../domain/errors";
import type { DocumentContentParser } from "../../domain/ports/DocumentContentParser";

export class YamlDocumentContentParser implements DocumentContentParser {
  parse(
    base: SerializedEntry,
    fullContent: string
  ): Result<InvalidDocumentContentError, SerializedEntry> {
    const frontmatterMatch = fullContent.match(/^---[\s\S]*?---\n?/);
    const rawFrontmatter = frontmatterMatch?.[0] ?? "";
    const frontmatterBody = rawFrontmatter.replaceAll("---", "");

    let data: Partial<SerializedDocumentMetadata>;
    try {
      data = (parse(frontmatterBody) ?? {}) as Partial<SerializedDocumentMetadata>;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return Result.fail(new InvalidDocumentContentError(reason));
    }

    const content = fullContent.replace(/^---[\s\S]*?---\n?/g, "");

    const date: string =
      data.date instanceof Date
        ? data.date.toISOString()
        : data.date ?? base.metadata.date;

    return Result.ok({
      ...base,
      metadata: {
        ...base.metadata,
        ...data,
        date,
      },
      content,
      rawFrontmatter,
    });
  }
}
