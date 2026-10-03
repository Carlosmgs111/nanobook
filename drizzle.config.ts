import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",

  schema: ["./src/auth/server/DrizzleAuthSchema.ts"],

  out: "./drizzle",

  dbCredentials: {
    url: "file:./data/nanobook.db",
  },
});
