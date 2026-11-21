import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import type { Element, Root } from "hast";
import { bundledLanguages, getSingletonHighlighter, type BundledLanguage } from "shiki";
import type { Plugin } from "unified";

const THEME = "github-dark";

/** Lenguajes que piden las fences del árbol (`language-xxx` en el `<code>`), tal como los escribió el autor. */
function collectLanguages(tree: Root): Set<string> {
  const found = new Set<string>();
  const walk = (parent: Root | Element): void => {
    for (const child of parent.children) {
      if (child.type !== "element") continue;
      if (child.tagName === "code" && Array.isArray(child.properties?.className)) {
        for (const name of child.properties.className) {
          if (typeof name === "string" && name.startsWith("language-")) found.add(name.slice("language-".length));
        }
      }
      walk(child);
    }
  };
  walk(tree);
  return found;
}

/**
 * Resaltado con Shiki que carga solo los lenguajes que usa cada documento.
 *
 * `@shikijs/rehype` sin `langs` carga los ~300 lenguajes empaquetados al inicializar: unos 4 s
 * locales y hasta 6 s en una función fría de Vercel, aunque el documento no tenga código.
 * Aquí el resaltador nace sin lenguajes y cada uno se carga la primera vez que aparece (unos
 * milisegundos); un lenguaje desconocido se deja como código sin resaltar, igual que antes.
 */
export const rehypeShikiLazy: Plugin<[], Root> = function () {
  let transform: Promise<(tree: Root) => unknown> | undefined;

  return async (tree) => {
    const highlighter = await getSingletonHighlighter({ themes: [THEME], langs: [] });

    const wanted = [...collectLanguages(tree)].filter((name) => Object.hasOwn(bundledLanguages, name));
    await Promise.all(wanted.map((name) => highlighter.loadLanguage(name as BundledLanguage)));

    transform ??= Promise.resolve(
      rehypeShikiFromHighlighter.call(this, highlighter, { theme: THEME }) as (tree: Root) => unknown,
    );
    await (await transform)(tree);
  };
};
