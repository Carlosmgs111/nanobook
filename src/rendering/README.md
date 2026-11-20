# Rendering

> Convierte Markdown en HTML con un pipeline `unified` extensible (idéntico en navegador y servidor), pinta los bloques de componentes de los documentos y cachea el HTML de cada página.

**Nivel:** Núcleo  ·  **Entornos:** shared / server / browser

## Qué hace
- Define el pipeline único Markdown → HTML (`remark-parse`, `remark-gfm`, `remark-rehype`, extensiones, `rehype-slug`, Shiki `github-dark`, `rehype-stringify`).
- Define el contrato de extensión `MarkdownExtension` (`id`, `version`, `transform(tree)` sobre hast) y falla si dos extensiones repiten `id`.
- Aporta la extensión `component-blocks`: convierte fences cuyo lenguaje está en el `BlockRegistry` en puntos de montaje `<div data-component data-props>`, validando el contenido (YAML/JSON) con el esquema zod del bloque.
- Mantiene el registro de bloques (`BlockRegistry`); cada módulo registra los suyos al componerse, de modo que solo existen los de los módulos que la aplicación incluye.
- Calcula la huella del motor (`fingerprint` = `RENDERER_VERSION` + `id@version` de cada extensión) que, junto al hash del contenido, decide la validez de la caché.
- Renderiza páginas con caché (`PageRenderer`) y la invalida al cambiar o borrarse un documento.
- Al servir, parte el HTML en piezas (`DocumentPieceResolver`) y pinta cada bloque como componente Astro (`RenderedDocument.astro` / `BlockHost.astro`).
- NO conoce `documents`, `financial-content` ni `spreadsheets`: recibe documentos por forma estructural (`PageDocument`), eventos por nombre y bloques por registro. NO hidrata en cliente por sí mismo: si un bloque es interactivo, su propio `.astro` declara `client:*`.

## Cómo está construido
```text
rendering/
  shared/                       # Pipeline puro, sin I/O; lo comparten servidor y Worker del navegador
    index.ts                    # API pública del entorno
    createMarkdownEngine.ts     # MarkdownEngine { fingerprint, render } (congela las extensiones)
    renderMarkdown.ts           # processor unified (cacheado por arreglo de extensiones en un WeakMap)
    rendererFingerprint.ts      # RENDERER_VERSION ("2") y createRendererFingerprint
    MarkdownExtension.ts        # contrato + assertUniqueExtensionIds
    componentBlocks/
      ComponentBlockDefinition.ts   # { name, component (ruta /src/...astro, texto), props (zod) }
      createBlockRegistry.ts        # register (atómico; valida nombre y ruta), find, blocks
      createComponentBlocksExtension.ts  # fence -> punto de montaje (+ marcadores en bloques de raíz)
      blockMarker.ts                # <!--nb:block-start NOMBRE PROPS_BASE64URL-->…<!--nb:block-end-->
      splitComponentBlocks.ts       # parte el HTML en segmentos html/block; nunca lanza
  server/
    index.ts                    # RenderingModule
    domain/RenderedPageCache.ts # puerto + CachedPage + PageCacheError
    application/
      PageRenderer.ts           # render / renderDocument / invalidate
      DocumentPieceResolver.ts  # segmentos -> piezas html | island (revalida props)
      invalidatePagesOnDocumentChanges.ts  # suscripción al bus por nombre de evento
    infraestructure/cache/VercelRenderedPageCache.ts  # adaptador sobre la Runtime Cache de Vercel
  browser/
    ui/RenderedDocument.astro   # pinta las piezas en orden
    ui/BlockHost.astro          # carga el componente registrado y lo pinta
    ui/blockComponents.ts       # loadBlockComponent: import.meta.glob("/src/*/browser/components/*/*.astro")
    styles/component-blocks.css
```
- **Puertos:** `RenderedPageCache` (`get(pageId, contentHash)`, `set`, `invalidate`), implementado por `VercelRenderedPageCache` (namespace `rendered-page:v1`, clave `pageId:contentHash`, etiqueta `page:<id>`, páginas de 2 MB o más no se cachean, fallos de lectura/escritura = fallo de caché). `PageDocument` y `PageSource` son contratos estructurales de entrada.
- **Eventos que consume:** `document.created`, `document.updated`, `document.deleted` (por nombre; el evento trae `documentId`). No emite eventos.
- **Paridad browser/server:** no hay un registro global; cada raíz de composición construye su motor con las mismas extensiones: `application/server/Application.ts` y `documents/browser/infraestructure/renderer/WorkerMarkdownRenderer/worker-entry.ts`. `application/shared/MarkdownRendererParity.test.ts` verifica HTML idéntico.
- **Marcadores:** solo los bloques hijos directos de la raíz llevan comentarios de bloque; los anidados (listas, citas) quedan como punto de montaje sin marcador y se muestran con su contenido alternativo.
- **Librerías:** `unified`, `remark-parse`, `remark-gfm`, `remark-rehype`, `rehype-slug`, `rehype-stringify`, `@shikijs/rehype`, `yaml`, `zod`, `@vercel/functions`.

