/**
 * Guía de autoría de bloques financieros para agentes. Los ejemplos son datos
 * exportados para que una prueba compruebe que cumplen los esquemas reales; la
 * guía no puede describir un contrato que el código ya no acepta.
 */

const FENCE = "```";

export const financialGuideExamples = {
  "company-profile": `version: 1
title: Perfil de Empresa Ejemplo
company:
  name: Empresa Ejemplo S. A.
  ticker: EJEM
  exchange: Bolsa de ejemplo
  country: Colombia
  industry: Tecnología
  description: Descripción breve de lo que hace la empresa.
  reportingCurrency: COP
  asOf: 2025-12-31
  sourceIds: [perfil]
sources:
  - id: perfil
    label: Ficha de la empresa
    url: https://example.com/perfil
    type: other
    period: { label: Cierre de 2025, to: 2025-12-31 }`,

  "financial-metrics": `version: 1
title: Resultados del ejercicio
metrics:
  - label: Margen operativo
    value: 16.7
    unit: percent
    period: { label: Ejercicio 2025, from: 2025-01-01, to: 2025-12-31 }
    sourceIds: [datos]
  - label: Ingresos
    value: 105
    unit: currency
    currency: COP
    precision: 0
    period: { label: Ejercicio 2025, from: 2025-01-01, to: 2025-12-31 }
    sourceIds: [datos]
sources:
  - id: datos
    label: Informe anual 2025
    url: https://example.com/informe
    type: filing
    period: { label: Ejercicio 2025, from: 2025-01-01, to: 2025-12-31 }`,

  "financial-chart": `version: 1
title: Ingresos anuales
description: Cada punto es un ejercicio; el hueco indica que no hay dato.
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
    period: { label: Ejercicios 2023 a 2025, from: 2023-01-01, to: 2025-12-31 }`,

  "financial-news": `version: 1
title: Contexto reciente
items:
  - title: La empresa presenta resultados
    summary: Resumen en una o dos frases de lo que dice la noticia.
    sourceId: noticia
    relatedTickers: [EJEM]
sources:
  - id: noticia
    label: Titular de la noticia
    url: https://example.com/noticia
    type: news
    publishedAt: 2026-01-15`,

  "financial-sources": `version: 1
title: Referencias
items:
  - id: informe
    label: Informe anual 2025
    organization: Empresa Ejemplo S. A.
    url: https://example.com/informe
    type: filing
    period: { label: Ejercicio 2025, to: 2025-12-31 }
    accessedAt: 2026-02-01`,

  "price-chart": `title: Cotización de EJEM
height: 320
series:
  type: candlestick
  data:
    - { time: 2026-01-05, open: 100.0, high: 102.5, low: 99.2, close: 101.8 }
    - { time: 2026-01-06, open: 101.8, high: 103.9, low: 101.0, close: 102.4 }
    - { time: 2026-01-07, open: 102.4, high: 103.0, low: 100.1, close: 101.1 }`,
} as const;

function example(name: keyof typeof financialGuideExamples): string {
  return `${FENCE}${name}\n${financialGuideExamples[name]}\n${FENCE}`;
}

