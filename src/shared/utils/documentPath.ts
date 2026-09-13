export interface ToDocumentIdOptions {
  /** Prefix to strip from the beginning of the path. */
  basePath?: string;
  /** Convert the resulting id to lowercase. */
  lowercase?: boolean;
}

/**
 * Converts a file path into a document id.
 *
 * - Normalizes Windows backslashes to forward slashes.
 * - Removes the optional `basePath` prefix.
 * - Strips the `.md` extension.
 * - Optionally lowercases the result.
 */
export function toDocumentId(
  filePath: string,
  options: ToDocumentIdOptions = {}
): string {
  let normalized = filePath.replace(/\\/g, "/");
  const prefix = options.basePath ? `${options.basePath}/` : "";
  if (prefix && normalized.startsWith(prefix)) {
    normalized = normalized.slice(prefix.length);
  }
  const withoutExt = normalized.replace(/\.md$/, "");
  return options.lowercase ? withoutExt.toLowerCase() : withoutExt;
}
