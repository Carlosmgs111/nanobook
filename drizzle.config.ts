import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",

  schema: [
    "./src/server/auth/infrastructure/better-auth/DrizzleAuthSchema.ts",
    "./src/server/profiles/infraestructure/database/DrizzleProfileSchema.ts",
  ],

  out: "./drizzle",

  dbCredentials: {
    url: "file:./data/nanobook.db",
  },
});
