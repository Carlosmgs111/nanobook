import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

const client = createClient({
  url: "file:./data/nanobook.db",
});

export const db = drizzle(client);
