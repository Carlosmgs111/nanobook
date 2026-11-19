# Extensible Shared Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar la semántica Markdown de publicación y vista previa, añadir extensiones opcionales con manifiesto estable y versionar la caché según el conjunto activo sin cambiar la salida de los documentos existentes.

**Architecture:** Un nuevo núcleo browser-compatible en `src/rendering/shared` será la única configuración Unified/Remark/Rehype. `publishing/server` y `documents/browser` conservarán sus puertos y adaptarán ese núcleo a sus contratos; las raíces de aplicación suministrarán extensiones sin que el núcleo conozca módulos de negocio.

**Tech Stack:** TypeScript, Unified, Remark, Rehype, Shiki, Astro 7, Web Workers, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-05-financial-content-blocks-design.md`

## Global Constraints

- Trabajar en `codex/rendering-extensions`, creada desde `main` en un worktree aislado.
- Markdown y frontmatter continúan como fuente de verdad; no se introduce MDX, JSX, HTML ni JavaScript arbitrario.
- El núcleo compartido no importa Astro, Node.js, secretos ni adaptadores de I/O.
- Publicación y preview deben producir el mismo HTML para la misma fuente y lista de extensiones.
- Una extensión transforma HAST de forma síncrona y determinista; no realiza I/O.
- Documentos sin extensiones conservan GFM, IDs de encabezados, clases de fences y resaltado actuales.
- La caché lógica usa `documentId + contentHash + rendererFingerprint`, donde el fingerprint incluye versión del núcleo y `id@version` de cada extensión en orden.
- Antes de cada commit ejecutar las pruebas focalizadas indicadas; antes de integrar o etiquetar ejecutar `npm run build`.
- Mantener Conventional Commits y actualizar `CHANGELOG.md` bajo `[Unreleased]`.
- No alterar ni incorporar los cambios locales de `feat/documentos-protegidos`.

## Review Focus

- Un fence desconocido —incluido `graph`— debe conservar su `<pre><code class="language-*">`; lo fija Task 1.
- Dos extensiones que reconocen nodos distintos deben ejecutarse en el orden recibido sin modificar el resto del árbol; lo fija Task 1.
- Una excepción del núcleo debe convertirse en `EditionRenderError` en preview y no dejar una petición del Worker pendiente; lo fija Task 3.
- Un cambio de versión del núcleo, versión de extensión, conjunto activo u orden debe ignorar HTML cacheado con el mismo `contentHash`; lo fija Task 2.
- Fuentes Markdown con GFM, encabezados repetidos y código resaltado deben ser idénticas entre SSR y preview; lo fija Task 3.

---

### Task 1: Núcleo Markdown compartido y contrato de extensiones

**Files:**
- Create: `src/rendering/shared/MarkdownExtension.ts`
- Create: `src/rendering/shared/rendererFingerprint.ts`
- Create: `src/rendering/shared/renderMarkdown.ts`
- Test: `src/rendering/shared/renderMarkdown.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: configuración actual de `UnifiedMarkdownRenderer` en servidor y navegador.
- Produces: `MarkdownExtension`, `renderMarkdown(source, extensions)`, `RENDERER_VERSION` y `createRendererFingerprint`, que consumen Tasks 2 y 3.

- [ ] **Step 1: Añadir el tipo HAST directo usado por el contrato**

Run: `pnpm add -D @types/hast@^3.0.5`

Expected: `package.json` y `pnpm-lock.yaml` declaran `@types/hast`; no se añade una dependencia de runtime.

- [ ] **Step 2: Escribir las pruebas fallidas del núcleo**

Crear pruebas con estos nombres y aserciones:

