---
id: "bloques-de-componentes-2026-11-06"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Bloques de componentes en Markdown"
description: "Cómo un documento usa componentes mediante fences: un único mecanismo basado en Astro, con componentes .astro de solo servidor, componentes de framework de solo servidor e islas hidratadas."
date: 2026-11-06
author: "Nanobook"
tags: ["nanobook", "arquitectura", "renderizado"]
draft: false
---

# Bloques de componentes en Markdown

El renderizador es una función de texto a texto y no ejecuta código de
componentes. Los documentos referencian un componente por nombre y la página lo
materializa con Astro. `rendering` aporta solo el **mecanismo**; los componentes
concretos pertenecen al módulo que los expone.

Hay **un único mecanismo**. Lo que cambia entre bloques es qué archivo los
implementa y si se hidratan:

| Archivo del componente | `hydrate` en el `.block.ts` | Resultado | Ejemplo |
|---|---|---|---|
| `.astro` | no se admite | HTML del servidor, sin JavaScript | `financial-metrics` y las demás fichas |
| `.tsx` `.jsx` `.vue` `.svelte` | ausente | HTML del servidor, sin JavaScript | (disponible) |
| `.tsx` `.jsx` `.vue` `.svelte` | `load` · `idle` · `visible` | HTML del servidor e isla hidratada (`client:*`) | `price-chart`, `counter-demo` |

Ver `componentes-de-framework-islas` para el porqué de este diseño.

## Declaración

Dos archivos hermanos en `src/<módulo>/browser/components/`:

```text
Nombre.astro         el componente (o .tsx .jsx .vue .svelte)
Nombre.block.ts      nombre de la fence, esquema zod de props y, si hace falta, hydrate
```

`Nombre.block.ts` exporta por defecto un `ComponentBlockDefinition`:

```ts
const definition: ComponentBlockDefinition = {
  name: "price-chart",     // lenguaje de la fence
  hydrate: "visible",      // opcional; sin él, solo HTML del servidor
  props: priceChartProps,  // esquema zod
};
```

Debe importar solo `zod`, el tipo del contrato y, si quiere reutilizar un esquema,
el `shared/` de su propio módulo (que por convención no depende de frameworks ni de
Node), porque lo cargan el servidor y el Worker de la vista previa (una prueba lo
comprueba). El componente recibe como props el valor ya validado, con los
`default` aplicados. Las props son datos JSON: sin funciones ni `Date`.

## Mecanismo genérico (`rendering`)

`createComponentBlocksExtension({ id, version, definitions })` devuelve una
`MarkdownExtension`. Cuando el lenguaje de una fence coincide con
`definition.name`, parsea el contenido como YAML (JSON incluido), lo valida con
el esquema zod y lo sustituye por un punto de montaje con la fence original como
contenido alternativo. Si no valida, emite un `div.component-block-error` con el
motivo.

Si la fence es **hija directa de la raíz** del documento, además rodea el punto de
montaje con un par de comentarios (`blockMarker.ts`):

```html
<!--nb:block-start NOMBRE PROPS_BASE64URL-->
<div class="component-block" …>…</div>
<!--nb:block-end-->
```

Las props van en base64url porque su alfabeto no contiene `>`. Los bloques
anidados (listas, citas) y los inválidos no llevan marcadores: partir el HTML
dentro de un elemento rompería su etiqueta. Un comentario escrito a mano no
sobrevive al render (`remarkRehype` descarta el HTML crudo), así que los marcadores
solo pueden salir de la extensión. `splitComponentBlocks(html)` (pura, nunca
lanza) parte el HTML en segmentos ordenados `html` / `block`.

## Descubrimiento y composición

- `application/shared/componentBlockDefinitions.ts` reúne los `*.block.ts` con
  `import.meta.glob` (TypeScript puro, resoluble en servidor, Worker y pruebas) y
  valida export por defecto, nombre (`^[a-z][a-z0-9-]*$`) y unicidad.
- `application/shared/createMarkdownExtensions.ts` los registra como **una sola**
  extensión, `component-blocks`, y comprueba con `assertUniqueFenceLanguages` que
  ninguna fence esté reclamada dos veces. Es la única lista que consumen la
  publicación y la vista previa.

## El host generado

Astro solo admite una directiva `client:*` en un componente importado
**directamente** en un `.astro` y usado con una etiqueta estática. Por eso
`npm run blocks:generate` (`scripts/generate-component-blocks.ts`) escribe en
`application/browser/ui/generated/`:

- `ComponentBlockHost.astro`: una importación y una etiqueta por componente, con
  la directiva escrita como literal: `<BlockN {...props} client:visible />`, o sin
  directiva si el bloque no declara `hydrate`.
- `ssrBlockNames.ts`: los nombres que el host sabe pintar.

`discoverBlocks` empareja cada `Nombre.block.ts` con su `Nombre.<ext>` (`.astro`,
`.tsx`, `.jsx`, `.vue`, `.svelte`) y aborta si falta el componente, hay más de uno,
el nombre es inválido o repetido, `hydrate` no es una directiva conocida, o un
`.astro` pide hidratarse. `renderHostSource` es determinista y sin E/S. Los
archivos generados **se versionan**; `generatedFilesAreFresh.test.ts` falla si
están desactualizados. `dev`, `build` y `dev:preview` generan antes de arrancar.

## Flujo de una página publicada

