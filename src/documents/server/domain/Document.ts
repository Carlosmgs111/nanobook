import { Result } from "../../../shared/domain/Result";
import { DocumentId } from "./DocumentId";
import { DocumentReference } from "./DocumentReference";
import type { DocumentMetadata, Entry } from "./types";
import { hashString, serializeMetadata } from "./hash";
import type { DocumentParser } from "./ports/DocumentParser";
import {
  InvalidDocumentError,
  InvalidDocumentIdError,
} from "./errors";
import type { Heading } from "./Heading";
import type { DocumentHash } from "./DocumentHash";
import { DocumentPath } from "./DocumentPath";

const NEW_DOCUMENT_TEMPLATE = `---
id: "<%= id %>"
title: "<%= title %>"
description: "<%= description %>"
createdAt: <%= createdAt %>
updatedAt: <%= updatedAt %>
<%= ownerLine %>author: "<%= author %>"
tags: []
draft: false
<%= nanobookLine %>position: 0
ref: <%= ref %>
---
`;

export class Document {
  private parser: DocumentParser | null;
  /** Stable identity. */
  private documentId: DocumentId;
  private revision: number;
  private path: DocumentPath;
  private slug: string;
  private parentPath: DocumentPath | null;
  private position: number;
  private title: string;
  private description: string;
  private content: string;
  private metadata: DocumentMetadata;
  private rawFrontmatter: string;
  private reference: DocumentReference | null;

  private constructor(
    path: DocumentPath,
    overrides: Partial<DocumentMetadata> & {
      title: string;
      description: string;
    },
    body: string = "",
    parser: DocumentParser | null = null,
    documentId: DocumentId,
    rawFrontmatter?: string,
    revision = 1,
  ) {
    const now = new Date();
    this.parser = parser;
    this.path = path;
    this.documentId = documentId;
    this.revision = revision;
    this.slug = path.getPublicValue();
    this.parentPath = path.getParentPath();
    this.position = overrides.position ?? 0;
    this.title = overrides.title;
    this.description = overrides.description;
    this.content = body;
    this.reference = overrides.ref
      ? new DocumentReference(overrides.ref)
      : null;
    const createdAt = overrides.createdAt ?? now;
    const updatedAt = overrides.updatedAt ?? createdAt;
    this.metadata = Document.toDocumentMetadata(
      {
        title: overrides.title,
        id: this.documentId.getValue(),
        description: overrides.description,
        createdAt,
        updatedAt,
        ownerId: overrides.ownerId,
        author: overrides.author ?? "Nanobook",
        tags: overrides.tags ?? [],
        cover: overrides.cover,
        draft: overrides.draft ?? false,
        nanobook: overrides.nanobook ?? false,
        position: overrides.position ?? 0,
        ref: overrides.ref,
      }
    );
    this.rawFrontmatter =
      rawFrontmatter ??
      this.interpolateTemplate(NEW_DOCUMENT_TEMPLATE, {
        id: this.documentId.getValue(),
        title: this.metadata.title,
        description: this.metadata.description,
        createdAt: this.metadata.createdAt.toISOString(),
        updatedAt: this.metadata.updatedAt.toISOString(),
        ownerLine: this.metadata.ownerId
          ? `ownerId: "${this.metadata.ownerId}"\n`
          : "",
        nanobookLine: this.metadata.nanobook ? "nanobook: true\n" : "",
        author: this.metadata.author || "",
        ref: overrides.ref ? JSON.stringify(overrides.ref) : "null",
      });
  }

