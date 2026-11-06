/** Monta un componente en `element` y devuelve la función que lo desmonta. */
export type ComponentMount = (element: HTMLElement, props: unknown) => void | (() => void);

/** Importación diferida de un montador: la librería solo se descarga si la página lo usa. */
export type ComponentLoader = () => Promise<ComponentMount>;

const loaders = new Map<string, ComponentLoader>();

/**
 * Cada módulo registra aquí los componentes que expone; `rendering` no conoce
 * ninguno. Registrar de nuevo el mismo cargador es inocuo (recarga en caliente);
 * un nombre ya tomado por otro cargador es un conflicto y falla.
 */
export function registerComponentBlocks(entries: Readonly<Record<string, ComponentLoader>>): void {
  for (const [name, loader] of Object.entries(entries)) {
    const existing = loaders.get(name);
    if (existing && existing !== loader) throw new Error(`Component block already registered: ${name}`);
    loaders.set(name, loader);
  }
}

export function getComponentLoader(name: string): ComponentLoader | undefined {
  return loaders.get(name);
}
