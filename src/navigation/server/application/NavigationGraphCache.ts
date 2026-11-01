import type {
  DocumentsGraph,
  NavigationGraphSnapshot,
} from "../domain/types";

export interface CachedNavigationGraph extends DocumentsGraph {
  toSnapshot(): NavigationGraphSnapshot;
}

export interface NavigationGraphCache {
  getOrCreate(
    nanobookId: string,
    build: () => Promise<CachedNavigationGraph>,
  ): Promise<CachedNavigationGraph>;
  refresh(
    nanobookId: string,
    build: () => Promise<CachedNavigationGraph>,
  ): Promise<CachedNavigationGraph>;
}
