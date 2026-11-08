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

/** Dos extensiones no pueden reclamar la misma fence: la segunda no se aplicaría nunca. */
export function assertUniqueFenceLanguages(extensions: readonly MarkdownExtension[]): void {
  const owners = new Map<string, string>();
  for (const { id, fenceLanguages } of extensions) {
    for (const language of fenceLanguages) {
      const owner = owners.get(language);
      if (owner !== undefined) {
        throw new Error(`Duplicate Markdown fence language "${language}" claimed by extensions "${owner}" and "${id}"`);
      }
      owners.set(language, id);
    }
  }
}
