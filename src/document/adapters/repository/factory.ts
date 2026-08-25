import { FileSystemRepository } from "./file-system-repository";
import type { ContentRepository } from "../../model/types";

export type RepositorySource = "astro" | "filesystem" | "github";

/**
 * Crea una implementación de ContentRepository según la fuente configurada.
 *
 * - `astro`: usa AstroCollectionRepository, que aprovecha getCollection y
 *   resuelve proxies. Solo funciona en build time de Astro.
 * - `filesystem`: usa FileSystemRepository, que lee directamente desde
 *   src/content. Funciona en runtime y en scripts standalone, pero aún no
 *   resuelve proxies.
 * - `github`: no implementado todavía. Se añadirá en una fase posterior.
 *
 * La fuente se lee de la variable de entorno CONTENT_SOURCE. Si no está
 * definida, se usa `astro` para mantener compatibilidad con el comportamiento
 * previo.
 *
 * La función es asíncrona porque AstroCollectionRepository se importa de forma
 * perezosa; esto permite que los tests y scripts que usan filesystem no
 * dependan de "astro:content".
 */
export async function createContentRepository(
  source: RepositorySource = getConfiguredSource(),
): Promise<ContentRepository> {
  switch (source) {
    case "astro": {
      const { AstroCollectionRepository } = await import(
        "./astro-collection-repository"
      );
      return new AstroCollectionRepository();
    }
    case "filesystem":
      return new FileSystemRepository();
    case "github":
      throw new Error(
        "GitHubRepository is not implemented yet. Use CONTENT_SOURCE=astro or filesystem.",
      );
    default:
      throw new Error(`Unsupported content source: ${source}`);
  }
}

function getConfiguredSource(): RepositorySource {
  const env =
    typeof process !== "undefined" ? process.env.CONTENT_SOURCE : undefined;

  if (env === "filesystem" || env === "github" || env === "astro") {
    return env;
  }

  return "astro";
}
