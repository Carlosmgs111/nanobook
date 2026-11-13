---
id: "bloques-de-componentes-2026-11-06"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Bloques de componentes en Markdown"
description: "Cómo un documento usa componentes mediante fences: un registro explícito de bloques en rendering y componentes .astro que Astro renderiza, con o sin hidratación."
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

Hay **un único mecanismo** y un **registro explícito**: cada bloque se declara en
una lista, no se descubre. Todo componente registrado es un `.astro`; si debe
hidratarse, **el propio `.astro` declara la directiva** `client:*` sobre su
componente de framework.

| Componente registrado | Resultado | Ejemplo |
|---|---|---|
| `.astro` de solo plantilla | HTML del servidor, sin JavaScript | `financial-metrics` y las demás fichas |
| `.astro` que envuelve un componente de framework con `client:visible` (o `load`, `idle`) | HTML del servidor e isla hidratada | `price-chart`, `counter-demo` |

Ver `componentes-de-framework-islas` para el porqué de este diseño.

## Registro

`rendering` expone `registerBlocks(definiciones)` y el tipo `ComponentBlockDefinition`:

```ts
interface ComponentBlockDefinition {
  name: string;       // lenguaje de la fence
  component: string;  // ruta del .astro desde la raíz: "/src/<módulo>/…/Nombre.astro"
  props: ZodType;     // esquema zod del contenido de la fence
}
```

`component` es un texto y no un import para que el registro sea un dato puro que
también cargue el Worker de la vista previa, que no puede cargar componentes.
`registerBlocks` falla, nombrando el bloque, si el nombre no cumple
`^[a-z][a-z0-9-]*$`, está repetido o la ruta no es un `.astro` bajo `/src/`.

Cada módulo exporta sus bloques como lista (`financial-content/browser/blocks.ts`) y
`application/shared/blocks.ts` los junta con los suyos, produciendo
`blockDefinitions`, la **única lista** que consumen, vía `RenderingModule`, la extensión de
Markdown, la página y el asesor del MCP.

Cada bloque vive en su propia carpeta, `src/<módulo>/browser/components/<Nombre>/`:

```text
PriceChart/
  PriceChart.astro        lo que se registra; aquí vive la directiva client:visible
  PriceChartIsland.tsx    el componente de framework que se hidrata
  PriceChart.schema.ts    esquema zod de props
  …                       su lógica, ayudas y pruebas (createPriceChart.ts, priceChartSummary.ts, *.test.ts)
```

```astro
---
import PriceChartIsland from "./PriceChartIsland.tsx";
---
<PriceChartIsland {...Astro.props} client:visible />
```

Un `.schema.ts` y las listas de bloques deben importar solo `zod`, el tipo del
contrato y el `shared/` de su propio módulo (que por convención no depende de
frameworks ni de Node), porque los carga también el Worker. El componente recibe
como props el valor ya validado, con los `default` aplicados. Las props son datos
JSON: sin funciones ni `Date`.

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

## Composición y host

`rendering` sigue el patrón compositor del resto de módulos: `RenderingModule.create(definiciones)`
(`rendering/server/index.ts`) recibe la lista de bloques, instancia las piezas y las expone como
campos; nadie más importa piezas internas.

| Campo | Qué es |
|---|---|
| `blocks` | El registro (`find`, `blocks`); lo usa el asesor del MCP para validar. |
| `markdownEngine` | El motor Markdown → HTML con la extensión `component-blocks`; expone `render(source)` y un `fingerprint` de caché. |
| `pieceResolver` | `DocumentPieceResolver`: `resolve(html)` parte el HTML renderizado en piezas, cada una con la ruta de su componente. |

**Fronteras.** `rendering` no importa ningún otro módulo y solo se entra por tres puertas
(las vigila `rendering/boundary.test.ts`):

- `rendering/shared`: `createMarkdownEngine`, `registerBlocks`, `createComponentBlocksExtension` y los tipos
  del contrato (`ComponentBlockDefinition`, `BlockRegistry`, `MarkdownExtension`, `MarkdownEngine`).
- `rendering/server`: `RenderingModule` y `DocumentPiece`.
- `rendering/browser/ui`: los componentes de la vista (`RenderedDocument.astro`, `BlockHost.astro`).

Quien necesita renderizar recibe el motor ya construido, a través de un puerto propio:
`PublishingModule.create(eventBus, markdownEngine)` y el `UnifiedMarkdownRenderer` del Worker reciben un
objeto con `render`; ninguno importa `renderMarkdown` ni la huella de caché. El cableado se hace en
`application/server/Application.ts` y en `worker-entry.ts`, que usan la misma extensión y por tanto
producen el mismo HTML (`application/shared/MarkdownRendererParity.test.ts` lo comprueba).

La lista de bloques es `application/shared/blocks.ts` (`blockDefinitions`, datos puros). Cada
entorno crea el módulo con ella:

- `application/server/Application.ts`: `renderingModule`; pasa `markdownEngine` a
  `PublishingModule`, `blocks` al asesor del MCP y lo expone a las páginas.
