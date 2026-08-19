---
title: "Flujo de edición y preview"
description: "Cómo funciona el ciclo editor → preview en Nanobook, incluyendo el uso de workers para renderizar Markdown sin bloquear la UI."
date: 2026-08-19
author: "Nanobook Team"
tags: ["editor", "preview", "client-router", "workers", "codemirror"]
draft: false
index: false
---

## Contexto

Nanobook incluye una vista de edición accesible desde `/{slug}/edit`. En ella se puede modificar el Markdown de un documento y, sin guardar en disco, previsualizar el resultado en `/{slug}/preview`. Este flujo es completamente cliente: el contenido editado viaja por `sessionStorage` y se renderiza en un worker para no bloquear el editor.

## Componentes principales

### `DocumentEditor.astro`

Renderiza el editor con CodeMirror 6.

Responsabilidades:

- Montar CodeMirror en el contenedor del editor.
- Cargar el contenido inicial del documento (del prop de Astro o de `sessionStorage` si existe un borrador).
- Escuchar cambios, actualizar el `Document` en memoria y guardar el borrador en `sessionStorage`.
- Enviar el documento al worker para obtener el HTML renderizado.
- Guardar cambios en disco mediante `PATCH /api/{id}`.

Puntos clave para `ClientRouter`:

- El script es un módulo que persiste entre transiciones, por lo que no puede cachear referencias al DOM.
- Se consulta el wrapper del editor fresco en cada `astro:page-load`.
- La instancia de CodeMirror se destruye en `astro:before-swap` y se vuelve a crear en `astro:page-load`.
- El botón de guardar se clona antes de asignar el listener para evitar listeners duplicados.

### Vista `preview.astro`

Página dinámica (`prerender = false`) que muestra el HTML previamente renderizado.

Responsabilidades:

- Leer `renderedStagedDocument` de `sessionStorage`.
- Inyectar el HTML renderizado en `#preview-container`.

Puntos clave para `ClientRouter`:

- Al igual que el editor, el script de preview escucha `astro:page-load` para renderizar en cada transición.
- Si `sessionStorage` está vacío, muestra un mensaje de fallback en lugar de lanzar un error.

## Flujo de datos

```text
Usuario escribe en CodeMirror
        │
        ▼
updateListener de CodeMirror
        │
        ▼
debouncedOnChange (1 s)
        │
        ▼
updateDocument(editor.getContent())
        │
        ▼
sessionStorage.setItem("stagedDocument", ...)
        │
        ▼
worker.render(stagedDocument)
        │
        ▼
sessionStorage.setItem("renderedStagedDocument", ...)
        │
        ▼
BroadcastChannel("rendered-document") notifica a preview
        │
        ▼
preview.astro lee renderedStagedDocument
        │
        ▼
#preview-container.innerHTML = renderedContent
```

`BroadcastChannel` permite que la vista de preview se refresque automáticamente cuando el worker termina de renderizar, sin necesidad de que el usuario vuelva a cargar la página.

## Workers de renderizado

El renderizado del borrador se ejecuta en un Web Worker para mantener fluida la interfaz del editor, especialmente con documentos grandes o con resaltado de sintaxis.

### Arquitectura

- `src/workers/index.ts` — `MarkdownRenderClient`, una pequeña clase que envía peticiones al worker y devuelve una promesa con el resultado. Cada petición lleva un `id` (UUID) y las respuestas se resuelven mediante un `Map` de promesas pendientes, por lo que varios renders pueden solaparse sin perderse.
- `src/workers/work.ts` — El worker propiamente dicho. Recibe un `RenderRequest`, llama al renderer y responde con el `RenderedDocument` incluyendo el mismo `id`.
- `src/core/rendering/adapters/it-mardown.ts` — Implementación basada en `markdown-it` + `@shikijs/markdown-it` + `markdown-it-anchor`. Usa el motor de regex de JavaScript de Shiki para evitar cargar WASM dentro del worker.
- `src/core/rendering/adapters/astro-markdown.ts` — Implementación alternativa basada en `@astrojs/markdown-remark`.

