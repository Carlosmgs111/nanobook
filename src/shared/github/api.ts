const GITHUB_API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";

interface GitHubFileContentOptions {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  token?: string;
}

export async function fetchFileContent(
  options: GitHubFileContentOptions,
): Promise<string> {
  return options.token
    ? fetchFileContentFromApi(options)
    : fetchFileContentFromRaw(options);
}

async function fetchFileContentFromRaw({
  owner,
  repo,
  branch,
  path,
}: GitHubFileContentOptions): Promise<string> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodeURIComponent(path)}`;
  const response = await fetch(url, { headers: { "User-Agent": "nanobook" } });
  if (!response.ok) {
    throw new Error(
      `GitHub raw error ${response.status} ${response.statusText} fetching "${path}": ${await response.text().catch(() => "Unknown error")}`,
    );
  }
  return response.text();
}

async function fetchFileContentFromApi({
  owner,
  repo,
  branch,
  path,
  token,
}: GitHubFileContentOptions): Promise<string> {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,
    { headers: getHeaders(token) },
  );
  if (!response.ok) {
    throw new Error(
      `GitHub API error ${response.status} ${response.statusText} fetching "${path}": ${await response.text().catch(() => "Unknown error")}`,
    );
  }
  const data = (await response.json()) as { content: string };
  return Buffer.from(data.content, "base64").toString("utf-8");
}

function getHeaders(token?: string): Record<string, string> {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": "nanobook",
  };
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}
