import { DocumentId } from "./DocumentId";
import type { DocumentMetadata, RefValue } from "./types";

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
  private id: DocumentId;
  private slug: string;
  private parentId: DocumentId | null;
  private position: number;
  private title: string;
  private description: string;
  private content: string;
  private metadata: DocumentMetadata;
  private rawFrontmatter: string;
  private proxyTargetId: RefValue | null;

  private constructor(
    id: DocumentId,
    overrides: Partial<DocumentMetadata> & {
      title: string;
      description: string;
    },
    body: string = ""
  ) {
    const now = new Date();
    const isIndex =
      id.getValue() === "index" || id.getValue().endsWith("/index");
    this.id = id;
    this.slug = id.getValue();
    this.parentId = id.getParentId();
    this.position = overrides.position ?? 0;
    this.title = overrides.title;
    this.description = overrides.description;
    this.content = body;
    this.proxyTargetId = overrides.ref ?? null;
    this.metadata = {
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
    };

    if (this.metadata.index !== isIndex) {
      throw new Error(
        `Inconsistencia de índice: el id "${id}" ${
          isIndex ? "es" : "no es"
        } de índice pero metadata.index=${this.metadata.index}`
      );
    }

    this.rawFrontmatter = this.interpolateTemplate(NEW_DOCUMENT_TEMPLATE, {
      title: this.metadata.title,
      description: this.metadata.description,
      date: this.metadata.date.toISOString(),
      author: this.metadata.author||"",
      index: String(this.metadata.index),
    });
  }

  getId(): DocumentId {
    return this.id;
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

  static create(
    id: string,
    data: DocumentMetadata,
    body: string = ""
  ): Document {
    const metadata = this.toDocumentMetadata(data, id);
    const documentId = new DocumentId(id);
    const newDocument = new Document(documentId, metadata, body);
    return newDocument;
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
