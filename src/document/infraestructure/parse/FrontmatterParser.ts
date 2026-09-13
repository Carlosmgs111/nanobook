import { parse as parseYaml } from "yaml";
import type { DocumentMetadata } from "../../domain/types";

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const ISO_DATE_REGEX =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

const coerceDates = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(coerceDates);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, coerceDates(val)])
    );
  }

  if (typeof value === "string" && ISO_DATE_REGEX.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return value;
};
export class FrontmatterParser {
  constructor() {}

  static parseFrontmatter(raw: string): {
    data: DocumentMetadata;
    body: string;
  } {
    const match = raw.match(FRONTMATTER_REGEX);
    if (!match) {
      return { data: {} as DocumentMetadata, body: raw };
    }

    const frontmatter = match[1];
    const body = raw.slice(match[0].length);

    try {
      const data = parseYaml(frontmatter) as Record<string, unknown>;
      return { data: coerceDates(data) as DocumentMetadata, body };
    } catch (error) {
      console.error(error);
      throw new Error(
        `Failed to parse YAML frontmatter: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Extracts the raw frontmatter block (including delimiters) from a Markdown
   * string. Returns `undefined` if no frontmatter is present.
   */
  static extractFrontmatter(raw: string): string | undefined {
    const match = raw.match(FRONTMATTER_REGEX);
    return match ? `---\n${match[1]}---\n\n` : undefined;
  }
}
