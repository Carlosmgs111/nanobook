import type { Loader, LoaderContext } from "astro/loaders";

/**
 * Combines multiple Astro content loaders into a single loader.
 *
 * All loaders share the same collection store, so entries from every loader
 * become part of the same collection. If two loaders produce entries with the
 * same ID, the last loader in the array wins.
 */
export function mixed(loaders: Loader[]): Loader {
  return {
    name: "mixed-loader",
    load: async (context: LoaderContext) => {
      for (const loader of loaders) {
        await loader.load(context);
      }
    },
  };
}