export const financialAuthoringGuide = `# Guía para escribir bloques financieros en un documento

Un documento de nanobook es Markdown. Cuando la conversación trate de una empresa cotizada y hayas obtenido cifras, precios o noticias de una fuente (Companio u otra), preséntalos con **bloques**: fences de código cuyo nombre es el tipo de bloque y cuyo contenido es YAML. Escribe además el análisis en Markdown normal alrededor de ellos. El nombre de la fence es el tipo; no escribas un campo \`kind\`.

## Reglas que no admiten excepción

1. **No inventes nada.** Usa solo datos que hayas obtenido en esta conversación. Si falta un valor de una serie, escribe \`null\`; si falta una fuente, no incluyas el dato.
2. **Cada bloque lleva sus propias fuentes** (\`sources\`) y cada métrica, serie o noticia las cita por \`id\` (\`sourceIds\`/\`sourceId\`) dentro del mismo bloque. Una bibliografía final no sustituye eso. Los \`id\` usan solo minúsculas ASCII, dígitos y guiones.
3. **Las URL son HTTPS absolutas** y reales; nunca fabriques una. Cada fuente necesita \`label\`, \`url\`, \`type\` (\`filing\`, \`earnings\`, \`news\`, \`dataset\` u \`other\`) y una fecha: \`publishedAt\` o \`period\`.
4. **Fechas civiles \`YYYY-MM-DD\`**, sin hora ni zona. Las etiquetas del eje \`x\` son siempre texto: \`"2025"\`, no \`2025\`.
5. **Porcentajes en puntos porcentuales**: \`16.7\` significa 16,7 %; no lo multipliques por 100.
6. **Moneda** como código de tres letras mayúsculas (\`COP\`, \`USD\`). \`currency\` se escribe solo con \`unit: currency\`; las unidades son \`number\`, \`percent\`, \`currency\` y \`multiple\`.
7. **No hay campos extra.** Un campo desconocido invalida el bloque entero.
8. Esto es evidencia y contexto, **no una recomendación de inversión**. No escribas «compra» ni «vende» como conclusión del bloque.

## Qué bloque elegir

| Quieres mostrar | Bloque |
|---|---|
| Quién es la empresa (ticker, bolsa, país, sector) | \`company-profile\` |
| Cifras sueltas de un periodo (margen, ingresos, múltiplos) | \`financial-metrics\` (1 a 12 métricas) |
| Evolución de cifras fundamentales por periodo (ingresos por año) | \`financial-chart\` (línea o barras, hasta 8 series y 120 puntos; estático y accesible) |
| Evolución de un **precio** de mercado, con velas o área, interactiva | \`price-chart\` (hasta 5000 puntos por serie) |
| Noticias con su fuente | \`financial-news\` (1 a 12) |
| Bibliografía visible al final | \`financial-sources\` (1 a 30) |

Los bloques pueden ir en cualquier orden, entre párrafos y encabezados.

## Plantillas válidas

### company-profile
${example("company-profile")}

### financial-metrics
${example("financial-metrics")}

### financial-chart
\`values\` tiene un valor por cada etiqueta de \`x\`; \`chart\` es \`line\` o \`bar\`; todas las series comparten unidad y moneda; al menos un valor debe ser un número.
${example("financial-chart")}

### financial-news
La fuente de cada noticia debe ser de \`type: news\`.
${example("financial-news")}

### financial-sources
${example("financial-sources")}

### price-chart
\`series.type\` es \`line\` o \`area\` (con \`value\`) o \`candlestick\` (con \`open\`, \`high\`, \`low\`, \`close\`). Las fechas son diarias y ascendentes, sin repetir. \`height\` es opcional (160 a 800, por defecto 360). Una sola serie por bloque.
${example("price-chart")}

## Flujo recomendado

1. Obtén los datos y anota de dónde sale cada uno.
2. Escribe el documento con los bloques de arriba.
3. Llama a \`validate_markdown_blocks\` con el contenido y corrige cada problema que informe (indica la línea, el bloque y el campo).
4. Cuando no haya problemas, guarda con \`create_document\` o \`update_document\` **en un documento propio** (por ejemplo con path \`resumen\`), nunca en el \`index\` ni en un path que termine en \`/index\`: los índices solo muestran su título, su descripción y la lista de sus documentos, no su cuerpo.

## Errores frecuentes

- Escribir \`2025\` sin comillas en \`x\`, o una fecha con hora.
- Multiplicar por 100 un porcentaje.
- Olvidar \`currency\` con \`unit: currency\`, o ponerlo con otra unidad.
- Citar en \`sourceIds\` un \`id\` que no está en \`sources\` del mismo bloque.
- Usar una fuente que no es \`news\` en una noticia.
- Nombrar mal la fence (\`financial-chartt\`): se publicaría como código normal; el validador lo avisa.
- Poner \`version: 2\`: solo existe la versión 1 (y es opcional).
`;
