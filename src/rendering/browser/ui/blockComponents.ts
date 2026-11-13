type AstroComponent = (props: Record<string, unknown>) => unknown;

/**
 * Tabla de búsqueda ruta → módulo. El registro decide qué bloques existen y
 * cada pieza trae la ruta de su componente; esto solo lo carga, al primer uso.
 */
const blockComponentLoaders = import.meta.glob<{ default: AstroComponent }>("/src/*/browser/components/*/*.astro");

export async function loadBlockComponent(component: string): Promise<AstroComponent> {
  const load = blockComponentLoaders[component];
  if (!load) throw new Error(`El componente de bloque registrado no existe: ${component}`);
  return (await load()).default;
}