```ts
it("renders the existing markdown contract without extensions", async () => {
  const html = await renderMarkdown("# Hello\n\n- [x] Done");
  expect(html).toContain('<h1 id="hello">Hello</h1>');
  expect(html).toContain('class="contains-task-list"');
});

it("preserves unknown and graph fences", async () => {
  expect(await renderMarkdown("```graph\nA -> B\n```"))
    .toContain('<code class="language-graph">');
  expect(await renderMarkdown("```unknown\nvalue\n```"))
    .toContain('<code class="language-unknown">');
});

it("applies extensions in registration order without changing siblings", async () => {
  const calls: string[] = [];
  const extensions = [extension("first", calls), extension("second", calls)];
  const html = await renderMarkdown("Paragraph", extensions);
  expect(calls).toEqual(["first", "second"]);
  expect(html).toContain("<p>Paragraph</p>");
});

it("fingerprints extension identity version and order", () => {
  expect(createRendererFingerprint("2", [firstV1, secondV3]))
    .toBe("2|first@1|second@3");
  expect(createRendererFingerprint("2", [secondV3, firstV1]))
    .not.toBe("2|first@1|second@3");
});

it("rejects duplicate extension ids", async () => {
  await expect(renderMarkdown("Paragraph", [firstV1, firstV2]))
    .rejects.toThrow("Duplicate Markdown extension id: first");
});
```

El helper de prueba `extension(id, version, fenceLanguages, calls)` implementa `MarkdownExtension` y solo registra su invocación.

- [ ] **Step 3: Ejecutar la prueba para verificar el fallo**

Run: `npx vitest run src/rendering/shared/renderMarkdown.test.ts`

Expected: FAIL porque `renderMarkdown`, `MarkdownExtension` y `RENDERER_VERSION` no existen.

- [ ] **Step 4: Definir el contrato compartido**

En `MarkdownExtension.ts`:

```ts
import type { Root } from "hast";

export interface MarkdownExtension {
  readonly id: string;
  readonly version: string;
  readonly fenceLanguages: readonly string[];
  transform(tree: Root): void;
}
```

En `rendererFingerprint.ts`:

```ts
export const RENDERER_VERSION = "2";

export function createRendererFingerprint(
  coreVersion: string,
  extensions: readonly MarkdownExtension[],
): string;
```

La versión `2` distingue el pipeline unificado del HTML cacheado por el renderer actual. El fingerprint preserva el orden de registro y rechaza IDs duplicados.

- [ ] **Step 5: Implementar `renderMarkdown`**

Firma exacta en `renderMarkdown.ts`:

```ts
export async function renderMarkdown(
  source: string,
  extensions: readonly MarkdownExtension[] = [],
): Promise<string>;
```

Construir un processor nuevo por llamada o clonar una factoría segura. Orden fijo: `remarkParse`, `remarkGfm`, `remarkRehype`, extensiones en el orden recibido, `rehypeSlug`, `rehypeShiki` con `github-dark`, `rehypeStringify`. El plugin adaptador invoca cada `extension.transform(tree)` una vez.

- [ ] **Step 6: Ejecutar las pruebas del núcleo**

Run: `npx vitest run src/rendering/shared/renderMarkdown.test.ts`

Expected: PASS, 5 tests.

- [ ] **Step 7: Ejecutar comprobación de tipos mediante build**

Run: `npm run build`

Expected: exit 0; la dependencia de tipos y el processor compilan en Astro.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml src/rendering/shared
git commit -m "refactor(rendering): comparte el pipeline markdown"
```

### Task 2: Adaptador SSR y caché versionada

**Files:**
- Modify: `src/publishing/server/domain/render.ts`
- Modify: `src/publishing/server/infraestructure/renderer/UnifiedMarkdownRenderer.ts`
- Modify: `src/publishing/server/application/PagePublisher.ts`
- Test: `src/publishing/server/infraestructure/renderer/UnifiedMarkdownRenderer.test.ts`
- Test: `src/publishing/server/application/PagePublisher.test.ts`

**Interfaces:**
- Consumes: `renderMarkdown`, `MarkdownExtension` y `RENDERER_VERSION` de Task 1; `RenderedPageCache` existente.
- Produces: `DocumentRenderer.fingerprint`, constructor `UnifiedMarkdownRenderer(extensions?)` y caché sensible a versión/conjunto para Task 3 y la rama financiera.

- [ ] **Step 1: Escribir la prueba fallida del adaptador SSR**

```ts
it("delegates server rendering to the shared pipeline", async () => {
  const renderer = new UnifiedMarkdownRenderer();
  const rendered = await renderer.render(documentWith("# Server"));
  expect(renderer.fingerprint).toBe(
    createRendererFingerprint(RENDERER_VERSION, []),
  );
  expect(rendered.Content).toBe('<h1 id="server">Server</h1>');
});
```

`documentWith(content)` devuelve solo `{ getContent: () => content }` tipado como `Document` para la prueba.

- [ ] **Step 2: Escribir la prueba fallida de identidad de caché**

Crear dobles de `DocumentRenderer`, `RenderedPageCache` y documento. Probar:

```ts
it("misses cache when the renderer fingerprint changes", async () => {
  await publisherWithoutExtensions.publish(document);
  await publisherWithFinancialV1.publish(document);
  await publisherWithFinancialV2.publish(document);
  expect(rendererWithoutExtensions.render).toHaveBeenCalledOnce();
  expect(rendererWithFinancialV1.render).toHaveBeenCalledOnce();
  expect(rendererWithFinancialV2.render).toHaveBeenCalledOnce();
});

