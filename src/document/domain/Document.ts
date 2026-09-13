import { Result } from "../../shared/utils/result";
import { DocumentId } from "./DocumentId";
import { DocumentReference } from "./DocumentReference";
import type { DocumentMetadata, Entry } from "./types";
import { hashString, serializeMetadata } from "./hash";
import type { DocumentParser } from "./DocumentParser";
import { InvalidDocumentError, InvalidDocumentIdError } from "./errors";

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

export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

export interface DocumentHash {
  id: string;
  contentHash: string;
  metadataHash: string;
}

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
    parser: DocumentParser | null = null
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
    if (this.metadata.index !== isIndex) {
      throw new Error(
        `Inconsistencia de índice: el id "${id.getValue()}" ${
          isIndex ? "es" : "no es"
        } de índice pero metadata.index=${this.metadata.index}`
      );
    }

    this.rawFrontmatter = this.interpolateTemplate(NEW_DOCUMENT_TEMPLATE, {
      title: this.metadata.title,
      description: this.metadata.description,
      date: this.metadata.date.toISOString(),
      author: this.metadata.author || "",
      index: String(this.metadata.index),
    });
  }
  async computeContentHash(): Promise<string> {
    return await hashString(this.content);
  }

  async hashDocument(): Promise<DocumentHash> {
    return {
      id: this.id.getValue(),
      contentHash: await this.computeContentHash(),
      metadataHash: await hashString(serializeMetadata(this)),
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
      headings: this.getHeadings()
    };
  }

  static create(
    id: string,
    data: DocumentMetadata,
    body: string = "",
    parser: DocumentParser | null = null
  ): Result<InvalidDocumentError | InvalidDocumentIdError, Document> {
    const idResult = DocumentId.create(id);
    if (!idResult.isSuccess) {
      return Result.fail(idResult.getError());
    }

    try {
      return Result.ok(new Document(idResult.getValue(), data, body, parser));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail(new InvalidDocumentError(id, message));
    }
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
