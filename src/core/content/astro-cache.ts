import { getCollection, type CollectionEntry } from "astro:content";

/**
 * Cache a nivel de módulo de las entradas crudas de Astro.
 *
 * Tanto AstroCollectionRepository como AstroMarkdownRenderer necesitan
 * acceder a las CollectionEntry originales. Este cache evita llamar
 * repetidamente a getCollection("content") durante el build.
 */
let cachedEntries: Map<string, CollectionEntry<"content">> | null = null;

export async function getAstroEntries(): Promise<
  Map<string, CollectionEntry<"content">>
> {
  if (cachedEntries) return cachedEntries;

  const collection = await getCollection("content");
  cachedEntries = new Map(collection.map((entry) => [entry.id, entry]));
  return cachedEntries;
}
