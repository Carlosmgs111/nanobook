# Financial Content Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir cinco bloques financieros componibles, verificables y accesibles que Companio pueda generar dentro de Markdown y que nanobook renderice igual en preview y publicación.

**Architecture:** `financial-content/shared` implementará contratos Zod, parseo YAML y renderizadores HAST/SVG puros; una `MarkdownExtension` reconocerá únicamente fences financieros y reemplazará cada uno por HTML semántico. La raíz de aplicación compondrá esa extensión en el pipeline compartido de la rama `codex/rendering-extensions`, mientras la presentación consumirá exclusivamente variables de `theme`.

**Tech Stack:** TypeScript, Zod 4, YAML 2, HAST, Unified/Remark/Rehype, SVG, Astro 7, CSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-05-financial-content-blocks-design.md`

## Global Constraints

- Trabajar en `codex/financial-content`, basada en `codex/rendering-extensions`, dentro del mismo worktree aislado o uno nuevo.
- Implementar exactamente los contratos v1 del spec: `company-profile`, `financial-chart`, `financial-metrics`, `financial-news`, `financial-sources`.
- Los datos permanecen incrustados en Markdown; ningún bloque realiza `fetch`, I/O o consultas a Companio al renderizar.
- Solo se aceptan URL absolutas `https:`, fechas civiles `YYYY-MM-DD`, monedas ISO 4217 y números finitos.
- Cada serie, métrica, noticia y ficha referencia fuentes locales válidas del mismo bloque.
- Un bloque inválido se reemplaza completo por un error seguro; los bloques posteriores continúan renderizando.
- HTML, CSS, SVG y JavaScript suministrados por el contenido nunca se ejecutan ni se insertan como raw HTML.
- Locale fijo `es-CO`; los formateadores compartidos no dependen de zona horaria ni ICU del host.
- La salida inicial es HTML/SVG comprensible sin JavaScript y ofrece una tabla equivalente para cada gráfico.
- Los estilos consumen `--theme-*`; no incluyen colores literales de Companio ni instalan variables globales.
- `financial-content` se registra desde las raíces de aplicación como extensión opcional; `rendering` no lo importa y funciona con un arreglo vacío.
- La extensión publica `id: "financial-content"`, `version: "1"` y los cinco `fenceLanguages`; su versión cambia cuando varían schemas o HTML/SVG.
- Máximos por bloque: 8 series, 120 puntos por serie, 12 métricas, 12 noticias y 30 fuentes.
- Mantener Conventional Commits; actualizar `CHANGELOG.md` bajo `[Unreleased]` y documentar la decisión en `src/content/nanobook-project/`.
- Antes de cada commit ejecutar las pruebas focalizadas indicadas; antes de integrar o etiquetar ejecutar `npm run build`.
- No incorporar cambios locales de `feat/documentos-protegidos`; resolver `DocumentPage.astro` solo después de que esa rama esté integrada en la base elegida.

## Review Focus

- YAML malformado, campos desconocidos y payloads con HTML deben producir un error escapado sin imprimir el payload; lo fija Task 3.
- IDs de fuente duplicados, inexistentes o de tipo incompatible deben invalidar el bloque completo; lo fija Task 1.
- Gráficos con `null`, longitudes desalineadas, todos los puntos ausentes o series incompatibles deben seguir exactamente las reglas del spec; lo fija Task 5.
- URL `javascript:`, `data:`, HTTP o enlaces de noticias sin fuente válida nunca deben llegar a un `href`; lo fijan Tasks 1 y 6.
- Modo oscuro, modo claro, viewport estrecho y usuarios que no distinguen color deben conservar toda la información; lo fija Task 6.

---

### Task 1: Contratos v1, esquemas y trazabilidad

**Files:**
- Create: `src/financial-content/shared/model/FinancialSource.ts`
- Create: `src/financial-content/shared/model/FinancialBlock.ts`
- Create: `src/financial-content/shared/validation/FinancialBlockSchemas.ts`
- Create: `src/financial-content/shared/parsing/FinancialBlockParseError.ts`
- Create: `src/financial-content/shared/parsing/parseFinancialBlock.ts`
- Create: `src/financial-content/shared/parsing/parseFinancialBlock.test.ts`
- Create: `src/financial-content/shared/index.ts`

**Interfaces:**
- Consumes: `Result` de `src/shared/domain/Result`, `zod`, `yaml` y el contrato v1 del spec.
- Produces: `FinancialBlock`, `FinancialFenceKind`, `FinancialSource`, `parseFinancialBlock` e `isFinancialFenceKind` para Tasks 3–7.

- [ ] **Step 1: Escribir pruebas fallidas para los cinco casos mínimos válidos**

Crear un fixture YAML mínimo válido por kind y probar:

```ts
it.each(validCases)("parses $kind as version 1", ({ kind, yaml }) => {
  const result = parseFinancialBlock(kind, yaml);
  expect(result.isSuccess).toBe(true);
  expect(result.getValue()).toMatchObject({ kind, version: 1 });
});
```

Los fixtures usan exactamente los nombres, enums y campos obligatorios del spec. Omitir `version` demuestra que el parser asigna `1`.

- [ ] **Step 2: Escribir pruebas fallidas de trazabilidad y seguridad**

Añadir pruebas con estos nombres:

```ts
it("rejects duplicate source ids");
it("rejects missing source references");
it("requires news references to point to news sources");
it.each(["http://example.com", "javascript:alert(1)", "data:text/html,x"])(
  "rejects unsafe source url %s",
);
it("rejects unknown payload fields");
it("rejects non-finite values and invalid ISO dates");
it("enforces collection limits from the v1 contract");
it("rejects yaml aliases and custom tags");
```

Cada prueba afirma `result.isSuccess === false`, el `kind` del error y un código estable; ninguna aserción depende del texto YAML completo.

- [ ] **Step 3: Ejecutar las pruebas para verificar el fallo**

Run: `npx vitest run src/financial-content/shared/parsing/parseFinancialBlock.test.ts`

Expected: FAIL porque el módulo no existe.

- [ ] **Step 4: Definir los tipos públicos**

Copiar al modelo TypeScript los contratos canónicos del spec sin renombrar propiedades. Exportar:

```ts
export type FinancialFenceKind =
  | "company-profile"
  | "financial-chart"
  | "financial-metrics"
  | "financial-news"
  | "financial-sources";

