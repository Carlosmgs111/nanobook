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

    const {
      id: _id,
      author: _author,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...editableData
    } = data;
    const baseMetadata = base.metadata;

    const createdAt = base.metadata.createdAt;
    const updatedAt = base.metadata.updatedAt;

    return Result.ok({
      ...base,
      title: data.title ?? base.title,
      description: data.description ?? base.description,
      position: data.position ?? base.position,
      ref: typeof data.ref === "string" ? data.ref : base.ref,
      metadata: {
        ...baseMetadata,
        ...editableData,
        id: base.metadata.id ?? base.documentId,
        author: base.metadata.author,
        createdAt,
        updatedAt,
      },
      content,
      rawFrontmatter,
    });
  }
}
