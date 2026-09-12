import type { GitHubLoaderOptions, GitHubTreeItem } from "./types";
import { getCached, setCached, buildCacheKey } from "./cache";

const GITHUB_API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

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
      `GitHub API error ${response.status} ${response.statusText}: ${text}`
    );
  }
  return response.json() as Promise<T>;
}

export async function fetchGitHubTree(
  options: Required<Pick<GitHubLoaderOptions, "owner" | "repo" | "branch">> &
    Pick<GitHubLoaderOptions, "token">
): Promise<GitHubTreeItem[]> {
  const { owner, repo, branch, token } = options;
  const cacheKey = buildCacheKey("tree", owner, repo, branch);

  const cached = await getCached<GitHubTreeItem[]>(cacheKey, DEFAULT_CACHE_TTL);
  if (cached) {
    return cached;
  }

  console.log("fetchGitHubTree");
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const data = await fetchJson<{ tree: GitHubTreeItem[] }>(url, token);
  await setCached(cacheKey, data.tree, DEFAULT_CACHE_TTL);
  return data.tree;
}

export async function fetchFileContent(
  options: Required<Pick<GitHubLoaderOptions, "owner" | "repo" | "branch">> &
    Pick<GitHubLoaderOptions, "token"> & { path: string }
): Promise<string> {
  const { owner, repo, branch, path } = options;
  const cacheKey = buildCacheKey("file", owner, repo, branch, path);

  const cached = await getCached<string>(cacheKey, DEFAULT_CACHE_TTL);
  if (cached !== null) {
    return cached;
  }

  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodeURIComponent(
    path
  )}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "nanobook-github-loader",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(
      `GitHub raw error ${response.status} ${response.statusText}: ${text}`
    );
  }

  const content = await response.text();
  await setCached(cacheKey, content, DEFAULT_CACHE_TTL);
  return content;
}

interface GitHubContentResponse {
  sha: string;
}

export async function fetchFileSha(
  options: Required<Pick<GitHubLoaderOptions, "owner" | "repo" | "branch">> &
    Pick<GitHubLoaderOptions, "token"> & { path: string }
): Promise<string | null> {
  const { owner, repo, branch, path, token } = options;
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(
    path
  )}?ref=${branch}`;

  const response = await fetch(url, { headers: getHeaders(token) });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(
      `GitHub API error ${response.status} ${response.statusText}: ${text}`
    );
  }

  const data = (await response.json()) as GitHubContentResponse;
  return data.sha;
}

export async function updateFileContent(
  options: Required<Pick<GitHubLoaderOptions, "owner" | "repo" | "branch">> &
    Pick<GitHubLoaderOptions, "token"> & {
      path: string;
      content: string;
      sha?: string;
      message?: string;
    }
): Promise<void> {
  const {
    owner,
    repo,
    branch,
    path,
    content,
    sha,
    token,
    message = `Update ${path}`,
  } = options;
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(
    path
  )}`;

  // console.log({ content });

  const body: Record<string, string> = {
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
    branch,
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: getHeaders(token),
    body: JSON.stringify(body),
  });

  // console.log("response from github ", response);

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(
      `GitHub API error ${response.status} ${response.statusText}: ${text}`
    );
  }
}
