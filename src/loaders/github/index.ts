import type { Loader, LoaderContext } from "astro/loaders";
import { fetchFileContent, fetchGitHubTree } from "./api";
import { createParsedEntry, matchesPattern } from "./parser";
import type { GitHubLoaderOptions, GitHubTreeItem } from "./types";

export type { GitHubLoaderOptions };

export function github(options: GitHubLoaderOptions): Loader {
  const { owner, repo, path = "", branch = "main", pattern, token } = options;

  return {
    name: "github-loader",
    load: async (context: LoaderContext) => {
      const { logger, parseData, store, generateDigest, renderMarkdown } = context;

      if (!owner || !repo) {
        logger.error("GitHub loader requires both owner and repo options.");
        return;
      }

      if (!token) {
        logger.warn(
          "GitHub loader is running without a token. Rate limits will be severely restricted."
        );
      }

      try {
        const tree = await fetchGitHubTree({ owner, repo, branch, token });
        const contentFiles = filterContentFiles(tree, path, pattern);

        if (contentFiles.length === 0) {
          logger.warn(
            `No Markdown files found in ${owner}/${repo}/${path} matching the configured pattern.`
          );
          return;
        }

        logger.info(
          `Loading ${contentFiles.length} file(s) from GitHub (${owner}/${repo}/${path})...`
        );

        for (const file of contentFiles) {
          try {
            const raw = await fetchFileContent({
              owner,
              repo,
              branch,
              token,
              path: file.path,
            });

            const { id, data, body } = createParsedEntry(file.path, raw, path);

            const parsedData = await parseData({
              id,
              data,
              filePath: file.path,
            });

            const rendered = await renderMarkdown(body);

            store.set({
              id,
              data: parsedData,
              body,
              digest: generateDigest(raw),
              filePath: file.path,
              rendered,
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            logger.error(`Failed to load GitHub file ${file.path}: ${message}`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`GitHub loader failed: ${message}`);
      }
    },
  };
}

function filterContentFiles(
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
