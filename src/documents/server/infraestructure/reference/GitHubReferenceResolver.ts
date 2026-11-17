import { GITHUB_TOKEN } from "astro:env/server";
import { fetchFileContent } from "../../../../shared/github/api";
import type { DocumentReference } from "../../domain/DocumentReference";
import type { ReferenceResolver } from "../../domain/reference/types";
import type { ContentEntry } from "../../domain/types";
import { FrontmatterParser } from "../parse/FrontmatterParser";

export class GitHubReferenceResolver implements ReferenceResolver {
  async resolve(ref: DocumentReference): Promise<ContentEntry | null> {
    const parsed = ref.getRef();
    if (parsed.source !== "github") return null;

    try {
      const raw = await fetchFileContent({
        owner: parsed.owner,
        repo: parsed.repo,
        path: parsed.path,
        branch: parsed.branch ?? "main",
        token: GITHUB_TOKEN,
      });
      const { data, body } = FrontmatterParser.parseFrontmatter(raw);
      return { data, body };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to resolve GitHub reference ${JSON.stringify(parsed)}: ${message}`);
      return null;
    }
  }
}