  static create(
    pathValue: string,
    data: DocumentMetadata,
    body: string = "",
    parser: DocumentParser | null = null,
    rawFrontmatter?: string,
    documentIdValue?: string,
    revision?: number,
  ): Result<
    InvalidDocumentError | InvalidDocumentIdError,
    Document
  > {
    const pathResult = DocumentPath.create(pathValue);
    if (!pathResult.isSuccess) {
      return Result.fail(pathResult.getError());
    }
    const path = pathResult.getValue();
    if (data.nanobook === true && !path.isIndex()) {
      return Result.fail(
        new InvalidDocumentError(
          pathValue,
          "A nanobook can only be marked on an index document"
        )
      );
    }
    const identityValue = data.id ?? documentIdValue;
    if (!identityValue) {
      return Result.fail(new InvalidDocumentIdError(path.getInternalValue()));
    }
    const documentIdResult = DocumentId.create(identityValue);
    if (!documentIdResult.isSuccess) return Result.fail(documentIdResult.getError());
    try {
      return Result.ok(
        new Document(
          path,
          data,
          body,
          parser,
          documentIdResult.getValue(),
          rawFrontmatter,
          revision,
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail(new InvalidDocumentError(pathValue, message));
    }
  }

  async computeContentHash(): Promise<string> {
    return await hashString(this.content);
  }

  async hashDocument(): Promise<DocumentHash> {
    const contentHash = await this.computeContentHash();
    const metadataHash = await hashString(serializeMetadata(this.metadata));
    // A path move must not create a new document version. Version identifies
    // the document state, while path identifies its current location.
    const version = await hashString(`${contentHash}\n${metadataHash}`);
    return {
      documentId: this.getDocumentId().getValue(),
      revision: this.revision,
      path: this.getPath(),
      id: this.getDocumentId().getValue(),
      version,
      contentHash,
      metadataHash,
    };
  }

  getId(): DocumentId {
    return this.documentId;
  }
  getDocumentId(): DocumentId {
    return this.documentId;
  }
  getRevision(): number {
    return this.revision;
  }
  getPath(): string {
    return this.path.getInternalValue();
  }
  getPublicPath(): string {
    return this.path.getPublicValue();
  }
  isIndex(): boolean {
    return this.path.isIndex();
  }
  getDocumentPath(): DocumentPath {
    return this.path;
  }
  getDocumentVersion(): Promise<string> {
    return this.hashDocument().then((hash) => hash.version);
  }
  moveTo(pathValue: string): Result<InvalidDocumentError | InvalidDocumentIdError, Document> {
    return Document.create(
      pathValue,
      this.metadata,
      this.content,
      this.parser,
      undefined,
      this.getDocumentId().getValue(),
      this.revision,
    );
  }
  getTitle(): string {
    return this.title;
  }
  getDescription(): string {
    return this.description;
  }
  getPosition(): number {
    return this.position;
  }
  getParentPath(): DocumentPath | null {
    return this.parentPath;
  }
  getMetadata(): DocumentMetadata {
    return this.metadata;
  }
  getRawFrontmatter(): string {
    return this.rawFrontmatter;
  }
  getContent(): string {
    return this.content;
  }
  getSlug(): string {
    return this.slug;
  }
  getReference(): DocumentReference | null {
    return this.reference;
  }
  getHeadings(): Heading[] {
    if (!this.parser) return [];
    return this.parser.parseDocument(this).headings;
  }
  parse(): Entry {
    return {
      documentId: this.getDocumentId().getValue(),
      path: this.getPath(),
      isIndex: this.isIndex(),
      version: "",
      id: this.getDocumentId().getValue(),
      title: this.title,
      description: this.description,
      position: this.position,
      parentPath: this.parentPath?.getPublicValue(),
      metadata: this.metadata,
      rawFrontmatter: this.rawFrontmatter,
      content: this.content,
      slug: this.slug,
      ref: this.reference?.getValue(),
      headings: this.getHeadings(),
    };
  }

  private interpolateTemplate(
    template: string,
    values: Record<string, string>
  ): string {
    return template.replace(/<%=\s*(\w+)\s*%>/g, (_, key) => values[key] ?? "");
  }

  private static assertRequiredField<T>(
    value: T | undefined,
    field: string,
    documentId: string
  ): T {
    if (value === undefined || value === null) {
      throw new Error(
        `Missing required field "${field}" in document "${documentId}"`
      );
    }
    return value;
  }

  private static toDocumentMetadata(data: DocumentMetadata): DocumentMetadata {
    const documentId = data.id ?? "unknown";
    return {
      id: data.id,
      title: this.assertRequiredField(
        data.title as string,
        "title",
        documentId
      ),
      description: this.assertRequiredField(
        data.description as string,
        "description",
        documentId
      ),
      createdAt: this.assertRequiredField(
        data.createdAt as Date,
        "createdAt",
        documentId
      ),
      updatedAt: this.assertRequiredField(
        data.updatedAt as Date,
        "updatedAt",
        documentId
      ),
      ownerId: data.ownerId,
      author: this.assertRequiredField(
        data.author as string,
        "author",
        documentId
      ),
      tags: (data.tags as string[]) ?? [],
      cover: data.cover as string | undefined,
      draft: (data.draft as boolean) ?? false,
      nanobook: (data.nanobook as boolean) ?? false,
      position: (data.position as number) ?? 0,
      ref: data.ref as DocumentMetadata["ref"],
    };
  }
}
