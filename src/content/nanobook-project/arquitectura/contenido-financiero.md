---
id: "contenido-financiero-2026-11-05"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Autoría de contenido financiero"
description: "Contrato v1 de los cinco bloques financieros y su integración con Markdown, vista previa y publicación."
date: 2026-11-05
author: "Nanobook"
tags: ["nanobook", "arquitectura", "contenido-financiero"]
draft: false
---

# Autoría de contenido financiero

Los bloques financieros incorporan datos y fuentes a una nota Markdown; pueden
aparecer en cualquier orden, entre párrafos y encabezados normales. Sirven para
presentar evidencia y contexto, **no constituyen una recomendación de inversión**.
Las cifras de los ejemplos siguientes son ficticias y los enlaces de
`example.com` son referencias de demostración. Una nota real debe comprobar sus
datos, periodos y fuentes antes de publicarse.

## Cinco fences v1

El nombre del fence determina `kind`: no se escribe `kind` dentro del YAML.
`version: 1` es opcional; si se omite, el parser asigna la versión 1. Los cinco
ejemplos son bloques independientes. Un ID de fuente se resuelve dentro de su
propio bloque, por lo que una bibliografía final no sustituye las fuentes de
una métrica o un gráfico.

### Perfil de empresa

````markdown
```company-profile
version: 1
title: Perfil ilustrativo
company:
  name: Empresa Ejemplo S. A.
  ticker: EJEM
  exchange: Bolsa de ejemplo
  country: Colombia
  industry: Tecnología
  description: Empresa ficticia para explicar el contrato.
  reportingCurrency: COP
  asOf: 2025-12-31
  sourceIds: [perfil]
sources:
  - id: perfil
    label: Ficha ilustrativa
    url: https://example.com/perfil
    type: other
    period: { label: Cierre de 2025, to: 2025-12-31 }
```
````

### Métricas

````markdown
```financial-metrics
version: 1
title: Resultados ilustrativos
metrics:
  - label: Margen operativo ficticio
    value: 16.7
    unit: percent
    period: { label: Ejercicio 2025, from: 2025-01-01, to: 2025-12-31 }
    sourceIds: [datos]
sources:
  - id: datos
    label: Datos de demostración
    url: https://example.com/datos
    type: dataset
    period: { label: Ejercicio 2025, from: 2025-01-01, to: 2025-12-31 }
```
````

### Gráfico

````markdown
```financial-chart
version: 1
title: Ingresos ficticios
description: Cada punto representa un ejercicio simulado.
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
    label: Serie de demostración
    url: https://example.com/serie
    type: dataset
    period: { label: Ejercicios simulados, from: 2023-01-01, to: 2025-12-31 }
```
````

### Noticias

````markdown
```financial-news
version: 1
title: Contexto ficticio
items:
  - title: La empresa presenta un informe ilustrativo
    summary: Esta noticia inventada muestra cómo citar una fuente pública.
    sourceId: noticia
    relatedTickers: [EJEM]
sources:
  - id: noticia
    label: Noticia de demostración
    url: https://example.com/noticia
    type: news
    publishedAt: 2026-01-15
```
````

### Bibliografía visible

````markdown
```financial-sources
version: 1
title: Referencias ilustrativas
items:
  - id: referencia
    label: Informe de demostración
    organization: Editorial Ejemplo
    url: https://example.com/informe
    type: filing
    period: { label: Ejercicio 2025, to: 2025-12-31 }
    accessedAt: 2026-02-01
```
````

## Campos, límites y significado

| Elemento | Obligatorios | Opcionales y límites |
| --- | --- | --- |
| Todos los bloques | El nombre del fence; `version` efectivo 1. | `title` (salvo en gráfico) y `description`; `version: 1` explícita. Título y cadenas cortas: 1–200 caracteres; descripción y textos largos: 1–2000. No se admiten campos desconocidos. |
| `company-profile` | `company` con `name`, `ticker`, `exchange`, `country`, `industry`, `description`, `reportingCurrency`, `asOf`, `sourceIds`; `sources`. | `company.links` con `label` y URL HTTPS. Cada campo de texto sigue su límite corto o largo. |
| `financial-metrics` | `metrics` (1–12), `sources`; en cada métrica `label`, `value`, `unit`, `period`, `sourceIds`. | `description`, `currency` solo con `unit: currency`, `precision` (0–4), `comparison` con `label`, `value` y `direction` (`favorable`, `unfavorable`, `neutral`). |
| `financial-chart` | `title`, `chart` (`line` o `bar`), `x` (1–120 etiquetas de texto), `series` (1–8) y `sources`; en cada serie `name`, `unit`, `values`, `sourceIds`. | `currency` solo con unidad `currency`, `precision` (0–4). Máximo 120 valores por serie; uno por etiqueta `x`, al menos uno numérico. Todas las series comparten unidad y moneda. |
| `financial-news` | `items` (1–12) y `sources`; cada noticia requiere `title`, `summary`, `sourceId` de una fuente `news`. | `relatedTickers`, `mentionedMetrics` como listas de texto. |
| `financial-sources` | `items` (1–30 fuentes). | `title`, `description`; no enlaza fuentes de otros bloques. |
| Fuente | `id`, `label`, `url`, `type` y `publishedAt` o `period`. | `organization`, `accessedAt`; puede incluir tanto `publishedAt` como `period`. Cada colección de fuentes admite 1–30. |
| Periodo | `label`. | `from`, `to`; fechas civiles ISO. |

