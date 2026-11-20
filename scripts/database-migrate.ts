import { migrate } from "drizzle-orm/libsql/migrator";

import { client, db } from "../src/shared/infrastructure/database/drizzleDatabase";
import { getDatabaseOptions } from "../src/shared/infrastructure/database/databaseConfig";
import { describeDatabaseTarget } from "./describeDatabaseTarget";

console.log(`Migrando base de datos: ${describeDatabaseTarget(getDatabaseOptions().url)}`);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Database migrations applied.");
} finally {
  client.close();
}
