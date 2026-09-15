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

const NEW_DOCUMENT_TEMPLATE = `---
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

  private id: DocumentId;
  private slug: string;
  private parentId: DocumentId | null;
  private position: number;
  private title: string;
  private description: string;
  private content: string;
  private metadata: DocumentMetadata;
  private rawFrontmatter: string;
  private proxyTargetId: DocumentReference | null;

  private constructor(
    id: DocumentId,
    overrides: Partial<DocumentMetadata> & {
      title: string;
      description: string;
    },
    body: string = "",
    parser: DocumentParser | null = null,
    rawFrontmatter?: string
  ) {
    const now = new Date();
    const isIndex = id.isIndexId();
    this.parser = parser;
    this.id = id;
    this.slug = id.getValue();
    this.parentId = id.getParentId();
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
      id.getValue()
    );
    this.rawFrontmatter =
      rawFrontmatter ??
      this.interpolateTemplate(NEW_DOCUMENT_TEMPLATE, {
        title: this.metadata.title,
        description: this.metadata.description,
        date: this.metadata.date.toISOString(),
        author: this.metadata.author || "",
        index: String(this.metadata.index),
      });
  }

  static create(
    id: string,
    data: DocumentMetadata,
    body: string = "",
    parser: DocumentParser | null = null,
    rawFrontmatter?: string
  ): Result<
    InvalidDocumentError | InvalidDocumentIdError | InvalidIndexDocumentError,
    Document
  > {
    const idResult = DocumentId.create(id);
    if (!idResult.isSuccess) {
      return Result.fail(idResult.getError());
    }
    const documentId = idResult.getValue();
    if (Boolean(data.index) !== documentId.isIndexId()) {
      return Result.fail(
        new InvalidIndexDocumentError(
          documentId.getValue(),
          documentId.isIndexId(),
          data
        )
      );
    }
    return Result.ok(
      new Document(idResult.getValue(), data, body, parser, rawFrontmatter)
    );
  }

  async computeContentHash(): Promise<string> {
    return await hashString(this.content);
  }

  async hashDocument(): Promise<DocumentHash> {
    return {
      id: this.id.getValue(),
      contentHash: await this.computeContentHash(),
      metadataHash: await hashString(serializeMetadata(this.metadata)),
    };
  }

  getId(): DocumentId {
    return this.id;
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
  getParentId(): DocumentId | null {
    return this.parentId;
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
      id: this.id.getValue(),
      title: this.title,
      description: this.description,
      position: this.position,
      parentId: this.parentId?.getValue(),
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