export type FinancialBlock =
  | CompanyProfileBlock
  | FinancialChartBlock
  | FinancialMetricsBlock
  | FinancialNewsBlock
  | FinancialSourcesBlock;
```

- [ ] **Step 5: Implementar esquemas Zod estrictos**

Usar `.strict()` para objetos públicos. Validaciones refinadas obligatorias:

- fuente con `publishedAt` o `period`;
- IDs únicos y referencias resueltas dentro del bloque;
- `financial-news.sourceId` apunta a fuente `news`;
- moneda presente solo cuando `unit === "currency"` y ausente en otras unidades;
- comparación comparte unidad/moneda implícitas de su métrica;
- límites exactos de colecciones;
- fecha mediante patrón y validación de calendario real;
- URL analizada con `URL` y protocolo exactamente `https:`;
- números mediante `z.number().finite()`.

- [ ] **Step 6: Implementar el parser seguro**

Firmas exactas:

```ts
export function isFinancialFenceKind(value: string): value is FinancialFenceKind;

export function parseFinancialBlock(
  kind: FinancialFenceKind,
  yamlSource: string,
): Result<FinancialBlockParseError, FinancialBlock>;
```

Configurar `yaml` con schema core, sin tags personalizados y con aliases deshabilitados. Inyectar `{ kind, version: payload.version ?? 1 }` antes de seleccionar el schema. `FinancialBlockParseError` expone `kind`, `code`, `path` y `message`, pero nunca guarda `yamlSource`.

- [ ] **Step 7: Ejecutar las pruebas del contrato**

Run: `npx vitest run src/financial-content/shared/parsing/parseFinancialBlock.test.ts`

Expected: PASS para los cinco casos válidos y todos los rechazos.

- [ ] **Step 8: Ejecutar build browser/server**

Run: `npm run build`

Expected: exit 0; `financial-content/shared` no arrastra APIs de Node.

- [ ] **Step 9: Commit**

```bash
git add src/financial-content/shared
git commit -m "feat(financial-content): define contratos financieros"
```

### Task 2: Formato determinista es-CO

**Files:**
- Create: `src/financial-content/shared/formatting/formatFinancialValue.ts`
- Create: `src/financial-content/shared/formatting/formatFinancialDate.ts`
- Create: `src/financial-content/shared/formatting/formatFinancialValue.test.ts`
- Create: `src/financial-content/shared/formatting/formatFinancialDate.test.ts`
- Modify: `src/financial-content/shared/index.ts`

**Interfaces:**
- Consumes: `FinancialUnit` y `CurrencyCode` de Task 1.
- Produces: `formatFinancialValue` y `formatFinancialDate` para todos los renderizadores.

- [ ] **Step 1: Escribir pruebas fallidas de valores**

```ts
expect(formatFinancialValue({ value: 16.7, unit: "percent" }))
  .toBe("16,7\u00a0%");
