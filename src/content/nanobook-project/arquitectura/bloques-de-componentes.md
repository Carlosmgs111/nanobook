---
id: "bloques-de-componentes-2026-11-06"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Bloques de componentes en Markdown"
description: "Cómo un documento usa componentes mediante fences: montaje en cliente (vanilla) y componentes de framework (.tsx, .vue, .svelte) con SSR e hidratación como islas de Astro."
date: 2026-11-06
author: "Nanobook"
tags: ["nanobook", "arquitectura", "renderizado"]
draft: false
---

# Bloques de componentes en Markdown

El renderizador es una función de texto a texto y no ejecuta código de
componentes. Los documentos referencian un componente por nombre y la página lo
materializa. `rendering` aporta solo el **mecanismo**; los componentes concretos
pertenecen al módulo que los expone.

Hay dos clases de componente, que conviven:

| Clase | Se escribe como | Dónde se ejecuta | Ejemplo |
|---|---|---|---|
| Vanilla | Un montador `(element, props) => cleanup?` registrado por el módulo | Solo navegador, tras descargar la librería | `price-chart` (`financial-content`) |
| De framework | Un archivo nativo (`.tsx`, `.jsx`, `.vue`, `.svelte`) junto a un `.block.ts` | Servidor (SSR) y navegador (hidratación) | `price-chart-island`, `counter-demo` (demostración) |

Ver `componentes-de-framework-islas` para el porqué de este diseño.

## Mecanismo genérico (`rendering`)

**Servidor y vista previa** (`rendering/shared/componentBlocks`):
`createComponentBlocksExtension({ id, version, definitions })` devuelve una
`MarkdownExtension`. Cuando el lenguaje de una fence coincide con
`definition.name`, parsea el contenido como YAML (JSON incluido), lo valida con
el esquema zod de la definición y lo sustituye por:

```html
<div class="component-block" data-component="price-chart" data-props='{...}'>
  <pre>…fence original como contenido alternativo…</pre>
</div>
```

Si no valida, emite un `div.component-block-error` con el motivo.

Si la fence es **hija directa de la raíz** del documento, además rodea ese `div`
con un par de comentarios (`blockMarker.ts`):

```html
<!--nb:block-start NOMBRE PROPS_BASE64URL-->
<div class="component-block" …>…</div>
<!--nb:block-end-->
```

Las props van en base64url porque su alfabeto no contiene `>`, así que el
comentario siempre termina donde debe. Los bloques anidados (listas, citas) y los
inválidos no llevan marcadores: partir el HTML dentro de un elemento rompería su
etiqueta. Un comentario escrito a mano en el Markdown no sobrevive al render
(`remarkRehype` descarta el HTML crudo), por lo que los marcadores solo pueden
salir de la extensión.

`splitComponentBlocks(html)` (función pura, nunca lanza) parte el HTML en
segmentos ordenados `html` / `block`. Un marcador ilegible o sin cierre queda
como HTML.

**Navegador, componentes vanilla** (`rendering/browser`):
`registerComponentBlocks(entries)` permite a cada módulo registrar
`nombre → cargador diferido`; registrar un nombre ya tomado por otro cargador
falla. `installComponentBlocks()` monta cada `[data-component]` presente y los que
aparezcan después (`MutationObserver` sobre `<html>`, no sobre `<body>`: el router
de Astro sustituye el `<body>` al navegar sin recargar, y un observador pegado al
anterior no vería la página nueva; además se reescanea en `astro:page-load`). La
librería solo se descarga en páginas que usen el bloque.

`rendering` no importa ningún módulo de negocio.

## Componentes de framework (SSR e hidratación)

### Declaración

Dos archivos hermanos en `src/<módulo>/browser/components/`:

```text
Counter.tsx          el componente, con la extensión de su librería (.tsx .jsx .vue .svelte)
Counter.block.ts     nombre de la fence y esquema zod de props (TypeScript puro)
```

