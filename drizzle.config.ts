import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",

  schema: [
    "./src/auth/server/infrastructure/better-auth/DrizzleAuthSchema.ts",
    "./src/profiles/server/infraestructure/database/DrizzleProfileSchema.ts",
  ],

  out: "./drizzle",

  dbCredentials: {
    url: "file:./data/nanobook.db",
  },
});