it("returns the original content hash to page consumers", async () => {
  const result = await publisher.publish(document);
  expect(result?.contentHash).toBe("content-hash");
});
```

Los publishers comparten el mismo cache double y usan fingerprints distintos. Añadir un caso separado que invierta el orden de dos extensiones y confirme otro cache miss.

- [ ] **Step 3: Ejecutar las pruebas para verificar los fallos**

Run: `npx vitest run src/publishing/server/infraestructure/renderer/UnifiedMarkdownRenderer.test.ts src/publishing/server/application/PagePublisher.test.ts`

Expected: FAIL porque el renderer no tiene `fingerprint`, no usa el núcleo y la caché solo compara `contentHash`.

- [ ] **Step 4: Extender `DocumentRenderer`**

En `src/publishing/server/domain/render.ts`:

```ts
export interface DocumentRenderer {
  readonly fingerprint: string;
  render(document: { getContent(): string }): Promise<RenderedDocument>;
}
```

- [ ] **Step 5: Adaptar `UnifiedMarkdownRenderer` del servidor**

Constructor y miembro exactos:

```ts
constructor(
  private readonly extensions: readonly MarkdownExtension[] = [],
) {
  this.fingerprint = createRendererFingerprint(RENDERER_VERSION, extensions);
}

readonly fingerprint: string;
```

`render(document)` llama a `renderMarkdown(document.getContent(), this.extensions)` y devuelve `{ Content: html }`. Retirar el processor duplicado y sus imports.

- [ ] **Step 6: Versionar la identidad interna de caché**

Crear helper privado puro en `PagePublisher.ts`:

```ts
function renderedCacheHash(rendererFingerprint: string, contentHash: string): string {
  return `${rendererFingerprint}:${contentHash}`;
}
```

Usarlo exclusivamente en `cache.get` y `cache.set`. `RenderedDocumentPage.contentHash` conserva el hash original del documento.

- [ ] **Step 7: Ejecutar las pruebas focalizadas**

Run: `npx vitest run src/publishing/server/infraestructure/renderer/UnifiedMarkdownRenderer.test.ts src/publishing/server/application/PagePublisher.test.ts`

Expected: PASS, incluidos cache hit con misma versión y cache miss con versión distinta.

- [ ] **Step 8: Ejecutar las pruebas de caché y aplicación relacionadas**

Run: `npx vitest run src/publishing src/application/server/Application.test.ts`

Expected: PASS; no cambia la composición pública de `Application`.

- [ ] **Step 9: Commit**

```bash
git add src/publishing/server
git commit -m "fix(publishing): versiona la cache de renderizado"
```

### Task 3: Adaptador de preview, Worker y paridad

**Files:**
- Create: `src/application/browser/createMarkdownExtensions.ts`
- Modify: `src/documents/browser/infraestructure/renderer/UnifiedMarkdownRenderer.ts`
- Modify: `src/documents/browser/infraestructure/renderer/DelegatedMarkdownItRenderer/worker-entry.ts`
- Test: `src/documents/browser/infraestructure/renderer/DelegatedMarkdownItRenderer/DelegatedMarkdownItRenderer.test.ts`
- Test: `src/documents/browser/infraestructure/renderer/UnifiedMarkdownRenderer.test.ts`
- Test: `src/rendering/shared/MarkdownRendererParity.test.ts`
- Test: `src/application/browser/ApplicationConsumers.test.ts`

**Interfaces:**
- Consumes: Task 1 `renderMarkdown`/`MarkdownExtension`; Task 2 constructor del renderer SSR.
- Produces: `createMarkdownExtensions(): readonly MarkdownExtension[]` como punto de composición browser-safe y paridad demostrada para la rama `codex/financial-content`.

- [ ] **Step 1: Escribir las pruebas fallidas del adaptador de preview**

Conservar las pruebas existentes y añadir:

```ts
it("wraps shared renderer failures as EditionRenderError", async () => {
  const renderer = new UnifiedMarkdownRenderer([throwingExtension]);
  const result = await renderer.render("Paragraph");
  expect(result.isSuccess).toBe(false);
  expect(result.getError()).toBeInstanceOf(EditionRenderError);
});
```

`throwingExtension.transform()` lanza `new Error("extension failed")`.

- [ ] **Step 2: Escribir la prueba fallida de paridad**

En `MarkdownRendererParity.test.ts`, usar una tabla de fuentes:

```ts
const sources = [
  "# Repeated\n\n## Repeated\n\n## Repeated",
  "| A | B |\n| - | - |\n| 1 | 2 |",
  "```graph\nA -> B\n```",
  "```ts\nconst value = 1;\n```",
];
```

Para cada fuente, renderizar con `publishing/server/.../UnifiedMarkdownRenderer` y `documents/browser/.../UnifiedMarkdownRenderer`; afirmar igualdad exacta de `Content`.

- [ ] **Step 3: Escribir la prueba fallida del protocolo ante errores**

Permitir que `DelegatedMarkdownItRenderer` reciba en su constructor un `Worker` compatible opcional, conservando el Worker real como default. Un fake captura `postMessage` y emite una respuesta `{ id, ok: false, error: "extension failed" }`. Afirmar que la promesa de `render()` se resuelve —no queda pendiente— con `Result.fail(EditionRenderError)`.

- [ ] **Step 4: Ejecutar las pruebas para verificar los fallos**

Run: `npx vitest run src/documents/browser/infraestructure/renderer/UnifiedMarkdownRenderer.test.ts src/documents/browser/infraestructure/renderer/DelegatedMarkdownItRenderer/DelegatedMarkdownItRenderer.test.ts src/rendering/shared/MarkdownRendererParity.test.ts`

Expected: FAIL porque el adaptador browser aún mantiene su processor y no acepta extensiones.

- [ ] **Step 5: Adaptar `UnifiedMarkdownRenderer` del navegador**

Constructor exacto:

```ts
constructor(
  private readonly extensions: readonly MarkdownExtension[] = [],
) {}
```

`render(document)` llama a `renderMarkdown(document, this.extensions)`, devuelve `Result.ok({ Content: html })` y conserva la conversión de excepciones a `EditionRenderError`. Eliminar configuración Unified duplicada.

- [ ] **Step 6: Hacer inyectable el Worker para pruebas**

Firma compatible:

```ts
constructor(worker?: Pick<Worker, "postMessage" | "addEventListener">)
```

Cuando falta, crear el Worker real actual. Usar el mismo campo para registrar `message` y enviar requests; no cambiar IDs ni protocolo.

- [ ] **Step 7: Crear el punto de composición browser-safe**

En `src/application/browser/createMarkdownExtensions.ts`:

```ts
export function createMarkdownExtensions(): readonly MarkdownExtension[] {
  return [];
}
```

No exportar un arreglo mutable ni importar adaptadores de servidor.

- [ ] **Step 8: Componer el Worker**

Modificar `worker-entry.ts` para construir:

```ts
const renderer = new UnifiedMarkdownRenderer(createMarkdownExtensions());
```

El protocolo `RenderRequest`/`RenderResponse` no cambia. Añadir a `ApplicationConsumers.test.ts` una aserción de lectura que confirme que `worker-entry.ts` importa la factoría de `application/browser` y no el futuro módulo financiero directamente.

- [ ] **Step 9: Ejecutar pruebas de renderer y flujo de preview**

Run: `npx vitest run src/rendering/shared src/documents/browser/infraestructure/renderer src/documents/browser/application/test/PreviewFlow.test.ts src/application/browser/ApplicationConsumers.test.ts`

Expected: PASS; la excepción se transforma en error y todos los fixtures SSR/preview coinciden.

- [ ] **Step 10: Ejecutar el build del Worker y SSR**

Run: `npm run build`

Expected: exit 0; el bundle de navegador no incluye módulos de Node ni `astro:env/server` desde `src/rendering/shared`.

- [ ] **Step 11: Commit**

```bash
git add src/application/browser/createMarkdownExtensions.ts src/application/browser/ApplicationConsumers.test.ts src/documents/browser/infraestructure/renderer src/rendering/shared/MarkdownRendererParity.test.ts
git commit -m "refactor(rendering): unifica la vista previa markdown"
```

### Task 4: Documentación de la capacidad y verificación de rama

**Files:**
- Create: `src/content/nanobook-project/arquitectura/renderizado-extensible.md`
- Modify: `src/content/nanobook-project/index.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: las interfaces y decisiones implementadas en Tasks 1–3.
- Produces: contrato documentado para quienes implementen `codex/financial-content` y una rama integrable por separado.