`Counter.block.ts` exporta por defecto un `ComponentBlockDefinition`. Debe
importar solo `zod`, el tipo del contrato y, si quiere reutilizar un esquema, el
`shared/` de su propio módulo (`../../shared/…`, que por convención no depende de
frameworks ni de Node), porque lo cargan el servidor y el Worker de la vista
previa (una prueba lo comprueba). El componente exporta por
defecto y recibe como props el valor ya validado por el esquema, con los
`default` aplicados. Las props son datos JSON: sin funciones ni `Date`.

### Descubrimiento y composición

- `application/shared/componentBlockDefinitions.ts` reúne los `*.block.ts` con
  `import.meta.glob` (son TypeScript puro, así que Vite los resuelve en servidor,
  Worker y pruebas) y valida export por defecto, nombre
  (`^[a-z][a-z0-9-]*$`) y unicidad.
- `application/shared/createMarkdownExtensions.ts` los registra como la extensión
  `component-blocks` y comprueba con `assertUniqueFenceLanguages` que ninguna
  fence esté reclamada por dos extensiones.

### El host generado

Astro solo hidrata un componente de framework importado **directamente** en un
`.astro` y usado con una etiqueta estática; con una etiqueta dinámica
(`const C = registro[nombre]`) las directivas `client:*` no se admiten. Por eso
`npm run blocks:generate` (`scripts/generate-component-blocks.ts`) escribe en
`application/browser/ui/generated/`:

- `ComponentBlockHost.astro`: una importación y una etiqueta
  `<BlockN {...props} client:visible />` por componente.
- `ssrBlockNames.ts`: los nombres que el host sabe pintar.

`discoverBlocks` empareja cada `Nombre.block.ts` con su `Nombre.<ext>` y aborta
si falta el componente, hay más de uno, el nombre es inválido o está repetido.
`renderHostSource` es determinista y sin E/S. Los archivos generados **se
versionan**; `generatedFilesAreFresh.test.ts` falla si están desactualizados.
`dev`, `build` y `dev:preview` ejecutan la generación antes de arrancar (se
encadena con `npm run`, sin ganchos `pre*`, que pnpm no siempre ejecuta).

### Flujo de una página publicada

```text
Markdown → renderMarkdown → HTML con marcadores ─→ caché (formato sin cambios)
        → DocumentPage.astro → RenderedDocument.astro
            → resolveDocumentPieces(html)   (split + validación de props)
                ├ html   → <Fragment set:html>
                └ isla   → <ComponentBlockHost name props> → SSR + <astro-island client:visible>
```

`resolveDocumentPieces` vuelve a validar las props (el HTML viene de caché).
Todo lo que no pueda ser isla —`price-chart`, nombres sin host, props que ya no
validan— vuelve a su punto de montaje original, así que nunca se pierde
contenido. El navegador hidrata cada isla cuando entra en el viewport; los
`div.component-block` que quedan son los que `installComponentBlocks` monta.

## Quién aporta qué

`financial-content`:

- `shared/components/priceChart.ts`: nombre y esquema de props de `price-chart`,
  más `financialComponentBlockDefinitions`.
- `shared/rendering/createFinancialContentExtensions.ts`: devuelve, en orden,
  la extensión de fichas (`financial-content`) y la de componentes
  (`financial-components`, versión `2`: sus bloques de raíz llevan marcadores).
- `browser/components/priceChart.ts`: montador con `lightweight-charts`.
- `browser/financialComponentMounts.ts`: mapa nombre → cargador diferido.
- Estilos propios en `browser/ui/styles/financial-content.css`.

`application` (composición):

- `shared/createMarkdownExtensions.ts`: una sola lista para servidor y Worker.
- `shared/componentBlockDefinitions.ts`, `shared/resolveDocumentPieces.ts`.
- `server/generateComponentBlocks/`: `discoverBlocks`, `renderHostSource`,
  `buildGeneratedFiles`.
- `browser/ui/RenderedDocument.astro` y `browser/ui/generated/`.
- `browser/installComponentBlocks.ts`: registra los montadores vanilla de cada
  módulo; `Layout.astro` lo importa.

