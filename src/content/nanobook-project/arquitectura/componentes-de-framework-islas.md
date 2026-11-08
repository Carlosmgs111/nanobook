---
id: "componentes-de-framework-islas-2026-11-08"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Componentes de framework como islas de Astro"
description: "Decisión de renderizar en servidor e hidratar componentes .tsx/.vue/.svelte referenciados por fences, y por qué se descartaron MDX, las etiquetas dinámicas y la composición por Markdown generado."
date: 2026-11-08
author: "Nanobook"
tags: ["nanobook", "arquitectura", "renderizado", "decisiones"]
draft: false
---

# Componentes de framework como islas de Astro

Registro de la decisión. El funcionamiento está en `bloques-de-componentes`.

## Contexto

Los bloques de componentes solo se montaban en el navegador y cada componente
exigía escribir un montador a mano. Se quería declarar componentes con la
extensión nativa de su librería (`.tsx`, `.vue`…), que aparecieran en el HTML
inicial y que siguieran siendo interactivos tras renderizarse.

Restricciones del sistema:

- El renderizador Markdown es una función de texto a HTML que comparten el
  servidor, el Worker de la vista previa y la caché de páginas renderizadas.
- Los documentos los escriben usuarios y agentes MCP y se guardan en base de
  datos: nada del autor puede ejecutarse como código.

## Decisión

1. La extensión de bloques sigue interceptando las fences, validando las props con
   zod y emitiendo un punto de montaje. Los bloques de raíz se rodean además con
   marcadores (`nb:block-start` / `nb:block-end`).
2. Al servir la página, `resolveDocumentPieces` parte el HTML cacheado en
   segmentos y `RenderedDocument.astro` los pinta en orden: el HTML tal cual y
   cada bloque de framework como una isla de Astro (SSR más `client:visible`).
3. Los componentes se declaran como `Nombre.<ext>` + `Nombre.block.ts` y un
   script genera el archivo `.astro` que los importa. Se apoya en las
   integraciones oficiales de Astro, que ya resuelven SSR e hidratación por
   framework.

## Alternativas descartadas

**MDX (o Markdown generado y compilado con MDX).** Un documento MDX es código:
admite `import` y expresiones. Compilar texto de origen no confiable equivale a
ejecutar código ajeno en el servidor. Generar el MDX a partir de las fences no lo
arregla, porque la prosa del autor también pasaría por el compilador (un `{`, un
`<` o una línea que empiece por `import` se interpretarían como código), y obliga
a compilar en tiempo de ejecución, algo que `@astrojs/mdx` no hace (compila en el
build).

**Elegir el componente con una variable** (`const C = registro[nombre]` y
`<C client:visible />`). La documentación de Astro indica que las directivas
`client:*` solo funcionan sobre un componente importado directamente en un
`.astro`, y no se admiten con etiquetas dinámicas ni con componentes recibidos por
props: Astro necesita saber en compilación qué módulo empaquetar para el cliente.
Se detectó antes de implementar y se resolvió con el host generado.

**Contenedor de Astro por componente (`AstroContainer.renderToString`).**
Funciona, pero se pierden los assets de hidratación de la página, complica la
caché y no evita tener que importar los componentes de forma estática.

**Árbol React completo para todo el documento.** Obliga a ejecutar React en
servidor, Worker y vista previa, hidratar el documento entero y rompe la
propiedad de que el renderizador sea una función de texto a HTML.

## Consecuencias

- La caché de páginas renderizadas no cambia de formato; el corte en segmentos se
  hace al servir y es una búsqueda lineal de texto.
- Los marcadores solo se emiten para bloques de raíz: partir el HTML dentro de una
  lista o una cita rompería su etiqueta. Los bloques de framework anidados no se
  hidratan y muestran su contenido alternativo.
- `financial-components` pasó a la versión `2` porque su HTML cambió; la huella de
  caché invalida así las páginas ya renderizadas.
- Añadir un componente de framework requiere dos archivos y regenerar el host; el
  host generado se versiona y una prueba falla si está desactualizado.
- La vista previa del editor queda fuera de esta decisión. El Worker no puede
  ejecutar el SSR de Astro: hoy muestra el contenido alternativo de los
  componentes de framework. Las opciones evaluadas fueron un marcador
  informativo, SSR por endpoint y cargar el hidratador de cada integración a
  mano; queda pendiente.
- Las props son datos JSON (sin funciones ni `Date`) y la directiva de hidratación
  es fija (`client:visible`).

## Verificación realizada

Prueba de humo previa: el host con importación directa genera `astro-island`
hidratable con React 19 y `@astrojs/react` 7, con `resolve.conditions: ["worker"]`
activa, en desarrollo y en las compilaciones con el adaptador de Node y el de
Vercel. Después, el flujo completo sobre una página temporal: HTML de servidor con
las islas ya renderizadas, orden del documento conservado, ningún marcador
filtrado, componentes vanilla y bloques anidados sin regresión e hidratación
interactiva. En el panel de pruebas se forzó la intersección, porque no entrega
eventos de `IntersectionObserver` en segundo plano; el disparo real de
`client:visible` por scroll queda por comprobar en un navegador.