- [ ] **Step 1: Documentar la frontera de renderizado**

Crear una nota de arquitectura con frontmatter válido que explique:

- `rendering/shared` es puro y browser-compatible;
- el manifiesto `id`, `version`, `fenceLanguages` permite selección confiable futura;
- `MarkdownExtension.transform(tree)` es síncrono y cerrado;
- `application/server` y `application/browser/createMarkdownExtensions.ts` son puntos de composición;
- SSR y Worker usan `renderMarkdown`;
- la caché combina fingerprint de núcleo/extensiones y hash sin alterar el hash público;
- el núcleo funciona con un arreglo vacío y no conoce `financial-content`;
- no se permite I/O ni ejecución de contenido en extensiones.

Enlazarla desde `src/content/nanobook-project/index.md`.

- [ ] **Step 2: Actualizar el changelog**

Añadir bajo `[Unreleased]` una entrada `Changed` que indique que publicación y preview comparten el pipeline Markdown y que la caché queda versionada. No anunciar todavía bloques financieros.

- [ ] **Step 3: Ejecutar comprobaciones de documentación**

Run: `git diff --check`

Expected: sin errores de espacios ni conflictos.

- [ ] **Step 4: Ejecutar la suite completa**

Run: `npm test`

Expected: exit 0, 0 tests fallidos.

- [ ] **Step 5: Ejecutar build obligatorio**

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 6: Revisar alcance de la rama**

Run: `git status --short && git diff --stat main...HEAD`

Expected: solo archivos de renderizado, sus adaptadores, pruebas y documentación; ningún archivo de documentos protegidos ni de `financial-content`.

- [ ] **Step 7: Commit**

```bash
git add CHANGELOG.md src/content/nanobook-project
git commit -m "docs(rendering): documenta extensiones markdown"
```

## Self-Review Record

- Spec coverage: cubre núcleo compartido, contrato cerrado, composición por entorno, caché versionada, paridad y compatibilidad; los bloques y su UI quedan deliberadamente en el segundo plan.
- Step scan: cada paso crea una prueba, interfaz, cambio o verificación única; los cuerpos del processor quedan al implementador salvo orden y firmas fijadas.
- Type consistency: `MarkdownExtension`, `renderMarkdown`, `RENDERER_VERSION`, `DocumentRenderer.fingerprint` y `createMarkdownExtensions` mantienen nombres únicos en todas las tareas.
- Review Focus: los cinco riesgos están asignados a pruebas en Tasks 1–3.
- Proportion: cuatro tareas producen una rama funcional e integrable sin anticipar el código del módulo financiero.
