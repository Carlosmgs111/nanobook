# Financial Content

> Extensión de Markdown que añade al documento seis bloques financieros (`company-profile`, `financial-metrics`, `financial-chart`, `financial-news`, `financial-sources`, `price-chart`) escritos como fences YAML, con su validador y su guía de autoría para agentes.

**Nivel:** Opcional  ·  **Entornos:** browser / shared

## Qué hace
- Declara seis bloques de componente (nombre de fence, componente `.astro` y esquema de props) y los registra en el `BlockRegistry` de `rendering`.
- Valida cada bloque con esquemas Zod estrictos (campos extra, fuentes rotas, fechas, monedas, longitudes de series) y devuelve mensajes en español.
- Renderiza cinco fichas como componentes `.astro` solo de servidor (HTML + SVG accesible + tabla equivalente) y `price-chart` como isla de React con `lightweight-charts`.
- Ofrece a los agentes (`markdownBlockAdvisor`) la guía de autoría y un validador de documentos completos que informa línea, bloque y campo.
- Aporta formato de fechas/valores y la hoja de estilos de las fichas (consume roles CSS de `theme`).
- NO define transporte con Companio, ni autenticación, ni persistencia: el Markdown lo guarda `documents`; NO ejecuta el YAML ni consulta servicios externos al renderizar; NO emite recomendaciones de inversión.
- NO tiene `server/`: no hay casos de uso, puertos ni endpoints propios.

## Cómo está construido
```text
financial-content/
  browser/
    index.ts                 # FinancialContentModule (create + markdownBlockAdvisor)
    blocks.ts                # financialBlocks: datos puros {name, component, props}
    components/<Bloque>/     # <Bloque>.astro + <Bloque>.schema.ts (CompanyProfile, FinancialChart,
                             #   FinancialMetrics, FinancialNews, FinancialSources, PriceChart)
      FinancialChart/        # ChartGeometry.ts, chartView.ts (modelo de vista puro)
      PriceChart/            # PriceChartIsland.tsx, createPriceChart.ts, priceChartSummary.ts
    ui/                      # ExternalLink, FinancialPeriod, FinancialTime, SourceDates, blockIndex.ts
    ui/styles/financial-content.css
  shared/
    model/                   # FinancialBlock.ts, FinancialSource.ts (tipos del contrato v1)
    validation/              # financialPrimitives.ts (esquemas comunes), financialIssueMessages.ts,
                             #   validateMarkdownBlocks.ts (validador de documentos)
    components/financialBlockProps.ts
    formatting/              # formatFinancialDate.ts, formatFinancialValue.ts
    guide/financialAuthoringGuide.ts
    test/                    # integración y fixture alphabet-analysis.md
```
- **Sin capas domain/application/infraestructure**: no hay lógica de negocio de servidor. El contrato (`shared/model` + `shared/validation`) es puro; `browser/` contiene presentación.
- **Registro.** `financialBlocks` son datos puros (ruta del componente como string y esquema, sin importar el `.astro`) para que también los cargue el Worker de la vista previa. `financialBlockProps(kind, schema)` envuelve cada esquema: inyecta `kind` (lo fija el nombre de la fence; uno escrito a mano se ignora), pone `version: 1` por defecto y traduce las incidencias al mensaje del contrato. `price-chart` usa `priceChartProps` directamente (sin `kind` ni fuentes).
- **Puertos:** consume `BlockRegistry` y `ComponentBlockDefinition` de `rendering/shared`. Entrega a `agents` una forma compatible con su puerto `MarkdownBlockAdvisor` (`guide()` y `validate(content)`).
- **Islas / librerías:** `PriceChart.astro` monta `PriceChartIsland.tsx` con `client:visible`; el servidor entrega `figure`, título, hueco del alto exacto y un resumen de texto, y tras hidratar importa de forma diferida `createPriceChart` (`lightweight-charts`: `CandlestickSeries`, `AreaSeries`, `LineSeries`, colores desde `--theme-*`). Resto: `yaml`, `zod`, `unified`/`remark-parse` (validador); `react` solo para la isla.
- Eventos, persistencia y caché: no aplica. Las fichas no pasan por la caché de Markdown (la caché guarda HTML con marcadores y Astro pinta cada ficha al servir).

## Cómo se usa
Cada bloque es una fence cuyo nombre es el tipo y cuyo contenido es YAML. Sintaxis soportada (ejemplos reales en `shared/guide/financialAuthoringGuide.ts`, exportados como `financialGuideExamples` y verificados contra los esquemas por pruebas):

````markdown
```financial-chart
version: 1
title: Ingresos anuales
chart: line
x: ["2023", "2024", "2025"]
series:
  - name: Ingresos (millones de COP)
    unit: currency
    currency: COP
    values: [80, null, 105]
    sourceIds: [serie]
sources:
  - id: serie
    label: Serie histórica
    url: https://example.com/serie
    type: dataset
    period: { label: Ejercicios 2023 a 2025, from: 2023-01-01, to: 2025-12-31 }
```

```price-chart
title: Cotización de EJEM
height: 320
series:
  type: candlestick
  data:
    - { time: 2026-01-05, open: 100.0, high: 102.5, low: 99.2, close: 101.8 }
    - { time: 2026-01-06, open: 101.8, high: 103.9, low: 101.0, close: 102.4 }
```
````

