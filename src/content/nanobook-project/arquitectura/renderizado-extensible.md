---
id: "renderizado-extensible-2026-11-05"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Renderizado Markdown extensible"
description: "Núcleo compartido, composición de extensiones y validez de la caché de publicación."
date: 2026-11-05
author: "Nanobook"
tags: ["nanobook", "arquitectura", "renderizado"]
draft: false
---

# Renderizado Markdown extensible

## Núcleo y contrato

`src/rendering/shared/renderMarkdown.ts` concentra el pipeline Unified: parseo
Markdown, GFM, conversión a HAST, transformaciones de extensiones, IDs de
encabezados, resaltado Shiki y serialización HTML. Este módulo no importa Astro,
APIs de Node.js, adaptadores de I/O ni módulos de negocio, por lo que lo usan
tanto el servidor como el Web Worker del navegador. `renderMarkdown` acepta una
lista opcional de `MarkdownExtension`; la lista vacía conserva el renderizado
Markdown básico. El núcleo no depende de `financial-content`.

Cada extensión declara `id`, `version` y `fenceLanguages`, además de
`transform(tree: Root): void`. El manifiesto identifica la implementación y
ofrece los lenguajes de fence para una eventual selección confiable antes de
cargarla; actualmente el pipeline ejecuta todas las extensiones suministradas
en el orden recibido y no selecciona por `fenceLanguages`. Los `id` duplicados
se rechazan. El contrato exige una transformación síncrona de HAST; el pipeline
no espera promesas y la implementación no debe abrir una fase de I/O. La versión
debe cambiar cuando cambie su salida.

## Composición y paridad

`src/application/shared/createMarkdownExtensions.ts` es la única lista de
extensiones (hoy las de `financial-content`). `application/server/Application.ts`
se la entrega a `PublishingModule`, que construye `UnifiedMarkdownRenderer`; ese
renderer adapta `renderMarkdown` al contrato de publicación. En el navegador, el
Worker usa la misma función para el renderer de vista previa. Ambos adaptadores
usan el mismo `renderMarkdown`; con la misma fuente y el mismo conjunto ordenado
de extensiones producen el mismo HTML, y al compartir la lista no pueden
divergir por un olvido en una de las dos raíces. `rendering` y `publishing` conservan la posibilidad de
recibir una lista vacía y siguen siendo independientes de `financial-content`.
Todavía no existe selección de extensiones por documento o nanobook.

## Validez de caché

El renderer de publicación expone `fingerprint`, calculado con
`RENDERER_VERSION` y los pares `id@version` de las extensiones en orden. El
publicador combina ese fingerprint con el `contentHash` del documento para la
clave de validez del HTML cacheado. Cambiar la versión del núcleo, una
extensión, su conjunto o su orden invalida ese HTML aunque el documento no
cambie. El `contentHash` público que devuelve `PagePublisher.publish` sigue
siendo exclusivamente el del documento.

## Límite de seguridad

Una extensión es código de aplicación confiable, compuesto explícitamente;
el Markdown no puede instalarla ni ejecutar código. `transform` debe operar de
forma determinista sobre el árbol, sin red, archivos, secretos ni otras
consultas de I/O durante el renderizado. Las extensiones que interpreten
fences deben validar los datos y construir nodos seguros; el contrato del
núcleo por sí solo no sanitiza la salida de una extensión maliciosa.
