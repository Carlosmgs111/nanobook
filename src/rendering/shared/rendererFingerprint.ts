import { assertUniqueExtensionIds, type MarkdownExtension } from "./MarkdownExtension";

export const RENDERER_VERSION = "2";

function escapeFingerprintPart(value: string): string {
  return value.replaceAll("%", "%25").replaceAll("|", "%7C").replaceAll("@", "%40");
}

export function createRendererFingerprint(
  coreVersion: string,
  extensions: readonly MarkdownExtension[],
): string {
  assertUniqueExtensionIds(extensions);
  const extensionParts = extensions.map(({ id, version }) =>
    `${escapeFingerprintPart(id)}@${escapeFingerprintPart(version)}`,
  );
  return [escapeFingerprintPart(coreVersion), ...extensionParts].join("|");
}