| Fence | Contenido | Límites (esquema) |
|---|---|---|
| `company-profile` | `company` (name, ticker, exchange, country, industry, description, reportingCurrency, asOf, links?, sourceIds) + `sources` | strict |
| `financial-metrics` | `metrics[]` (label, value, unit, currency?, precision?, period, comparison?, sourceIds) + `sources` | 1 a 12 métricas |
| `financial-chart` | `chart: line|bar`, `x[]`, `series[]` (name, unit, currency?, precision?, values con `null`, sourceIds) + `sources` | hasta 8 series y 120 puntos; `values` = longitud de `x`; series con misma unidad/moneda |
| `financial-news` | `items[]` (title, summary, sourceId, relatedTickers?, mentionedMetrics?) + `sources` | 1 a 12; la fuente debe ser `type: news` |
| `financial-sources` | `items[]` de fuentes (id, label, organization?, url, type, publishedAt?, period?, accessedAt?) | 1 a 30 |
| `price-chart` | `title?`, `height` (160-800, def. 360), `series` con `type: line|area` (`time`, `value`) o `candlestick` (`time`, `open`, `high`, `low`, `close`) | 1 a 5000 puntos, fechas `YYYY-MM-DD` ascendentes y sin repetir; una serie |

Reglas comunes: `unit` ∈ `number|percent|currency|multiple`; porcentajes en puntos porcentuales; moneda de 3 letras mayúsculas y solo con `unit: currency`; fechas civiles `YYYY-MM-DD`; URL HTTPS; `id` de fuente en minúsculas ASCII/dígitos/guiones; cada bloque lleva sus propias `sources` (solo `price-chart` no). Un bloque inválido se sustituye por un recuadro `component-block-error` en línea y el resto del documento continúa.

**Cómo se compone (registro).**
- Servidor: `src/application/server/Application.ts` hace `FinancialContentModule.create(renderingModule.blocks)` y pasa `financialContentModule.markdownBlockAdvisor` a `AgentModule.create(...)`.
- Vista previa: `src/documents/browser/infraestructure/renderer/WorkerMarkdownRenderer/worker-entry.ts` llama a `FinancialContentModule.create(blocks)`.
- Estilos: `src/shared/styles/global.css` importa `financial-content/browser/ui/styles/financial-content.css`.
- Agentes: la herramienta de validación (`validate_markdown_blocks`) y la guía salen de `markdownBlockAdvisor`; el validador usa `blocks.blocks`, o sea los esquemas reales registrados (no solo los financieros).

**Cómo quitarla.** (1) Borrar `FinancialContentModule.create(...)` en `Application.ts` y en `worker-entry.ts`; (2) dar a `AgentModule.create` un `MarkdownBlockAdvisor` alternativo (vacío o basado solo en `blocks.blocks`) en lugar de `financialContentModule.markdownBlockAdvisor`; (3) quitar el `@import` en `global.css`; (4) borrar `src/financial-content/` y sus pruebas que importan `Application` (`FinancialNoteIntegration.test.ts`) y `application/shared/MarkdownRendererParity.test.ts` (usa el fixture financiero); (5) opcional: retirar `lightweight-charts` de `package.json`. `rendering` no depende de este módulo, así que no cambia; los documentos existentes con estas fences se publicarían como código normal.

## Dependencias
- **Depende de:** `rendering/shared` (`BlockRegistry`, `ComponentBlockDefinition`) y, en estilos, de roles CSS de `theme`. Sin imports de otros módulos de negocio en código de producción.
- **Lo usan:** `application` (composición servidor y Worker), `agents` (vía el puerto `MarkdownBlockAdvisor`, sin importar este módulo), `documents/browser` (el renderer de vista previa del Worker).
- **Acoplamiento a vigilar:** `FinancialNoteIntegration.test.ts` importa `application/server/Application` y `documents/browser/.../UnifiedMarkdownRenderer` (solo pruebas). `browser/blocks.ts` hardcodea la ruta `/src/financial-content/browser/components`; renombrar la carpeta rompe el registro sin error de compilación.

## Seguridad y autorización
No aplica autorización: el módulo no accede a datos protegidos. Seguridad de contenido: los `.astro` escapan todo texto del autor, no ejecutan código ni descargan artículos; los esquemas son `strict` y exigen URL HTTPS. El YAML se lee con `yaml.parse` estándar (sin el parser endurecido de la v1; endurecerlo es una mejora pendiente según la doc de decisión).

## Pruebas
Junto al código (`*.test.ts`, y `*.astro.test.ts` para componentes Astro): esquemas y mensajes, geometría y vista del gráfico, resumen/esquema/isla de `PriceChart`, formato, `validateMarkdownBlocks`, el módulo (`FinancialContentModule.test.ts`), estilos y una integración con `shared/test/fixtures/alphabet-analysis.md`.
`npx vitest run src/financial-content` (unitarias) y `npx vitest run --config vitest.astro.config.ts src/financial-content` (componentes Astro, como en `npm run test:astro`).

## Decisiones y límites conocidos
- Pendientes: la guía de agentes no menciona los bloques de `spreadsheets`; el prefijo de "casi aciertos" del validador (`financial-`, `company-`, `price-`) no cubre `spreadsheet`.
