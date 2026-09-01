import picomatch from "picomatch";
import { FrontmatterParser } from "../../document/infraestructure/parse/FrontmatterParser";
import type { GitHubLoaderOptions, GitHubTreeItem, ParsedEntry } from "./types";

export function generateId(
  filePath: string,
  basePath: string | undefined,
): string {
  const prefix = basePath ? `${basePath}/` : "";
  const relativePath = filePath.startsWith(prefix)
    ? filePath.slice(prefix.length)
    : filePath;
  const withoutExt = relativePath.replace(/\.md$/, "");

  // Align with Astro's glob loader convention:
  // blog/index.md -> blog, index.md -> index
  // if (withoutExt.endsWith("/index")) {
  //   return (withoutExt.slice(0, -"/index".length) || "index").toLowerCase();
  // }

  return withoutExt.toLowerCase();
}

export function matchesPattern(
  filePath: string,
  pattern: GitHubLoaderOptions["pattern"],
): boolean {
  if (!pattern) return filePath.endsWith(".md");

  const patterns = Array.isArray(pattern) ? pattern : [pattern];
  const positive = patterns.filter((p) => !p.startsWith("!"));
  const negative = patterns.filter((p) => p.startsWith("!")).map((p) => p.slice(1));

  const isMatch = picomatch(positive, { dot: true });
  const isIgnored = picomatch(negative, { dot: true });

  return isMatch(filePath) && !isIgnored(filePath);
}

export function createParsedEntry(
  filePath: string,
  raw: string,
  basePath: string | undefined,
): ParsedEntry {
  const { data, body } = FrontmatterParser.parseFrontmatter(raw);
  const id = generateId(filePath, basePath);
  return { id, data, body, raw, path: filePath };
}



export function filterContentFiles(
  tree: GitHubTreeItem[],
  basePath: string,
  pattern: GitHubLoaderOptions["pattern"]
): GitHubTreeItem[] {
  const prefix = basePath ? `${basePath}/` : "";

  return tree.filter((item) => {
    if (item.type !== "blob") return false;
    if (!item.path.startsWith(prefix)) return false;
    return matchesPattern(item.path, pattern);
  });
}