Cada fuente tiene un `id` único dentro del bloque: solo letras ASCII minúsculas,
dígitos y guiones, hasta 64 caracteres. `sourceIds` contiene entre 1 y 30 IDs
existentes, sin repeticiones; `sourceId` de una noticia debe señalar una fuente
`type: news`. Los tipos de fuente son `filing`, `earnings`, `news`, `dataset` y
`other`. Las URL deben ser HTTPS absolutas, de hasta 2048 caracteres; no se
admiten controles ni barras invertidas. Es útil consignar `organization` y
`accessedAt` para facilitar la verificación posterior.

Las fechas (`asOf`, `publishedAt`, `accessedAt`, `from`, `to`) son fechas civiles
reales en formato `YYYY-MM-DD`, sin hora ni zona horaria. Las etiquetas `x`
siempre son cadenas: escribe `"2025"`, no `2025`. Los códigos de moneda usan
tres letras mayúsculas, por ejemplo `COP` o `USD`; el validador comprueba esa
forma, no un catálogo de códigos ISO 4217. `reportingCurrency` identifica la
moneda de reporte de la empresa; en series y métricas, `currency` acompaña
exclusivamente a `unit: currency`.

`unit` admite `number`, `percent`, `currency` y `multiple`. Un porcentaje se
expresa en **puntos porcentuales**: `16.7` se muestra como `16,7 %`, sin
multiplicarlo por 100. Los valores monetarios están en unidades mayores; el
renderizador muestra el código de moneda. `precision` admite enteros de 0 a 4;
por defecto usa 1 para porcentaje y múltiplo, y 2 para moneda y número. El
formato de salida es `es-CO`. `value` y los números de `values` deben ser
finitos. Solo los valores de una serie de gráfico admiten `null`: la línea se
interrumpe, la barra se omite y la tabla accesible indica «Sin dato». Una
serie enteramente nula es inválida.

## Errores y seguridad

Un fence financiero inválido se reemplaza completo por una sección de error
accesible que identifica el bloque y, cuando corresponde, la ruta del campo y
un mensaje seguro. No imprime el YAML recibido ni lo interpreta como HTML.
El resto de la nota continúa. Un fence con nombre desconocido conserva el
renderizado normal de código. El parser rechaza alias y etiquetas YAML fuera
del esquema permitido, campos extra, referencias rotas y versiones distintas
de 1. El renderer construye nodos HAST escapados; no ejecuta código, no consulta
servicios externos y no descarga artículos durante la lectura.

## Flujo y fronteras de módulos

Companio puede preparar un análisis y generar Markdown con estos fences.
Nanobook guarda ese Markdown como fuente de verdad. La vista previa en el Web
Worker y la publicación SSR utilizan el mismo pipeline de
`src/rendering/shared/renderMarkdown.ts` y la misma extensión financiera, por
lo que el mismo contenido y conjunto de extensiones producen el mismo HTML.
Cada bloque aporta su fuente local; la nota puede añadir explicación normal
alrededor. Esta entrega no define transporte, autenticación compartida ni
sincronización con Companio.

`financial-content/shared` es dueño del modelo, validación YAML, formato y
renderizadores HTML/SVG. Su hoja en `financial-content/browser/ui/styles` usa
roles CSS de `theme` y presenta perfil, métricas, gráfico, noticias, fuentes y
errores. El gráfico incluye SVG y una tabla de datos equivalente; cuando su
contenedor es estrecho, un resumen HTML mantiene las etiquetas legibles.
`rendering/shared` es dueño del pipeline Markdown general y del puerto
`MarkdownExtension`; no importa el módulo financiero. `publishing/server`
adapta ese pipeline a la caché y a SSR. Las raíces
`application/server/Application.ts` y
`application/browser/createMarkdownExtensions.ts` registran
`createFinancialContentExtension()` explícitamente. `theme` conserva el
contrato de paleta, tipografía, superficies, espaciado y estados; el contenido
financiero solo consume esos roles.

La extensión local declara `id: "financial-content"`, `version: "1"` y un
manifiesto `fenceLanguages` con los cinco nombres. El registro es **opt-in por
composición**: sin la extensión, los fences quedan como código portable. La
huella de caché combina la versión del núcleo y los pares `id@version` de las
extensiones activas en orden; hoy la composición financiera produce
`2|financial-content@1`. El publicador la combina con el hash del documento
para validar HTML cacheado. La lista configurada se copia al construir el
renderer, de modo que mutar después el arreglo del llamador no altera la
salida. La selección de extensiones confiables por nanobook es una posible
evolución futura; todavía no existe una política por libro, carga remota ni
instalación de código declarada por el Markdown.

Para añadir otro tipo de bloque, definir su `kind` y modelo v2 o nuevo contrato
persistido, esquema estricto y límites, parser, renderizador semántico,
referencias a fuentes, estilos basados en `theme` y pruebas de validación,
seguridad, accesibilidad y paridad preview/SSR. Registrar su fence en el
manifiesto y actualizar la versión de la extensión si cambian el parseo o el
HTML/SVG. Los cambios incompatibles de campos persistidos requieren una versión
de bloque y una regla explícita de compatibilidad o migración.

Ver también [Renderizado Markdown extensible](./renderizado-extensible) y el
[diseño de bloques financieros](../../../../docs/superpowers/specs/2026-11-05-financial-content-blocks-design.md).
