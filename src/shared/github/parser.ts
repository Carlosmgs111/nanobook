import picomatch from "picomatch";
import type { GitHubRepositoryConfig, GitHubTreeItem } from "./types";

export function matchesPattern(
  filePath: string,
  pattern: GitHubRepositoryConfig["pattern"],
): boolean {
  if (!pattern) return filePath.endsWith(".md");

  const patterns = Array.isArray(pattern) ? pattern : [pattern];
  const positive = patterns.filter((p) => !p.startsWith("!"));
  const negative = patterns.filter((p) => p.startsWith("!")).map((p) => p.slice(1));

  const isMatch = picomatch(positive, { dot: true });
  const isIgnored = picomatch(negative, { dot: true });

  return isMatch(filePath) && !isIgnored(filePath);
}

export function filterContentFiles(
  tree: GitHubTreeItem[],
  basePath: string,
  pattern: GitHubRepositoryConfig["pattern"]
): GitHubTreeItem[] {
  const prefix = basePath ? `${basePath}/` : "";

  return tree.filter((item) => {
    if (item.type !== "blob") return false;
    if (!item.path.startsWith(prefix)) return false;
    return matchesPattern(item.path, pattern);
  });
}
