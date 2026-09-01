import type { ContentEntry, DocumentMetadata } from "../../domain/types";
import { FrontmatterParser } from "../parse/FrontmatterParser";
import type {
  ReferenceResolutionContext,
  ReferenceResolverPlugin,
} from "../../domain/reference/types";
import { fetchFileContent } from "../../../shared/github/api";
import { GITHUB_TOKEN } from "astro:env/server";
import type { DocumentReference, GitHubRef } from "../../domain/DocumentReference";

// function isGitHubRef(ref: DocumentReference): boolean {
//   if (typeof ref === "string") return ref.startsWith("github:");
//   return ref && typeof ref === "object" && ref.source === "github";
// }


export class GitHubReferenceResolver implements ReferenceResolverPlugin {
  name = "github";

  async resolve(
    ref: DocumentReference,
    context: ReferenceResolutionContext
  ): Promise<ContentEntry | null> {

    const parsed = ref.getRef()as GitHubRef;
    if (!parsed) {
      console.warn(`Invalid GitHub reference: ${JSON.stringify(ref)}`);
      return null;
    }

    try {
      const raw = await fetchFileContent({
        owner: parsed.owner,
        repo: parsed.repo,
        path: parsed.path,
        branch: parsed.branch as string,
        token: GITHUB_TOKEN,
      });

      const { data, body } = FrontmatterParser.parseFrontmatter(raw);

      return {
        id: context.sourceId,
        data: data as unknown as DocumentMetadata,
        body,
        rawFrontmatter: extractFrontmatter(raw),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `Failed to resolve GitHub reference ${JSON.stringify(ref)}: ${message}`
      );
      return null;
    }
  }
}

function extractFrontmatter(raw: string): string | undefined {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return match ? `---\n${match[1]}---\n\n` : undefined;
}
