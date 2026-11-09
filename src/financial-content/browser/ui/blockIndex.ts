const counters = new WeakMap<object, number>();

/**
 * Número de orden (desde 0) de un bloque dentro de la petición que se está
 * renderizando. Sirve para que los `id` de cada ficha sean únicos en el
 * documento. Se pasa `Astro.request`: es el mismo objeto para todos los
 * componentes de una petición y distinto entre peticiones, así que no hay
 * estado compartido ni que reiniciar.
 */
export function nextBlockIndex(request: object): number {
  const index = counters.get(request) ?? 0;
  counters.set(request, index + 1);
  return index;
}
