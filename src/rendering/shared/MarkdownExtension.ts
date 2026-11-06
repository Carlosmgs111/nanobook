import type { Root } from "hast";

export interface MarkdownExtension {
  readonly id: string;
  readonly version: string;
  readonly fenceLanguages: readonly string[];
  transform(tree: Root): void;
}

export function assertUniqueExtensionIds(extensions: readonly MarkdownExtension[]): void {
  const ids = new Set<string>();
  for (const { id } of extensions) {
    if (ids.has(id)) throw new Error(`Duplicate Markdown extension id: ${id}`);
    ids.add(id);
  }
}
