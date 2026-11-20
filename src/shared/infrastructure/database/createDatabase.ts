import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

export interface DatabaseOptions {
  url: string;
  authToken?: string;
}

export interface DatabaseConnection {
  client: Client;
  db: LibSQLDatabase<Record<string, never>>;
}

/** Creates the parent directory of a local `file:` database so a clean checkout can open it. */
function ensureLocalDatabaseDirectory(url: string): void {
  if (!url.startsWith("file:")) return;
  const location = url.slice("file:".length).split("?")[0];
  if (!location || location === ":memory:") return;
  mkdirSync(dirname(location), { recursive: true });
}

/** Creates the instance database connection without exposing its credentials. */
export function createDatabase(options: DatabaseOptions): DatabaseConnection {
  ensureLocalDatabaseDirectory(options.url);
  const client = createClient({
    url: options.url,
    authToken: options.authToken,
  });

  return {
    client,
    db: drizzle(client),
  };
}
