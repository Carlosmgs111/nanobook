import { migrate } from "drizzle-orm/libsql/migrator";

import { client, db } from "../src/shared/infrastructure/database/drizzleDatabase";

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Database migrations applied.");
} finally {
  client.close();
}
