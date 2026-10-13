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

/** Creates the instance database connection without exposing its credentials. */
export function createDatabase(options: DatabaseOptions): DatabaseConnection {
  const client = createClient({
    url: options.url,
    authToken: options.authToken,
  });

  return {
    client,
    db: drizzle(client),
  };
}
