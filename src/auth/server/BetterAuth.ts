import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";

import { db } from "../../shared/infrastructure/database/drizzleDatabase";
import * as authSchema from "./DrizzleAuthSchema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: authSchema,
  }),

  emailAndPassword: {
    enabled: true,
  },
});