expect(formatFinancialValue({ value: 288.93, unit: "currency", currency: "USD" }))
  .toBe("USD\u00a0288,93");
expect(formatFinancialValue({ value: 17.8, unit: "multiple" }))
  .toBe("17,8×");
expect(formatFinancialValue({ value: 12345.6, unit: "number", precision: 1 }))
  .toBe("12.345,6");
expect(formatFinancialValue({ value: -1.2, unit: "number", precision: 1 }))
  .toBe("−1,2");
```

Añadir pruebas de redondeo, cero, precisión 0–4 y rechazo defensivo de argumentos incompatibles aunque el parser normalmente los filtre.

- [ ] **Step 2: Escribir pruebas fallidas de fechas**

```ts
expect(formatFinancialDate("2026-10-29")).toBe("29 oct 2026");
expect(formatFinancialDate("2024-02-29")).toBe("29 feb 2024");
```

Ejecutar la misma prueba bajo `TZ=UTC` y `TZ=America/Bogota` mediante el helper puro; la salida no usa `Date` con zona horaria.

- [ ] **Step 3: Ejecutar las pruebas para verificar el fallo**

Run: `npx vitest run src/financial-content/shared/formatting`

Expected: FAIL porque los formateadores no existen.

- [ ] **Step 4: Implementar `formatFinancialValue`**

Firma exacta:

```ts
export function formatFinancialValue(input: {
  value: number;
  unit: FinancialUnit;
  currency?: CurrencyCode;
  precision?: 0 | 1 | 2 | 3 | 4;
}): string;
```

No usar `Intl`. Redondear con precisión explícita, agrupar miles con `.`, usar `,` decimal, signo menos Unicode, NBSP entre código/unidad y valor, y defaults del spec.

- [ ] **Step 5: Implementar `formatFinancialDate`**

Firma exacta:

```ts
export function formatFinancialDate(value: ISODate): string;
```

Separar componentes de la cadena ISO y usar un arreglo fijo de meses abreviados en español; no construir un `Date`.

- [ ] **Step 6: Ejecutar las pruebas de formato**

Run: `npx vitest run src/financial-content/shared/formatting`

Expected: PASS, con snapshots iguales bajo cualquier TZ.

- [ ] **Step 7: Commit**

```bash
git add src/financial-content/shared/formatting src/financial-content/shared/index.ts
git commit -m "feat(financial-content): formatea datos financieros"
```

### Task 3: Extensión Markdown, errores seguros y ficha de empresa

**Files:**
- Create: `src/financial-content/shared/rendering/hast.ts`
- Create: `src/financial-content/shared/rendering/renderFinancialError.ts`
- Create: `src/financial-content/shared/rendering/renderCompanyProfile.ts`
- Create: `src/financial-content/shared/rendering/renderFinancialBlock.ts`
- Create: `src/financial-content/shared/rendering/createFinancialContentExtension.ts`
- Test: `src/financial-content/shared/rendering/createFinancialContentExtension.test.ts`
- Modify: `src/financial-content/shared/index.ts`

**Interfaces:**
- Consumes: `MarkdownExtension`/`renderMarkdown` de la rama base; parser y modelo de Task 1; formato de Task 2.
- Produces: `createFinancialContentExtension(): MarkdownExtension` con manifiesto estable, dispatcher `renderFinancialBlock(block, context): Element` y convención de IDs por índice para Tasks 4–7.

- [ ] **Step 1: Escribir pruebas fallidas de reconocimiento y aislamiento**

```ts
it("replaces only known financial fences");
it("leaves unknown fences unchanged");
it("continues rendering after an invalid financial fence");
it("does not expose the invalid yaml in the error block");
it("escapes html-looking company content as text");
```

Renderizar mediante `renderMarkdown(source, [createFinancialContentExtension()])`. Comprobar clases `financial-block`, `financial-block--error`, `financial-company`, el párrafo posterior y ausencia de `<script>` real.

Añadir una prueba que renderice la misma fuente con `renderMarkdown(source, [])` y confirme que conserva `<code class="language-company-profile">`, demostrando que la capacidad es opt-in.

- [ ] **Step 2: Escribir la prueba fallida de ficha semántica**

Para un `company-profile` válido afirmar:

- raíz `<section class="financial-block financial-company">`;
- heading y descripción como text nodes;
- ticker/bolsa en `<dl>`;
- `<time datetime="2026-09-30">`;
- enlaces opcionales con `target="_blank"` y `rel="noopener noreferrer external"`;
- lista de fuentes próximas con las referencias declaradas.

- [ ] **Step 3: Ejecutar las pruebas para verificar el fallo**

Run: `npx vitest run src/financial-content/shared/rendering/createFinancialContentExtension.test.ts`

Expected: FAIL porque la extensión y renderizadores no existen.

- [ ] **Step 4: Implementar helpers HAST sin raw HTML**

`hast.ts` exporta constructores pequeños de `Element` y `Text`. Ningún helper recibe o devuelve strings HTML. Los valores de usuario siempre terminan en nodos `text`; atributos provienen de contratos validados.

- [ ] **Step 5: Implementar el error seguro**

Firma exacta:

```ts
export function renderFinancialError(input: {
  kind: FinancialFenceKind;
  blockIndex: number;
  error: FinancialBlockParseError;
}): Element;
```

Mostrar kind, path y mensaje sanitizado. No incluir YAML, stack, excepción original ni valores completos rechazados.

- [ ] **Step 6: Implementar ficha y dispatcher**

Firmas exactas:

```ts
export interface FinancialRenderContext { blockIndex: number; }
export function renderCompanyProfile(
  block: CompanyProfileBlock,
  context: FinancialRenderContext,
): Element;
export function renderFinancialBlock(
  block: FinancialBlock,
  context: FinancialRenderContext,
): Element;
```

El dispatcher cubre exhaustivamente el union; para los tipos de Tasks 4–6 puede lanzar un error interno hasta que esas tareas los implementen, sin exponerse al usuario porque sus tests aún no registran fixtures de esos tipos.

- [ ] **Step 7: Implementar la transformación de fences**

`createFinancialContentExtension()` recorre HAST, detecta exactamente `pre > code.language-<kind>`, concatena solo sus text nodes como YAML y reemplaza el `<pre>` completo. Incrementa `blockIndex` por cada fence financiero, válido o inválido. Nunca transforma un `code` inline ni una clase con sufijo adicional.

El objeto retornado declara exactamente:

```ts
{
  id: "financial-content",
  version: "1",
  fenceLanguages: [
    "company-profile",
    "financial-chart",
    "financial-metrics",
    "financial-news",
    "financial-sources",
  ],
  transform,
}
```

- [ ] **Step 8: Ejecutar pruebas de extensión y seguridad**

Run: `npx vitest run src/financial-content/shared/rendering/createFinancialContentExtension.test.ts`

Expected: PASS; el HTML resultante no contiene raw script y el párrafo posterior sobrevive al error.

- [ ] **Step 9: Commit**

```bash
git add src/financial-content/shared/rendering src/financial-content/shared/index.ts
git commit -m "feat(financial-content): renderiza fichas financieras"
```

### Task 4: Métricas y bibliografía

**Files:**
- Create: `src/financial-content/shared/rendering/renderFinancialMetrics.ts`
- Create: `src/financial-content/shared/rendering/renderFinancialSources.ts`
- Test: `src/financial-content/shared/rendering/renderFinancialMetrics.test.ts`
- Test: `src/financial-content/shared/rendering/renderFinancialSources.test.ts`
- Modify: `src/financial-content/shared/rendering/renderFinancialBlock.ts`

**Interfaces:**
- Consumes: contexto/render helpers de Task 3, formatos de Task 2 y referencias validadas de Task 1.
- Produces: HTML semántico para `financial-metrics` y `financial-sources` usado en integración.

- [ ] **Step 1: Escribir pruebas fallidas de métricas**

Probar que una métrica de moneda y una de múltiplo generan:

- `<section class="financial-block financial-metrics">`;
- lista semántica `<dl>` con labels y valores formateados;
- periodo visible;
- comparación con texto `Favorable`, `Desfavorable` o `Neutral`, no solo clase/color;
- `data-direction` con uno de esos tres valores;
- enlaces únicamente a las fuentes referenciadas por cada métrica.

- [ ] **Step 2: Escribir pruebas fallidas de bibliografía**

Probar `<ol class="financial-sources__list">`, organización, tipo, fecha/periodo, fecha de consulta y atributos seguros de enlaces. El orden coincide con `items`; no se reordena implícitamente.

- [ ] **Step 3: Ejecutar pruebas para verificar el fallo**

Run: `npx vitest run src/financial-content/shared/rendering/renderFinancialMetrics.test.ts src/financial-content/shared/rendering/renderFinancialSources.test.ts`

Expected: FAIL porque los renderizadores no existen.

- [ ] **Step 4: Implementar ambos renderizadores**

Firmas:

```ts
export function renderFinancialMetrics(
  block: FinancialMetricsBlock,
  context: FinancialRenderContext,
): Element;

