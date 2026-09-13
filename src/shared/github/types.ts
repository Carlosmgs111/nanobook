export interface GitHubRepositoryConfig {
  /** GitHub owner or organization name. */
  owner: string;
  /** Repository name. */
  repo: string;
  /** Base path inside the repository where content lives. */
  path?: string;
  /** Branch or ref to read from. */
  branch?: string;
  /** Glob pattern(s) to filter files under `path`. */
  pattern?: string | string[];
  /** GitHub personal access token. */
  token?: string;
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: string;
  sha: string;
  url: string;
  size?: number;
}
