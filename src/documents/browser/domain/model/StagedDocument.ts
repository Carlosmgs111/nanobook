import type { SerializedEntry } from "../../../server";

export type { SerializedEntry };

export interface RenderedPreview {
  Content: string;
}

export interface CachedPreview {
  rendered: RenderedPreview;
  source: SerializedEntry;
}

/** Igualdad estructural de dos versiones serializadas del mismo documento. */
export function sameDocument(
  a: SerializedEntry | null,
  b: SerializedEntry | null
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
