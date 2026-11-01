import type { DocumentSourceCache } from "../../application/DocumentSourceCache";
import { InMemoryDocumentSourceCache } from "./InMemoryDocumentSourceCache";
import { VercelDocumentSourceCache } from "./VercelDocumentSourceCache";

export function createDocumentSourceCache(environment: NodeJS.ProcessEnv = process.env): DocumentSourceCache {
  return environment.VERCEL === "1" ? new VercelDocumentSourceCache() : new InMemoryDocumentSourceCache();
}
