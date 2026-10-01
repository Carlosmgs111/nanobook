import type { DocumentMetadata } from "./types";

export async function hashString(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(buffer).toString("hex");
}

export function serializeMetadata(metadata: DocumentMetadata): string {
  return JSON.stringify({
    title: metadata.title,
    description: metadata.description,
    position: metadata.position,
    draft: metadata.draft,
    ref: metadata.ref,
    cover: metadata.cover,
    tags: metadata.tags,
    author: metadata.author,
    createdAt: metadata.createdAt?.toISOString(),
    updatedAt: metadata.updatedAt?.toISOString(),
  });
}
