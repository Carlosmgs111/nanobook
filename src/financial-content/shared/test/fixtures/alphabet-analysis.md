# Alphabet Inc. · Nota de demostración

Esta nota muestra cómo combinar un perfil, métricas, un gráfico, noticias y fuentes en Markdown. **Las cifras y la noticia son simuladas**. Los enlaces de `example.com` son referencias de demostración.

```company-profile
version: 1
title: Perfil de Alphabet
company:
  name: Alphabet Inc.
  ticker: GOOGL
  exchange: Nasdaq
  country: Estados Unidos
  industry: Tecnología
  description: Empresa matriz de Google.
  reportingCurrency: USD
  asOf: 2024-12-31
  sourceIds: [perfil-demo]
sources:
  - id: perfil-demo
    label: Ficha de demostración
    url: https://example.com/alphabet/perfil
    type: other
    period: { label: Cierre de 2024, to: 2024-12-31 }
```

## Lectura del ejercicio ilustrativo

Las métricas muestran el último año del escenario. El gráfico presenta la misma serie de ingresos para los tres años simulados.

```financial-metrics
version: 1
title: Métricas del escenario
metrics:
  - label: Ingresos simulados (miles de millones de USD)
    value: 125
    unit: currency
    currency: USD
    precision: 0
    period: { label: Ejercicio simulado 2024, from: 2024-01-01, to: 2024-12-31 }
    sourceIds: [serie-demo]
  - label: Margen operativo simulado
    value: 18
    unit: percent
    period: { label: Ejercicio simulado 2024, from: 2024-01-01, to: 2024-12-31 }
    sourceIds: [serie-demo]
sources:
  - id: serie-demo
    label: Conjunto de datos simulados
    url: https://example.com/alphabet/datos-simulados
    type: dataset
    period: { label: Serie simulada 2022–2024, from: 2022-01-01, to: 2024-12-31 }
```

```financial-chart
version: 1
title: Evolución de los ingresos simulados
description: Cada punto representa un ejercicio del escenario ficticio.
chart: line
x: ["2022", "2023", "2024"]
series:
  - name: Ingresos (miles de millones de USD)
    unit: currency
    currency: USD
    precision: 0
    values: [100, 110, 125]
    sourceIds: [serie-demo]
sources:
  - id: serie-demo
    label: Conjunto de datos simulados
    url: https://example.com/alphabet/datos-simulados
    type: dataset
    period: { label: Serie simulada 2022–2024, from: 2022-01-01, to: 2024-12-31 }
```

La siguiente entrada muestra cómo citar una noticia y relacionarla con una métrica del ejercicio.

```financial-news
version: 1
title: Contexto ficticio
items:
  - title: Ejemplo de noticia sobre los ingresos de Alphabet
    summary: La noticia ficticia describe la serie simulada que se usa en esta nota.
    sourceId: noticia-demo
    relatedTickers: [GOOGL]
    mentionedMetrics: [Ingresos simulados (miles de millones de USD)]
sources:
  - id: noticia-demo
    label: Noticia de demostración
    organization: Redacción de ejemplo
    url: https://example.com/alphabet/noticia-ficticia
    type: news
    publishedAt: 2025-01-15
```

```financial-sources
version: 1
title: Referencias de demostración
items:
  - id: perfil-demo
    label: Ficha de demostración
    url: https://example.com/alphabet/perfil
    type: other
    period: { label: Cierre de 2024, to: 2024-12-31 }
  - id: serie-demo
    label: Conjunto de datos simulados
    url: https://example.com/alphabet/datos-simulados
    type: dataset
    period: { label: Serie simulada 2022–2024, from: 2022-01-01, to: 2024-12-31 }
  - id: noticia-demo
    label: Noticia de demostración
    organization: Redacción de ejemplo
    url: https://example.com/alphabet/noticia-ficticia
    type: news
    publishedAt: 2025-01-15
```
