import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",

  schema: [
    "./src/auth/server/infrastructure/better-auth/DrizzleAuthSchema.ts",
    "./src/profiles/server/infraestructure/database/DrizzleProfileSchema.ts",
    "./src/nanobooks/server/infraestructure/database/DrizzleNanobookSchema.ts",
    "./src/documents/server/infraestructure/database/DrizzleDocumentSchema.ts",
    "./src/documents/server/infraestructure/database/DrizzleDocumentRevisionSchema.ts",
    "./src/theme/server/infraestructure/database/DrizzleThemeSchema.ts",
    "./src/agents/server/infrastructure/database/DrizzleAgentAuditSchema.ts",
  ],

  out: "./drizzle",

  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:./data/nanobook.db",
    ...(process.env.DATABASE_AUTH_TOKEN
      ? { authToken: process.env.DATABASE_AUTH_TOKEN }
      : {}),
  },
});