export function renderFinancialSources(
  block: FinancialSourcesBlock,
  context: FinancialRenderContext,
): Element;
```

Resolver fuentes mediante un `Map<SourceId, FinancialSource>` local; el parser ya garantiza integridad. Usar `aria-describedby` para conectar descripciones opcionales sin duplicar texto.

- [ ] **Step 5: Añadir casos al dispatcher y ejecutar pruebas**

Run: `npx vitest run src/financial-content/shared/rendering`

Expected: PASS para ficha, errores, métricas y bibliografía.

- [ ] **Step 6: Commit**

```bash
git add src/financial-content/shared/rendering
git commit -m "feat(financial-content): renderiza metricas y fuentes"
```

### Task 5: Gráficos SVG y tabla accesible

**Files:**
- Create: `src/financial-content/shared/rendering/chart/ChartGeometry.ts`
- Create: `src/financial-content/shared/rendering/chart/ChartGeometry.test.ts`
- Create: `src/financial-content/shared/rendering/renderFinancialChart.ts`
- Create: `src/financial-content/shared/rendering/renderFinancialChart.test.ts`
- Modify: `src/financial-content/shared/rendering/renderFinancialBlock.ts`

**Interfaces:**
- Consumes: `FinancialChartBlock`, formatos y contexto de Tasks 1–3.
- Produces: SVG determinista y tabla equivalente para integración y estilos.

- [ ] **Step 1: Escribir pruebas fallidas de geometría**

Probar funciones puras con viewBox fijo `0 0 800 360`:

```ts
it("maps a positive and negative domain into the plot area");
it("expands a zero-width domain deterministically");
it("splits line segments at null values");
it("omits null bars without shifting x positions");
```

Las firmas públicas del archivo:

```ts
export function createChartScale(values: readonly (number | null)[]): ChartScale;
export function createLineSegments(values: readonly (number | null)[], scale: ChartScale): Point[][];
export function createBars(values: readonly (number | null)[], scale: ChartScale): Bar[];
```

- [ ] **Step 2: Escribir pruebas fallidas de validación de gráficos**

Añadir al parser de Task 1 casos que rechacen longitudes distintas, serie toda `null`, más de 8 series, más de 120 puntos y unidades/monedas incompatibles. Probar que `null` intermedio sí es válido.

- [ ] **Step 3: Escribir pruebas fallidas del renderer**

Para línea y barras afirmar:

- `<figure class="financial-block financial-chart">`;
- `<svg viewBox="0 0 800 360" role="img">` con title/description enlazados por IDs `financial-chart-<blockIndex>-*`;
- leyenda textual por serie;
- caminos separados ante `null` y ausencia de rect para barra nula;
- `<details>` con summary `Ver datos del gráfico` y tabla completa;
- celda `Sin dato` para `null`;
- fuentes por serie visibles junto al gráfico.

- [ ] **Step 4: Ejecutar pruebas para verificar el fallo**

Run: `npx vitest run src/financial-content/shared/parsing/parseFinancialBlock.test.ts src/financial-content/shared/rendering/chart src/financial-content/shared/rendering/renderFinancialChart.test.ts`

Expected: FAIL en geometría y renderer; los nuevos rechazos del parser también fallan si faltaba alguna refinación.

- [ ] **Step 5: Implementar geometría pura**

Usar constantes de plot `{ left: 72, top: 24, right: 24, bottom: 56 }`. Los cálculos reciben solo números validados. Una serie constante expande el dominio en ±1 cuando vale 0 o ±5 % del absoluto en otro caso. No interpolar huecos `null`.

- [ ] **Step 6: Implementar `renderFinancialChart`**

Firma exacta:

```ts
export function renderFinancialChart(
  block: FinancialChartBlock,
  context: FinancialRenderContext,
): Element;
```

Crear HAST SVG con primitivas conocidas (`svg`, `g`, `path`, `rect`, `line`, `text`) y atributos numéricos calculados. No aceptar SVG desde el payload. Generar la tabla desde los mismos arrays, no desde la geometría.

- [ ] **Step 7: Conectar el dispatcher y ejecutar pruebas**

Run: `npx vitest run src/financial-content/shared`

Expected: PASS para parser, formatos, geometría, gráfico y renderizadores previos.

- [ ] **Step 8: Commit**

```bash
git add src/financial-content/shared
git commit -m "feat(financial-content): renderiza graficos accesibles"
```

### Task 6: Noticias y presentación basada en theme

**Files:**
- Create: `src/financial-content/shared/rendering/renderFinancialNews.ts`
- Create: `src/financial-content/shared/rendering/renderFinancialNews.test.ts`
- Create: `src/financial-content/browser/ui/styles/financial-content.css`
- Create: `src/financial-content/browser/ui/styles/financialContentStyles.test.ts`
- Modify: `src/financial-content/shared/rendering/renderFinancialBlock.ts`
- Modify: `src/shared/styles/global.css`
- Modify: `src/theme/browser/ui/styles/themeStyles.test.ts`

**Interfaces:**
- Consumes: fuente `news` validada, formateadores y clases estructurales de Tasks 1–5; contrato `--theme-*` existente.
- Produces: quinto renderer y presentación responsive completa sin dependencia de JavaScript.

- [ ] **Step 1: Escribir pruebas fallidas del renderer de noticias**

Probar que cada noticia genera `article`, título enlazado, resumen, organización y fecha de su fuente. Afirmar:

```ts
expect(link.properties).toMatchObject({
  target: "_blank",
  rel: ["noopener", "noreferrer", "external"],
});
```

Los tickers y métricas opcionales aparecen como texto; el renderer no solicita la URL.

- [ ] **Step 2: Escribir pruebas fallidas del contrato visual**

`financialContentStyles.test.ts` lee la hoja y afirma:

- contiene selectores para `.financial-block`, perfiles, métricas, gráficos, noticias, fuentes y errores;
- contiene `var(--theme-surface-bg)`, `var(--theme-content-primary)`, `var(--theme-content-muted)`, `var(--theme-border)`, `var(--theme-panel-radius)` y roles de estado;
- no contiene hexadecimal, `rgb(`/`rgba(` ni clases Tailwind de colores;
- contiene media query de viewport estrecho y `prefers-reduced-motion`;
- tendencias usan `data-direction` más pseudo-elemento/texto, no solo color.

Antes de crear CSS, inventariar los roles existentes en `theme/browser/ui/styles/contract.css`. Si una decisión no puede expresarse con ellos y es reutilizable fuera de un gráfico concreto, escribir primero una prueba fallida que exija el nuevo rol en `ThemeTokens`, presets claro/oscuro, compilación, contrato CSS y preview del editor. Si los roles actuales bastan, no ampliar `theme`.

Añadir el CSS financiero al inventario que audita `themeStyles.test.ts`.

- [ ] **Step 3: Ejecutar las pruebas para verificar el fallo**

Run: `npx vitest run src/financial-content/shared/rendering/renderFinancialNews.test.ts src/financial-content/browser/ui/styles/financialContentStyles.test.ts src/theme/browser/ui/styles/themeStyles.test.ts`

Expected: FAIL porque renderer y hoja no existen.

- [ ] **Step 4: Implementar `renderFinancialNews`**

Firma:

```ts
export function renderFinancialNews(
  block: FinancialNewsBlock,
  context: FinancialRenderContext,
): Element;
```

Resolver cada `sourceId`, presentar organización/fecha y usar enlace seguro. Conectar el case exhaustivo del dispatcher.

- [ ] **Step 5: Implementar estilos del módulo**

Usar CSS Grid/Flex responsive, scroll horizontal solo para tablas, `svg { width: 100%; height: auto; }`, foco visible con `--theme-focus-ring` y patrones/estados con `color-mix` basado en tokens. La tabla de gráfico dentro de `details` permanece operable sin script.

- [ ] **Step 6: Incorporar estilos una vez**

En `src/shared/styles/global.css`, añadir:

```css
@import "../../financial-content/browser/ui/styles/financial-content.css";
```

No crear `browser/index.ts` ni `FinancialContentHost.astro` vacíos. Registrar en el documento de arquitectura final que esas superficies aparecerán solo al introducir comportamiento cliente.

- [ ] **Step 7: Ejecutar pruebas de render y temas**

Run: `npx vitest run src/financial-content src/theme/browser/ui/styles/themeStyles.test.ts`

Expected: PASS; no hay colores literales y los cinco kinds tienen renderer.

- [ ] **Step 8: Commit**

```bash
git add src/financial-content src/shared/styles/global.css src/theme/browser/ui/styles/themeStyles.test.ts
git commit -m "style(financial-content): integra bloques con temas"
```

### Task 7: Composición SSR/Worker y prueba vertical

**Files:**
- Modify: `src/publishing/server/index.ts`
- Modify: `src/application/server/Application.ts`
- Modify: `src/application/server/Application.test.ts`
- Modify: `src/application/browser/createMarkdownExtensions.ts`
- Test: `src/application/browser/createMarkdownExtensions.test.ts`
- Modify: `src/rendering/shared/MarkdownRendererParity.test.ts`
- Create: `src/financial-content/shared/test/fixtures/alphabet-analysis.md`
- Create: `src/financial-content/shared/test/FinancialNoteIntegration.test.ts`

**Interfaces:**
- Consumes: `createFinancialContentExtension` de Tasks 3–6 y `MarkdownExtension` de la rama base.
- Produces: extensión activa en publicación y preview, fixture vertical y prueba de igualdad de HTML.

- [ ] **Step 1: Escribir la prueba fallida de composición browser**

```ts
it("registers financial content in browser rendering", () => {
  const extensions = createMarkdownExtensions();
  expect(extensions.map(({ id, version }) => `${id}@${version}`))
    .toEqual(["financial-content@1"]);
  expect(extensions[0].fenceLanguages).toHaveLength(5);
});
```

- [ ] **Step 2: Escribir la prueba fallida de composición server**

En `Application.test.ts`, renderizar un documento mínimo con `financial-metrics` mediante `app.publishingModule.pageRenderer` y afirmar presencia de `financial-metrics`, además de comprobar que `Application` no expone repositorios ni schemas del módulo.

Crear también un `PublishingModule` con `extensions: []` y afirmar que el mismo fence permanece como código; `publishing` no debe importar ni activar `financial-content` por sí solo.

- [ ] **Step 3: Crear fixture vertical y prueba fallida**

`alphabet-analysis.md` contiene Markdown explicativo y los cinco bloques con datos marcados como demostrativos. La integración afirma:

- los cinco selectores de bloque aparecen en orden de autoría;
- no queda `<code class="language-financial-*">`;
- fuentes, periodos, error-free SVG y tabla están presentes;
- SSR y preview devuelven HTML idéntico;
- el fixture no contiene afirmaciones como recomendación de compra/venta.

- [ ] **Step 4: Ejecutar pruebas para verificar los fallos**

Run: `npx vitest run src/application/browser/createMarkdownExtensions.test.ts src/application/server/Application.test.ts src/financial-content/shared/test/FinancialNoteIntegration.test.ts src/rendering/shared/MarkdownRendererParity.test.ts`

Expected: FAIL porque la extensión aún no está compuesta.

- [ ] **Step 5: Permitir extensiones en `PublishingModule.create`**

Firma exacta:

```ts
static async create(
  eventBus: EventBus,
  extensions: readonly MarkdownExtension[] = [],
): Promise<PublishingModule>;
```

Construir `new UnifiedMarkdownRenderer(extensions)`. No importar `financial-content` dentro de `publishing`.

- [ ] **Step 6: Componer servidor**

En `Application.create()`:

```ts
const markdownExtensions = [createFinancialContentExtension()];
const publishingModule = await PublishingModule.create(eventBus, markdownExtensions);
```

La extensión es una capacidad interna de composición; no añadir `financialContentModule` público si no existe comportamiento de aplicación propio.

- [ ] **Step 7: Componer navegador**

`createMarkdownExtensions()` devuelve un arreglo readonly nuevo con `createFinancialContentExtension()`. El Worker continúa importando únicamente esta factoría de `application/browser`.

- [ ] **Step 8: Ampliar matriz de paridad**

Añadir el fixture financiero completo a `MarkdownRendererParity.test.ts` y mantener todos los fixtures Markdown previos.

- [ ] **Step 9: Ejecutar pruebas verticales**

Run: `npx vitest run src/application src/rendering/shared src/financial-content src/publishing/server`

Expected: PASS; SSR y preview coinciden byte por byte para el fixture.

- [ ] **Step 10: Ejecutar build**

Run: `npm run build`

Expected: exit 0; la extensión se incluye tanto en SSR como en el Worker sin APIs de Node en el bundle cliente.

- [ ] **Step 11: Commit**

```bash
git add src/application src/publishing/server/index.ts src/rendering/shared/MarkdownRendererParity.test.ts src/financial-content/shared/test
git commit -m "feat(rendering): integra contenido financiero"
```

### Task 8: Documentación, changelog y verificación final

**Files:**
- Create: `src/content/nanobook-project/arquitectura/contenido-financiero.md`
- Modify: `src/content/nanobook-project/index.md`
- Modify: `docs/superpowers/specs/2026-11-05-financial-content-blocks-design.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: comportamiento final de Tasks 1–7.
- Produces: documentación de autoría y arquitectura, registro de decisiones y rama lista para revisión integral.

- [ ] **Step 1: Documentar autoría y arquitectura**

La nota debe incluir:

- propósito y no recomendación de inversión;
- ejemplos válidos de los cinco fences;
- tabla de campos requeridos/opcionales y límites;
- reglas de fuente, fecha, moneda, porcentaje y `null`;
- comportamiento de errores;
- flujo Companio → Markdown → preview/SSR;
- frontera `theme`/`rendering`/`financial-content`;
- registro opt-in, manifiesto, fingerprint y futura política por nanobook;
- cómo añadir un nuevo kind mediante schema, renderer, test, estilo y versión.

Enlazar desde `src/content/nanobook-project/index.md`.

- [ ] **Step 2: Sincronizar el diseño con la implementación**

Actualizar únicamente nombres finales de archivos o firmas si la implementación demostró una diferencia necesaria. Marcar el diseño `approved` o equivalente usado por el repositorio; no reescribir la intención.

- [ ] **Step 3: Actualizar changelog**

Bajo `[Unreleased]`, añadir `Added` para bloques financieros y `Changed` para la integración de renderizado si no quedó ya en la rama base. Mencionar preview/SSR, fuentes y accesibilidad; no afirmar datos en tiempo real.

- [ ] **Step 4: Ejecutar verificaciones focalizadas de seguridad**

Run: `npx vitest run src/financial-content src/rendering/shared/MarkdownRendererParity.test.ts src/theme/browser/ui/styles/themeStyles.test.ts`

Expected: PASS, 0 fallos.

- [ ] **Step 5: Ejecutar suite completa**

Run: `npm test`

Expected: exit 0, 0 tests fallidos.

- [ ] **Step 6: Ejecutar build obligatorio**

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 7: Comprobar diff y alcance**

Run: `git diff --check`

Expected: sin errores.

Run: `git status --short && git diff --stat codex/rendering-extensions...HEAD`

Expected: solo módulo financiero, composición, pruebas y documentación; ningún cambio accidental de documentos protegidos.

- [ ] **Step 8: Commit**

```bash
git add CHANGELOG.md docs/superpowers/specs/2026-11-05-financial-content-blocks-design.md src/content/nanobook-project
git commit -m "docs(financial-content): documenta bloques financieros"
```

## Self-Review Record

- Spec coverage: las ocho tareas cubren contrato v1, trazabilidad, datos incompletos, formato, cinco renderizadores, seguridad, accesibilidad, theme, composición, caché heredada, fixture, documentación y changelog.
- Extensibilidad: Task 3 fija el manifiesto opt-in y Task 7 demuestra renderizado con y sin el módulo; el runtime remoto y la selección por nanobook siguen diferidos.
- Step scan: cada paso produce una prueba, interfaz, renderer, integración o verificación única; no incluye cuerpos completos salvo constantes geométricas y resultados fijados por el spec.
- Type consistency: `FinancialFenceKind`, `FinancialBlock`, `parseFinancialBlock`, `FinancialRenderContext`, `renderFinancialBlock` y `createFinancialContentExtension` mantienen las mismas firmas en todas las tareas.
- Review Focus: los cinco riesgos se prueban en Tasks 1, 3, 5 y 6, con verificación vertical en Task 7.
- Proportion: el plan divide contratos, formato, presentación, composición y documentación en entregas revisables sin crear un runtime genérico de plugins.