- `worker-entry.ts` (vista previa): crea su propio módulo con la misma lista.
- `DocumentPage.astro` llama a `app.renderingModule.pieceResolver.resolve` y pasa las piezas a
  `RenderedDocument.astro`, que no conoce el registro.
- `rendering/browser/ui/blockComponents.ts` convierte la ruta de una pieza en componente con
  `import.meta.glob("/src/*/browser/components/*/*.astro")`; es solo una tabla de búsqueda. Una
  prueba (`blocks.test.ts`) comprueba que cada ruta registrada existe.
- `BlockHost.astro` pinta el componente con una etiqueta dinámica. Astro no admite `client:*` en
  una etiqueta dinámica, y por eso la directiva vive dentro del componente registrado.

## Flujo de una página publicada

```text
Markdown → renderMarkdown → HTML con marcadores ─→ caché
        → DocumentPage.astro → RenderedDocument.astro
            → renderingModule.pieceResolver.resolve(html)   (split + validación de props)
                ├ html     → <Fragment set:html>
                └ bloque   → <BlockHost component props>  (componente registrado, etiqueta dinámica)
                               ├ solo plantilla       → HTML del servidor
                               └ con client:* propio  → <astro-island client:*>
```

`pieceResolver.resolve` vuelve a validar las props (el HTML viene de caché). Todo
lo que no pueda pintarse —nombres no registrados, bloques anidados, props que ya
no validan— vuelve a su punto de montaje original, así que nunca se pierde contenido.

Los componentes **no pasan por la caché del Markdown**: Astro los renderiza dentro
de la página en cada petición. Para plantillas pequeñas el costo es mínimo; si
llegara a importar, un `.astro` sin hidratación admite una caché de fragmentos
(Container API) con clave `(bloque, hash de props, versión)` sin cambiar el
contrato.

## Quién aporta qué

`financial-content` (dueño de sus componentes):

- `browser/components/<Nombre>/`: una carpeta por bloque. `FinancialMetrics`,
  `FinancialChart`, `FinancialNews`, `FinancialSources` y `CompanyProfile` (`.astro` y
  `.schema.ts`, solo servidor) y `PriceChart` (`.astro` con `client:visible` más
  `PriceChartIsland.tsx`, `createPriceChart` y `priceChartSummary`). `FinancialChart`
  incluye además `ChartGeometry` y `chartView` (modelo de vista puro; el `.astro`
  solo dibuja).
- `browser/blocks.ts`: la lista de sus bloques (nombre, ruta del `.astro` y esquema).
- `browser/ui/`: parciales `.astro` (`FinancialTime`, `FinancialPeriod`,
  `ExternalLink`, `SourceDates`) y `blockIndex.ts`, que numera los bloques de cada
  petición (`Astro.request`) para que los `id` de las fichas sean únicos.
- `shared/components/financialBlockProps.ts`: envuelve el esquema de cada ficha;
  inyecta el `kind` (lo fija la fence, el autor no lo escribe) y traduce las
  incidencias de zod al mensaje en español del contrato.
- `shared/validation/`: las primitivas comunes de los esquemas
  (`financialPrimitives`: texto, fecha, URL, fuentes, periodo…), los mensajes
  (`financialIssueMessages`) y el validador de documentos. El esquema de cada ficha
  vive en la carpeta de su bloque.
- `shared/guide/`, `shared/formatting/` y estilos en
  `browser/ui/styles/financial-content.css`.

`application` (composición): `shared/blocks.ts` (la lista), `RenderingModule` inyectado en
`Application`. Los componentes de la vista (`RenderedDocument.astro`, `BlockHost.astro`, `blockComponents.ts`) viven en `rendering/browser/ui`.
`createMarkdownBlockAdvisor(blocks)` valida contra el mismo registro.

## Añadir un componente

1. Crear la carpeta `src/<módulo>/browser/components/Nombre/` con `Nombre.astro` y
   `Nombre.schema.ts`. Si debe hidratarse, añadir también el componente de
   framework (`NombreIsland.tsx`, `.vue`, `.svelte`…) e importarlo en `Nombre.astro`
   con `client:visible` (o `load`, `idle`).
2. Añadir el bloque (nombre, ruta del `.astro` y esquema) a la lista de su módulo
   (`browser/blocks.ts`); si el módulo es nuevo, registrar su lista en
   `application/shared/blocks.ts`.
3. Si el framework es nuevo, instalar su integración de Astro y añadirla a
   `integrations` en `astro.config.mjs`.
4. Probar un `.astro` con la Container API: un archivo `*.astro.test.ts` se ejecuta
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
- Los componentes se cargan bajo demanda en el servidor; el cliente solo descarga
  los de las islas presentes en la página.
- Un `.astro` que contiene una isla y se pinta con etiqueta dinámica se hidrata con
  normalidad (comprobado en desarrollo y en el build de producción).
- La hidratación real con `client:visible` depende de `IntersectionObserver`; el
  panel de navegador de la herramienta de desarrollo no entrega esos eventos.
