export interface NanobookAlias {
  legacyPath: string;
  nanobookId: string;
  targetPath: string;
}

export function normalizeNanobookAliasPath(path: string): string {
  const normalized = path.trim().replace(/^\/+|\/+$/g, "");
  return normalized || "index";
}
