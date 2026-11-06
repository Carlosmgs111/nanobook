import { getComponentLoader } from "./componentRegistry";

const SELECTOR = "[data-component]:not([data-component-state])";
const cleanups = new Map<HTMLElement, () => void>();

async function mountBlock(element: HTMLElement): Promise<void> {
  const name = element.dataset.component;
  const load = name ? getComponentLoader(name) : undefined;
  if (!load) return;

  element.dataset.componentState = "loading";
  try {
    const props: unknown = JSON.parse(element.dataset.props ?? "{}");
    const mount = await load();
    if (!element.isConnected) return;
    const cleanup = mount(element, props);
    if (cleanup) cleanups.set(element, cleanup);
    element.dataset.componentState = "mounted";
  } catch (error) {
    element.dataset.componentState = "error";
    console.error(`No se pudo montar el componente "${name}"`, error);
  }
}

function scan(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(SELECTOR).forEach((element) => void mountBlock(element));
}

function release(): void {
  for (const [element, cleanup] of cleanups) {
    if (element.isConnected) continue;
    cleanup();
    cleanups.delete(element);
  }
}

let installed = false;

/**
 * Monta los `[data-component]` presentes y los que aparezcan después (vista
 * previa del editor, navegación con transiciones). Es idempotente.
 */
export function installComponentBlocks(): void {
  if (installed) return;
  installed = true;

  const refresh = () => {
    release();
    scan(document);
  };

  scan(document);
  // Se observa `<html>`, no `<body>`: el router de Astro sustituye el `<body>`
  // al navegar sin recargar, y un observador pegado al anterior dejaría de ver
  // la página nueva (los bloques solo se montaban tras una recarga completa).
  new MutationObserver(refresh).observe(document.documentElement, { childList: true, subtree: true });
  // Respaldo explícito para cuando la navegación termina sin mutaciones visibles.
  document.addEventListener("astro:page-load", refresh);
}
