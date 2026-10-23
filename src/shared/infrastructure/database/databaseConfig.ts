import type { DatabaseOptions } from "./createDatabase";

const DEFAULT_DATABASE_URL = "file:./data/nanobook.db";

export function getDatabaseOptions(
  environment: NodeJS.ProcessEnv = process.env
): DatabaseOptions {
  const url = environment.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
  if (environment.VERCEL === "1" && !/^libsqls?:\/\//.test(url)) {
    throw new Error("Vercel requires a remote libSQL DATABASE_URL (libsql:// or libsqls://).");
  }
  return {
    url,
    authToken: environment.DATABASE_AUTH_TOKEN || undefined,
  };
}
