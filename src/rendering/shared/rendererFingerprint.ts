import { assertUniqueExtensionIds, type MarkdownExtension } from "./MarkdownExtension";

export const RENDERER_VERSION = "2";

export function createRendererFingerprint(
  coreVersion: string,
  extensions: readonly MarkdownExtension[],
): string {
  assertUniqueExtensionIds(extensions);
  return [coreVersion, ...extensions.map(({ id, version }) => `${id}@${version}`)].join("|");
}
