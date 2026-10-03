import type { APIRoute } from "astro";

import { auth } from "./BetterAuth";

export const AuthController: APIRoute = async ({ request }) => {
  return auth.handler(request);
};