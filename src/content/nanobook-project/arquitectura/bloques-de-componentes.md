---
id: "bloques-de-componentes-2026-11-06"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Bloques de componentes en Markdown"
description: "Cómo un documento usa componentes de librerías (lightweight-charts, React, vanilla) mediante fences y un registro cliente que cada módulo alimenta."
date: 2026-11-06
author: "Nanobook"
tags: ["nanobook", "arquitectura", "renderizado"]
draft: false
---

# Bloques de componentes en Markdown

El renderizador es una función de texto a texto y no ejecuta código de
componentes. Los documentos referencian un componente por nombre y el
navegador lo monta. `rendering` aporta solo el **mecanismo**; los componentes
concretos pertenecen al módulo que los expone (hoy, `financial-content`).

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

**Navegador** (`rendering/browser`): `registerComponentBlocks(entries)` permite
a cada módulo registrar `nombre → cargador diferido`; registrar un nombre ya
tomado por otro cargador falla. `installComponentBlocks()` monta cada
`[data-component]` presente y los que aparezcan después (`MutationObserver` sobre `<html>`,
no sobre `<body>`: el router de Astro sustituye el `<body>` al navegar sin recargar,
y un observador pegado al anterior no vería la página nueva; además se reescanea
en `astro:page-load`). La librería solo se descarga
en páginas que usen el bloque.

`rendering` no importa ningún módulo de negocio.

## Quién aporta qué (`financial-content`)

- `shared/components/priceChart.ts`: nombre y esquema de props de `price-chart`,
  más `financialComponentBlockDefinitions`.
- `shared/rendering/createFinancialContentExtensions.ts`: devuelve, en orden,
  la extensión de fichas (`financial-content`) y la de componentes
  (`financial-components`).
- `browser/components/priceChart.ts`: montador con `lightweight-charts`.
- `browser/financialComponentMounts.ts`: mapa nombre → cargador diferido.
- Estilos propios en `browser/ui/styles/financial-content.css`.

## Composición

- Servidor y Worker obtienen las extensiones de
  `application/shared/createMarkdownExtensions.ts` (una sola lista).
- En el navegador de página, `application/browser/installComponentBlocks.ts`
  registra los montadores de cada módulo y activa el montaje; `Layout.astro` lo
  importa.

## Añadir un componente a un módulo

1. Definir nombre y esquema de props y añadirlo a las definiciones del módulo.
2. Escribir su montador `(element, props) => cleanup?` (React con `createRoot`,
   Svelte o DOM vanilla) y añadirlo al mapa de montadores del módulo.
3. Si el módulo es nuevo, registrar sus extensiones en
   `createMarkdownExtensions.ts` y sus montadores en `installComponentBlocks.ts`.

Un test por módulo verifica que toda definición tenga montador.

## Primer componente: `price-chart`

Usa TradingView `lightweight-charts`. Series `line`, `area` o `candlestick`:

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

## Límites

- Solo se ejecutan componentes registrados; un autor no puede subir código.
- Los colores se leen de las variables `--theme-*` al montar y no se actualizan
  al cambiar de tema sin recargar.
- Un cambio de esquema debe subir la `version` de la extensión para invalidar
  la caché de páginas renderizadas.
- En desarrollo, `lightweight-charts` figura en `vite.optimizeDeps.include`
  para evitar el 504 `Outdated Optimize Dep` en la primera carga.
