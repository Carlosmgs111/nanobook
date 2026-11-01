import { getCache, type RuntimeCache } from "@vercel/functions";
import type {
  CachedNavigationGraph,
  NavigationGraphCache,
} from "../application/NavigationGraphCache";
import type { NavigationGraphSnapshot } from "../domain/types";
import { DocumentsGraph } from "./DocumentsGraph";

const CACHE_NAMESPACE = "nanobook-navigation-graph-v1";
const CACHE_TTL_SECONDS = 300;

function isNavigationGraphSnapshot(value: unknown): value is NavigationGraphSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as { nodes?: unknown; edges?: unknown };
  return Array.isArray(snapshot.nodes) && Array.isArray(snapshot.edges);
}

export class VercelNavigationGraphCache implements NavigationGraphCache {
  private readonly pending = new Map<string, Promise<CachedNavigationGraph>>();

  constructor(
    private readonly runtimeCache: RuntimeCache = getCache({
      namespace: CACHE_NAMESPACE,
    }),
  ) {}

  getOrCreate(
    nanobookId: string,
    build: () => Promise<CachedNavigationGraph>,
  ): Promise<CachedNavigationGraph> {
    return this.pending.get(nanobookId) ?? this.replace(nanobookId, async () => {
      const cached = await this.runtimeCache.get(nanobookId);
      if (isNavigationGraphSnapshot(cached)) {
        return DocumentsGraph.fromSnapshot(cached);
      }

      const graph = await build();
      await this.store(nanobookId, graph);
      return graph;
    });
  }

  refresh(
    nanobookId: string,
    build: () => Promise<CachedNavigationGraph>,
  ): Promise<CachedNavigationGraph> {
    return this.replace(nanobookId, async () => {
      const graph = await build();
      await this.store(nanobookId, graph);
      return graph;
    });
  }

  private replace(
    nanobookId: string,
    build: () => Promise<CachedNavigationGraph>,
  ): Promise<CachedNavigationGraph> {
    const entry = Promise.resolve().then(build);
    this.pending.set(nanobookId, entry);

    return entry.finally(() => {
      if (this.pending.get(nanobookId) === entry) {
        this.pending.delete(nanobookId);
      }
    });
  }

  private store(nanobookId: string, graph: CachedNavigationGraph): Promise<void> {
    return this.runtimeCache.set(nanobookId, graph.toSnapshot(), {
      name: `navigation:${nanobookId}`,
      ttl: CACHE_TTL_SECONDS,
    });
  }
}
