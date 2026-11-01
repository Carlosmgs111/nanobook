import type { NavigationGraphCache } from "../application/NavigationGraphCache";
import { InMemoryNavigationGraphCache } from "./InMemoryNavigationGraphCache";
import { VercelNavigationGraphCache } from "./VercelNavigationGraphCache";

export function createNavigationGraphCache(
  environment: NodeJS.ProcessEnv = process.env,
): NavigationGraphCache {
  return environment.VERCEL === "1"
    ? new VercelNavigationGraphCache()
    : new InMemoryNavigationGraphCache();
}
