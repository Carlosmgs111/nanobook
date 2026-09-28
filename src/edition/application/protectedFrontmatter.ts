import { parse, stringify } from "yaml";

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const PROTECTED_FIELDS = [
  "id",
  "author",
  "createdAt",
  "updatedAt",
] as const;

export function hideProtectedFrontmatter(raw: string): string {
  const match = raw.match(FRONTMATTER_REGEX);
  if (!match) return raw;

  try {
    const data = (parse(match[1]) ?? {}) as Record<string, unknown>;
    for (const field of PROTECTED_FIELDS) delete data[field];
    return `---\n${stringify(data)}---\n`;
  } catch {
    return raw;
  }
}
