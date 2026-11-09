import { getViteConfig } from "astro/config";

/**
 * Pruebas que renderizan componentes `.astro` con la Container API. Necesitan el
 * plugin de Astro, así que van en su propia configuración (`*.astro.test.ts`) y
 * no mezclan su entorno con el resto de la suite.
 */
export default getViteConfig({
  test: {
    globals: false,
    environment: "node",
    pool: "forks",
    include: ["src/**/*.astro.test.ts"],
  },
});
