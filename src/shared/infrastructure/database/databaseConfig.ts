import type { DatabaseOptions } from "./createDatabase";

const DEFAULT_DATABASE_URL = "file:./data/nanobook.db";

export function getDatabaseOptions(
  environment: NodeJS.ProcessEnv = process.env
): DatabaseOptions {
  return {
    url: environment.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL,
    authToken: environment.DATABASE_AUTH_TOKEN || undefined,
  };
}
