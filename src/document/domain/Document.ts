import { Result } from "../../shared/domain/Result";
import { DocumentId } from "./DocumentId";
import { DocumentReference } from "./DocumentReference";
import type { DocumentMetadata, Entry } from "./types";
import { hashString, serializeMetadata } from "./hash";
import type { DocumentParser } from "./ports/DocumentParser";
import {
  InvalidDocumentError,
  InvalidDocumentIdError,
  InvalidIndexDocumentError,
} from "./errors";
import type { Heading } from "./Heading";
import type { DocumentHash } from "./DocumentHash";
import { DocumentPath } from "./DocumentPath";

const NEW_DOCUMENT_TEMPLATE = `---
id: "<%= id %>"
title: "<%= title %>"
description: "<%= description %>"
date: <%= date %>
author: "<%= author %>"
tags: []
draft: false
index: <%= index %>
position: 0
proxyTargetId: null
---
`;

export class Document {
  private parser: DocumentParser | null;
  /** Stable identity. */
  private documentId: DocumentId;
  private path: DocumentPath;
  private slug: string;
  private parentPath: DocumentPath | null;
  private position: number;
  private title: string;
  private description: string;
  private content: string;
  private metadata: DocumentMetadata;
  private rawFrontmatter: string;
  private proxyTargetId: DocumentReference | null;

  private constructor(
    path: DocumentPath,
    overrides: Partial<DocumentMetadata> & {
      title: string;
      description: string;
    },
    body: string = "",
    parser: DocumentParser | null = null,
    documentId: DocumentId,
    rawFrontmatter?: string
  ) {
    const now = new Date();
    const isIndex = path.isIndex();
    this.parser = parser;
    this.path = path;
    this.documentId = documentId;
    this.slug = path.getValue();
    this.parentPath = path.getParentPath();
    this.position = overrides.position ?? 0;
    this.title = overrides.title;
    this.description = overrides.description;
    this.content = body;
    this.proxyTargetId = overrides.ref
      ? new DocumentReference(overrides.ref)
      : null;
    this.metadata = Document.toDocumentMetadata(
      {
        title: overrides.title,
        id: this.documentId.getValue(),
        description: overrides.description,
        date: overrides.date ?? now,
        author: overrides.author ?? "Nanobook",
        tags: overrides.tags ?? [],
        cover: overrides.cover,
        draft: overrides.draft ?? false,
        index: overrides.index ?? isIndex,
        position: overrides.position ?? 0,
        ref: overrides.ref,
      },
      path.getValue()
    );
    this.rawFrontmatter =
      rawFrontmatter ??
      this.interpolateTemplate(NEW_DOCUMENT_TEMPLATE, {
        id: this.documentId.getValue(),
        title: this.metadata.title,
        description: this.metadata.description,
        date: this.metadata.date.toISOString(),
        author: this.metadata.author || "",
        index: String(this.metadata.index),
      });
  }

  static create(
    pathValue: string,
    data: DocumentMetadata,
    body: string = "",
    parser: DocumentParser | null = null,
    rawFrontmatter?: string,
    documentIdValue?: string
  ): Result<
    InvalidDocumentError | InvalidDocumentIdError | InvalidIndexDocumentError,
    Document
  > {
    const pathResult = DocumentPath.create(pathValue);
    if (!pathResult.isSuccess) {
      return Result.fail(pathResult.getError());
    }
    const path = pathResult.getValue();
    if (Boolean(data.index) !== path.isIndex()) {
      return Result.fail(
        new InvalidIndexDocumentError(
          path.getValue(),
          path.isIndex(),
          data
        )
      );
    }
    const identityValue = data.id ?? documentIdValue;
    if (!identityValue) {
      return Result.fail(new InvalidDocumentIdError(path.getValue()));
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
          rawFrontmatter
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
      path: this.getPath(),
      id: this.getPath(),
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
  getPath(): string {
    return this.path.getValue();
  }
  getDocumentPath(): DocumentPath {
    return this.path;
  }
  getDocumentVersion(): Promise<string> {
    return this.hashDocument().then((hash) => hash.version);
  }
  moveTo(pathValue: string): Result<InvalidDocumentError | InvalidDocumentIdError | InvalidIndexDocumentError, Document> {
    return Document.create(
      pathValue,
      this.metadata,
      this.content,
      this.parser,
      undefined,
      this.getDocumentId().getValue()
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
  getProxyTargetId(): DocumentReference | null {
    return this.proxyTargetId;
  }
  getHeadings(): Heading[] {
    if (!this.parser) return [];
    return this.parser.parseDocument(this).headings;
  }
  parse(): Entry {
    return {
      documentId: this.getDocumentId().getValue(),
      path: this.getPath(),
      version: "",
      id: this.getPath(),
      title: this.title,
      description: this.description,
      position: this.position,
      parentId: this.parentPath?.getValue(),
      metadata: this.metadata,
      rawFrontmatter: this.rawFrontmatter,
      content: this.content,
      slug: this.slug,
      proxyTargetId: this.proxyTargetId?.getValue(),
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

  private static toDocumentMetadata(
    data: DocumentMetadata,
    documentId: string
  ): DocumentMetadata {
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
      date: this.assertRequiredField(data.date as Date, "date", documentId),
      author: this.assertRequiredField(
        data.author as string,
        "author",
        documentId
      ),
      tags: (data.tags as string[]) ?? [],
      cover: data.cover as string | undefined,
      draft: (data.draft as boolean) ?? false,
      index: (data.index as boolean) ?? false,
      position: (data.position as number) ?? 0,
      ref: data.ref as DocumentMetadata["ref"],
    };
  }
}