```text
Markdown → renderMarkdown → HTML con marcadores ─→ caché
        → DocumentPage.astro → RenderedDocument.astro
            → resolveDocumentPieces(html)   (split + validación de props)
                ├ html     → <Fragment set:html>
                └ bloque   → <ComponentBlockHost name props>
                               ├ .astro / sin hydrate → HTML del servidor
                               └ con hydrate          → <astro-island client:*>
```

`resolveDocumentPieces` vuelve a validar las props (el HTML viene de caché). Todo
lo que no pueda pintarse —nombres sin host, bloques anidados, props que ya no
validan— vuelve a su punto de montaje original, así que nunca se pierde contenido.

Los componentes **no pasan por la caché del Markdown**: Astro los renderiza dentro
de la página en cada petición. Para plantillas pequeñas el costo es mínimo; si
llegara a importar, un `.astro` sin hidratación admite una caché de fragmentos
(Container API) con clave `(bloque, hash de props, versión)` sin cambiar el
contrato.

## Quién aporta qué

`financial-content` (dueño de sus componentes):

- `browser/components/`: `FinancialMetrics`, `FinancialChart`, `FinancialNews`,
  `FinancialSources` y `CompanyProfile` (`.astro` + `.block.ts`, solo servidor) y
  `PriceChart.tsx` + `.block.ts` (isla de React, `hydrate: "visible"`).
- `browser/ui/`: parciales `.astro` (`FinancialTime`, `FinancialPeriod`,
  `ExternalLink`, `SourceDates`) y `blockIndex.ts`, que numera los bloques de cada
  petición (`Astro.request`) para que los `id` de las fichas sean únicos.
- `shared/components/financialBlockProps.ts`: esquema de props de cada ficha;
  inyecta el `kind` (lo fija la fence, el autor no lo escribe) y traduce las
  incidencias de zod al mensaje en español del contrato.
- `shared/validation/`: esquemas estrictos (`FinancialBlockSchemas`), mensajes
  (`financialIssueMessages`) y el validador de documentos.
- `shared/chart/`: geometría y modelo de vista puro del gráfico SVG
  (`createChartView`); el `.astro` solo dibuja.
- `shared/guide/`, `shared/formatting/` y estilos en
  `browser/ui/styles/financial-content.css`.

`application` (composición): `createMarkdownExtensions`, `componentBlockDefinitions`,
`resolveDocumentPieces`, `server/generateComponentBlocks/`,
`browser/ui/RenderedDocument.astro` y `browser/ui/generated/`.
`createMarkdownBlockAdvisor` valida contra la misma lista de definiciones.

## Añadir un componente

1. Crear `Nombre.astro` (o `.tsx`, `.jsx`, `.vue`, `.svelte`) y `Nombre.block.ts`
   en `src/<módulo>/browser/components/`.
2. Si debe hidratarse, declarar `hydrate` en el `.block.ts` (solo componentes de
   framework).
3. Ejecutar `npm run blocks:generate` y versionar los archivos generados.
4. Si el framework es nuevo, instalar su integración de Astro y añadirla a
   `integrations` en `astro.config.mjs`.
5. Probar un `.astro` con la Container API: un archivo `*.astro.test.ts` se ejecuta
   con `npm run test:astro` (`vitest.astro.config.ts`).

## Límites

- Solo se ejecutan componentes registrados; un autor no puede subir código.
- **Bloques anidados** (dentro de una lista o una cita) no se renderizan como
  componente: muestran su contenido alternativo. Solo los bloques de raíz cuentan.
- **Vista previa del editor:** el Worker no puede ejecutar Astro, así que ningún
  componente (ni `.astro` ni isla) se ve renderizado: aparece su contenido
  alternativo. Pendiente de otra sesión.
- **Sin contenido hijo:** un bloque recibe solo props, no Markdown anidado.
- **YAML:** los bloques se parsean con `yaml.parse` estándar. Se perdió el parser
  endurecido de las fichas antiguas (rechazo de alias, etiquetas y `__proto__`);
  la validación estricta del esquema se conserva.
- **Contenido guardado por el editor:** al abrir un documento editado y guardado en
  la misma sesión, `DocumentPageController` sustituiría el cuerpo por el HTML del
  Worker, que no puede renderizar bloques (deja la fence en texto) y puede ser de
  otra versión del código. Para evitarlo, `DocumentPage` marca `#document-body` con
  `data-has-blocks` cuando la página pinta algún bloque (`documentHasBlocks`), sea
  isla o solo servidor, y el controlador no sustituye nada si la marca existe (o si
  hay un `astro-island`). Un documento sin bloques se sustituye como antes.
- Las props son JSON validado con zod: sin funciones ni `Date`.
- Los colores de `price-chart` se leen de `--theme-*` al hidratar y no se
  actualizan al cambiar de tema sin recargar.
- Un cambio de esquema, o de la forma del HTML que emite la extensión, debe subir
  la `version` de la extensión para invalidar la caché de páginas renderizadas
  (hoy `component-blocks@2`).
- En desarrollo, `lightweight-charts` figura en `vite.optimizeDeps.include` para
  evitar el 504 `Outdated Optimize Dep` en la primera carga.
- El host generado importa todos los componentes en el bundle del servidor; el
  cliente solo descarga los de las islas presentes en la página.
- La hidratación real con `client:visible` depende de `IntersectionObserver`; el
  panel de navegador de la herramienta de desarrollo no entrega esos eventos.
