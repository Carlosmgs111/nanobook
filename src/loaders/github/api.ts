import type { GitHubLoaderOptions, GitHubTreeItem } from "./types";

const GITHUB_API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";

function getHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": "nanobook-github-loader",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchJson<T>(url: string, token?: string): Promise<T> {
  const response = await fetch(url, { headers: getHeaders(token) });
  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(
      `GitHub API error ${response.status} ${response.statusText}: ${text}`,
    );
  }
  return response.json() as Promise<T>;
}

export async function fetchGitHubTree(
  options: Required<Pick<GitHubLoaderOptions, "owner" | "repo" | "branch">> &
    Pick<GitHubLoaderOptions, "token">,
): Promise<GitHubTreeItem[]> {
  const { owner, repo, branch, token } = options;
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const data = await fetchJson<{ tree: GitHubTreeItem[] }>(url, token);
  return data.tree;
}

export async function fetchFileContent(
  options: Required<Pick<GitHubLoaderOptions, "owner" | "repo" | "branch">> &
    Pick<GitHubLoaderOptions, "token"> & { path: string },
): Promise<string> {
  const { owner, repo, branch, token, path } = options;
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const data = await fetchJson<{ content: string; encoding: string }>(url, token);

  if (data.encoding !== "base64") {
    throw new Error(`Unexpected encoding for ${path}: ${data.encoding}`);
  }

  return Buffer.from(data.content, "base64").toString("utf-8");
}
