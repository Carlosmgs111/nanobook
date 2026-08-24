import { getCollection, type CollectionEntry } from "astro:content";


let cachedEntries: Map<string, CollectionEntry<"content">> | null = null;

export async function getAstroEntries(): Promise<
  Map<string, CollectionEntry<"content">>
> {
  if (cachedEntries) return cachedEntries;

  const collection = await getCollection("content");
  cachedEntries = new Map(collection.map((entry) => [entry.id, entry]));
  return cachedEntries;
}