## Cómo se usa
Punto de entrada: `rendering/shared` (`createMarkdownEngine`, `createBlockRegistry`, `createComponentBlocksExtension`, `RENDERER_VERSION`, tipos `MarkdownExtension`, `BlockRegistry`, `ComponentBlockDefinition`) y `rendering/server` (`RenderingModule` y tipos `PageRenderer`, `DocumentPieceResolver`, `RenderedPageCache`). Los `.astro` de `rendering/browser/ui/` se importan por su ruta. Fuera del módulo no se permite ninguna otra ruta interna.

`Application` (servidor) lo compone con `RenderingModule.create(eventBus)`; expone `blocks`, `markdownEngine`, `pageRenderer` y `pieceResolver`. Cada módulo con bloques recibe `renderingModule.blocks`:

```ts
const renderingModule = RenderingModule.create(eventBus);
FinancialContentModule.create(renderingModule.blocks); // blocks.register(financialBlocks)
renderingModule.blocks.register([counterDemoBlock]);
```

Definir un bloque (la ruta es texto para poder cargarse en el Worker, que no puede cargar componentes):

```ts
export const counterDemoBlock: ComponentBlockDefinition = {
  name: "counter-demo", // /^[a-z][a-z0-9-]*$/
  component: "/src/application/browser/components/CounterDemo/CounterDemo.astro",
  props: counterDemoProps, // zod
};
```

Un documento lo invoca con una fence cuyo lenguaje es el nombre del bloque; si el contenido no valida, se emite `div.component-block-error` en lugar del bloque. Páginas: `await renderingModule.pageRenderer.renderDocument(document)` devuelve `{ rendered, headings, contentHash }`; `<RenderedDocument html={...} context={...} />` pinta el resultado (`context` es opaco y se reenvía a los bloques). Rutas que lo usan: las páginas de `documents/browser/ui/pages` (`DocumentPage`, `EditPage`, `NewPage`, `PreviewPage`). No expone endpoints HTTP propios.

## Dependencias
- **Depende de:** `shared` (`Result`, errores, `EventBus`/`DomainEvent`) y librerías externas. Ningún módulo de negocio.
- **Lo usan:** `application` (compone `RenderingModule`, el motor del Worker y el bloque demo), `documents` (páginas, preview y Worker), `financial-content` y `spreadsheets` (registran bloques en `BlockRegistry`; solo importan `rendering/shared`).
- **Acoplamiento a vigilar:** `blockComponents.ts` descubre componentes con el glob `/src/*/browser/components/*/*.astro`: la convención de carpeta es un contrato implícito. `RenderedDocument.astro` ya no importa `application`: recibe el `pieceResolver` como prop desde la página que lo compone (`DocumentPage.astro`), de modo que `boundary.test.ts` pasa.

## Seguridad y autorización
No aplica: no decide acceso. Las props se validan con zod al renderizar y de nuevo al servir (`DocumentPieceResolver`), porque vienen de HTML cacheado; si ya no validan se muestra el contenido alternativo. El HTML de las piezas `html` se inyecta con `set:html`, y el contenido sale del pipeline propio (hast sin HTML crudo, por defecto de `remark-rehype`). El control de lectura del documento lo hace quien llama (`application`/`authorization`).

## Pruebas
Junto al código: `shared/*.test.ts`, `shared/componentBlocks/*.test.ts`, `server/RenderingModule.test.ts`, `server/application/*.test.ts`, `server/infraestructure/cache/VercelRenderedPageCache.test.ts` y `boundary.test.ts` (solo se entra por `rendering/shared`, `rendering/server` o `rendering/browser/ui/*.astro`, y no se importan otros módulos). Paridad en `application/shared/MarkdownRendererParity.test.ts`. Ejecutar: `npx vitest run src/rendering`.

## Decisiones y límites conocidos
- `RenderedDocument.astro` recibe `pieceResolver` por props (antes llamaba a `getApp()`, lo que rompía `boundary.test.ts`). No existen en el código `mountComponentBlocks` ni `componentRegistry`: no hay montaje cliente propio; los bloques se pintan en servidor con Astro y, si procede, el propio `.astro` los hidrata.
