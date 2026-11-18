import { parse, stringify } from "yaml";
import { PROTECTED_FRONTMATTER_FIELDS } from "../domain/model/protectedFrontmatterFields";

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function hideProtectedFrontmatter(raw: string): string {
  const match = raw.match(FRONTMATTER_REGEX);
  if (!match) return raw;

  try {
    const data = (parse(match[1]) ?? {}) as Record<string, unknown>;
    for (const field of PROTECTED_FRONTMATTER_FIELDS) delete data[field];
    return `---\n${stringify(data)}---\n`;
  } catch {
    return raw;
  }
}