### Contrato

```ts
interface DocumentRenderer {
  render(document: { id: string; content: string }): Promise<RenderedDocument>;
}

interface RenderedDocument {
  Content: string;
  headings: Heading[];
}
```

El worker serializa el `Document` completo, pero el renderer solo necesita `id` y `content`.

### ¿Por qué un worker?

- **No bloquear el hilo principal**: el renderizado con Shiki puede ser costoso; en un worker no se congela el cursor ni el scroll del editor.
- **Aislar el pipeline de renderizado**: permite cambiar entre `markdown-it` y `@astrojs/markdown-remark` sin tocar el editor.
- **Reutilizar el mismo contrato**: el renderer puede usarse también en servidor si en el futuro se decide renderizar bajo demanda.

### Motor de Shiki

Inicialmente el renderer usaba el motor Oniguruma de Shiki, que depende de un archivo `.wasm`. Dentro de un Web Worker en Vite, la carga dinámica de ese WASM fallaba con:

```
TypeError: Failed to fetch dynamically imported module: .../wasm-XXXX.js
```

La solución fue cambiar al **motor de regex de JavaScript** (`createJavaScriptRegexEngine` de `@shikijs/engine-javascript`). Este motor no requiere WASM, es más ligero para el worker y, con `forgiving: true`, ignora patrones de grammars que no pueda emular.

## Estado en `sessionStorage`

| Clave | Contenido | Quién lo escribe |
|---|---|---|
| `stagedDocument` | `Document` con el contenido editado | `DocumentEditor` (`debouncedOnChange`) |
| `renderedStagedDocument` | `RenderedDocument` con el HTML y headings | `DocumentEditor` (`updateRenderedDocument`) |

Ambos valores se limpian al cerrar la pestaña. No son persistentes entre sesiones porque la edición es un borrador temporal; el guardado definitivo ocurre con el botón **Guardar**.

## Decisiones y tradeoffs

1. **Renderizado en cliente, no en servidor**
   - El preview no hace una petición al servidor; todo ocurre en el navegador.
   - Ventaja: instantáneo y sin sobrecargar el servidor.
   - Costo: el preview solo funciona si el usuario pasó primero por el editor en la misma pestaña.

2. **`sessionStorage` como transporte**
   - Simple y suficiente para el flujo editor → preview.
   - No requiere un backend de borradores.
   - Limitación: no se comparte entre pestañas ni dispositivos.

3. **Worker `markdown-it` como renderer por defecto**
   - Da control total sobre plugins (Shiki, anclas, GFM).
   - Se mantiene `astro-markdown.ts` como alternativa para evaluar paridad de salida.

## Problemas resueltos recientemente

- **Editor vacío al volver de preview**: el script del editor capturaba el wrapper en el scope del módulo; tras una transición de `ClientRouter` apuntaba a un nodo desconectado. Se movió la consulta del DOM a `astro:page-load` y se añadió destrucción en `astro:before-swap`.
- **Preview vacío en la segunda visita**: el script de preview era un IIFE que solo corría una vez. Se convirtió a listener de `astro:page-load`.
- **Doble inicialización del editor**: se eliminó la llamada inmediata a `initEditor()`; `astro:page-load` ya dispara en la carga inicial.
- **Worker perdía respuestas al gestionar peticiones solapadas**: una versión intermedia intentaba cancelar renders terminando y recreando el worker. Se volvió al modelo original de IDs con `crypto.randomUUID()` y un `Map` de promesas pendientes, sin terminar el worker.

## Próximos pasos

- Decidir cuál renderer se queda como principal (`markdown-it` vs `@astrojs/markdown-remark`).
- Extraer headings del HTML renderizado para mantener el TOC en preview.
- Añadir indicador de "guardando..." y manejo de errores de red en el botón de guardar.
- Evaluar si el preview debe renderizar sincrónicamente justo antes de navegar, para evitar depender del debounce de 1 s.
