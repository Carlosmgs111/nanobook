import type {
  CachedNavigationGraph,
  NavigationGraphCache,
} from "../application/NavigationGraphCache";

export class InMemoryNavigationGraphCache implements NavigationGraphCache {
  private readonly entries = new Map<string, Promise<CachedNavigationGraph>>();

  getOrCreate(
    nanobookId: string,
    build: () => Promise<CachedNavigationGraph>
  ): Promise<CachedNavigationGraph> {
    return this.entries.get(nanobookId) ?? this.replace(nanobookId, build);
  }

  refresh(
    nanobookId: string,
    build: () => Promise<CachedNavigationGraph>
  ): Promise<CachedNavigationGraph> {
    return this.replace(nanobookId, build);
  }

  private replace(
    nanobookId: string,
    build: () => Promise<CachedNavigationGraph>
  ): Promise<CachedNavigationGraph> {
    const entry = Promise.resolve().then(build);
    this.entries.set(nanobookId, entry);

    return entry.catch((error: unknown) => {
      if (this.entries.get(nanobookId) === entry) {
        this.entries.delete(nanobookId);
      }
      throw error;
    });
  }
}
