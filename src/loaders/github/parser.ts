import { parse as parseYaml } from "yaml";
import type { GitHubLoaderOptions, ParsedEntry } from "./types";

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

export function parseFrontmatter(raw: string): {
  data: Record<string, unknown>;
  body: string;
} {
  const match = raw.match(FRONTMATTER_REGEX);
  if (!match) {
    return { data: {}, body: raw };
  }

  const frontmatter = match[1];
  const body = raw.slice(match[0].length);

  try {
    const data = parseYaml(frontmatter) as Record<string, unknown>;
    return { data: coerceDates(data), body };
  } catch (error) {
    throw new Error(
      `Failed to parse YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function coerceDates(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(coerceDates);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, coerceDates(val)]),
    );
  }

  if (typeof value === "string" && ISO_DATE_REGEX.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return value;
}

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
  if (withoutExt.endsWith("/index")) {
    return (withoutExt.slice(0, -"/index".length) || "index").toLowerCase();
  }

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

  const matchesPositive = positive.some((p) => matchGlob(filePath, p));
  const matchesNegative = negative.some((p) => matchGlob(filePath, p));

  return matchesPositive && !matchesNegative;
}

function matchGlob(path: string, pattern: string): boolean {
  const regex = globToRegex(pattern);
  return regex.test(path);
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, ".")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export function createParsedEntry(
  filePath: string,
  raw: string,
  basePath: string | undefined,
): ParsedEntry {
  const { data, body } = parseFrontmatter(raw);
  const id = generateId(filePath, basePath);
  return { id, data, body, raw, path: filePath };
}
