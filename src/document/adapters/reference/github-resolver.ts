import type {
  ContentEntry,
  DocumentMetadata,
  RefValue,
} from "../../model/types";
import { parseFrontmatter } from "../../parse/frontmatter";
import type {
  ReferenceResolutionContext,
  ReferenceResolverPlugin,
} from "../../reference/types";
import { fetchFileContent } from "../github-loader/api";

const DEFAULT_BRANCH = "main";

function isGitHubRef(ref: RefValue): boolean {
  if (typeof ref === "string") return ref.startsWith("github:");
  return ref && typeof ref === "object" && ref.source === "github";
}

function parseGitHubRef(
  ref: RefValue,
): { owner: string; repo: string; path: string; branch: string } | null {
  if (typeof ref === "string") {
    const withoutPrefix = ref.slice("github:".length);
    const atIndex = withoutPrefix.lastIndexOf("@");
    const spec = atIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, atIndex);
    const branch = atIndex === -1 ? DEFAULT_BRANCH : withoutPrefix.slice(atIndex + 1);

    const firstSlash = spec.indexOf("/");
    if (firstSlash === -1) return null;
    const owner = spec.slice(0, firstSlash);

    const secondSlash = spec.indexOf("/", firstSlash + 1);
    if (secondSlash === -1) return null;
    const repo = spec.slice(firstSlash + 1, secondSlash);
    const path = spec.slice(secondSlash + 1);

    if (!owner || !repo || !path) return null;
    return { owner, repo, path, branch };
  }

  if (ref && typeof ref === "object" && ref.source === "github") {
    const r = ref as {
      owner: string;
      repo: string;
      path: string;
      branch?: string;
    };
    if (!r.owner || !r.repo || !r.path) return null;
    return {
      owner: r.owner,
      repo: r.repo,
      path: r.path,
      branch: r.branch ?? DEFAULT_BRANCH,
    };
  }

  return null;
}

/**
 * Resolutor para referencias a documentos en repositorios de GitHub.
 *
 * Soporta:
 * - Forma corta: `ref: github:owner/repo/path/to/doc.md`
 * - Con rama: `ref: github:owner/repo/path/to/doc.md@main`
 * - Forma estructurada: `ref: { source: "github", owner, repo, path, branch? }`
 */
export class GitHubReferenceResolver implements ReferenceResolverPlugin {
  name = "github";

  canResolve(ref: RefValue): boolean {
    return isGitHubRef(ref);
  }

  async resolve(
    ref: RefValue,
    context: ReferenceResolutionContext,
  ): Promise<ContentEntry | null> {
    const parsed = parseGitHubRef(ref);
    if (!parsed) {
      console.warn(`Invalid GitHub reference: ${JSON.stringify(ref)}`);
      return null;
    }

    try {
      const raw = await fetchFileContent({
        owner: parsed.owner,
        repo: parsed.repo,
        path: parsed.path,
        branch: parsed.branch,
        token: context.githubToken,
      });

      const { data, body } = parseFrontmatter(raw);

      return {
        id: context.sourceId,
        data: data as DocumentMetadata,
        body,
        rawFrontmatter: extractFrontmatter(raw),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `Failed to resolve GitHub reference ${JSON.stringify(ref)}: ${message}`,
      );
      return null;
    }
  }
}

function extractFrontmatter(raw: string): string | undefined {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return match ? `---\n${match[1]}---\n\n` : undefined;
}