## Añadir un componente

**De framework:**

1. Crear `Nombre.tsx` (o `.jsx`, `.vue`, `.svelte`) y `Nombre.block.ts` en
   `src/<módulo>/browser/components/`.
2. Ejecutar `npm run blocks:generate` y versionar los archivos generados
   (`dev` y `build` lo hacen solos al arrancar).
3. Si el framework es nuevo, instalar su integración de Astro
   (`@astrojs/vue`, `@astrojs/svelte`…) y añadirla a `integrations` en
   `astro.config.mjs`. Si conviven dos frameworks que comparten `.jsx` o `.tsx`
   (React, Preact, Solid), cada integración necesita su opción `include`.

**Vanilla:**

1. Definir nombre y esquema de props y añadirlo a las definiciones del módulo.
2. Escribir su montador `(element, props) => cleanup?` y añadirlo al mapa de
   montadores del módulo.
3. Si el módulo es nuevo, registrar sus extensiones en
   `createMarkdownExtensions.ts` y sus montadores en `installComponentBlocks.ts`.

Un test por módulo verifica que toda definición vanilla tenga montador.

## Componentes actuales

**`price-chart`** (vanilla) usa TradingView `lightweight-charts`. Series `line`,
`area` o `candlestick`:

````md
```price-chart
title: ACME
height: 320
series:
  type: candlestick
  data:
    - { time: 2026-01-02, open: 10, high: 12, low: 9, close: 11 }
```
````

Un ejemplo largo con datos sintéticos está en `docs/examples/price-chart-demo.md`.

**`price-chart-island`** (framework, React) es una versión de `price-chart`
independiente de la original, con el mismo esquema de props
(`financial-content/browser/components/PriceChartIsland.tsx` y
`PriceChartIsland.block.ts`). El servidor entrega la figura con su título, el
hueco del alto exacto y un resumen en texto de la serie (`describePriceChart`),
así que hay contenido antes de cargar JavaScript y sin él; el gráfico se dibuja
tras hidratar, porque `lightweight-charts` necesita el DOM. El dibujo vive en
`createPriceChart.ts`, que comparten esta isla y el montador vanilla; la isla lo
importa de forma diferida, de modo que la librería no se evalúa en el servidor.
El contenedor del gráfico no tiene hijos de React para que la librería pueda
poblarlo sin que React lo vea. En la vista previa del editor se ve solo su
contenido alternativo (límite general de las islas). `price-chart` no cambia.

**`counter-demo`** (framework, React) es una demostración del mecanismo
(`application/browser/components/CounterDemo.tsx`). Se puede borrar, junto con su
`.block.ts`, cuando exista el primer componente real. Un documento de prueba con
todos los casos está en `docs/examples/framework-component-demo.md`.

## Límites

- Solo se ejecutan componentes registrados; un autor no puede subir código.
- **Bloques de framework anidados** (dentro de una lista o una cita) no se
  hidratan: muestran su contenido alternativo. Solo los bloques de raíz son islas.
- **Vista previa del editor:** el Worker no puede ejecutar el SSR de Astro, así que
  los componentes de framework se ven con su contenido alternativo; los vanilla
  se montan en vivo como siempre.
- La directiva de hidratación es fija (`client:visible`); las directivas `client:*`
  no admiten valores dinámicos.
- Las props son JSON validado con zod: sin funciones ni `Date`.
- Los colores de `price-chart` se leen de las variables `--theme-*` al montar y no
  se actualizan al cambiar de tema sin recargar.
- Un cambio de esquema, o de la forma del HTML que emite una extensión, debe subir
  la `version` de esa extensión para invalidar la caché de páginas renderizadas.
- En desarrollo, `lightweight-charts` figura en `vite.optimizeDeps.include` para
  evitar el 504 `Outdated Optimize Dep` en la primera carga. Con React no se
  observó ese problema.
- El host generado importa todos los componentes de framework en el bundle del
  servidor; el cliente solo descarga los de las islas presentes en la página.
