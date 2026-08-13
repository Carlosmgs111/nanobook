---
title: "Propuestas de arquitectura de contenido"
description: "Opciones evaluadas para soportar contenido estático y actualizaciones dinámicas en nanobook."
date: 2026-08-12
author: "Astro"
tags: ["arquitectura", "contenido", "github", "ssr", "decision"]
draft: false
index: false
---

## Contexto

nanobook nació como un generador de sitios estáticos que carga Markdown en tiempo de build. Con el tiempo surgió la necesidad de poder actualizar contenido en producción sin generar un nuevo build, pero sin perder la capacidad de que cualquiera clone el repo, guarde contenido local y genere un sitio estático.

Este documento plasma las dos propuestas arquitectónicas evaluadas para resolver ese conflicto.

---

## Propuesta A: modos excluyentes (estático vs. SSR dinámico)

### Descripción

El proyecto se configura en uno de dos modos mediante la variable de entorno `CONTENT_SOURCE`:

- **`local`** (default): generación estática pura desde `src/content/`.
- **`github`**: SSR con adaptador Node.js. El contenido se carga bajo demanda desde la API de GitHub en cada request.

### Implementación resumida

- `astro.config.mjs` cambia entre `output: "static"` y `output: "server"` + `@astrojs/node` según `CONTENT_SOURCE`.
- `src/content.config.ts` usa `glob` en modo local y un loader `noop` en modo GitHub.
- `src/lib/content-service/` abstrae `LocalContentService` y `GitHubContentService`.
- `src/pages/[...slug].astro` consulta el servicio correspondiente y renderiza HTML unificado.

### Pros

- Conceptualmente simple: un switch decide todo el comportamiento.
- En modo GitHub el contenido siempre está fresco (sin cache más allá de la petición).
- No requiere almacenamiento persistente en el servidor.

### Contras

- Los modos son mutuamente excluyentes: no se puede mezclar contenido estático con actualizaciones dinámicas.
- En modo GitHub cada request descarga el árbol completo del repo (a menos que se añada cache), lo que es lento y golpea la API de GitHub.
- Pierde las ventajas del estático (CDN, velocidad, SEO trivial) en el modo dinámico.
- Mayor acoplamiento: la página principal debe saber si está en SSR o en estático.

### Estado

Implementada parcialmente y luego puesta en pausa a la espera de una decisión final.

---

## Propuesta B: estático inclusivo + parches dinámicos

### Descripción

El sitio siempre se genera de forma estática en build time, combinando contenido local y contenido de GitHub (como funcionaba originalmente con el loader `mixed`). Sobre esa base estática se monta un backend ligero que permite modificar documentos en runtime. Un manifiesto rastrea qué documentos han sido parcheados dinámicamente, y el servidor decide en cada request si sirve la versión estática o la versión dinámica.

### Flujo

1. **Build time:**
   - Se carga todo el contenido (local + GitHub) mediante el loader `mixed`.
   - Se genera un manifiesto con `id`, `digest`/`version`, `source` y `updatedAt` de cada documento.
   - Se generan todas las páginas HTML estáticas.

2. **Backend/API dinámica:**
   - Endpoints REST para crear, editar o eliminar documentos.
   - Los cambios se persisten en almacenamiento (filesystem, base de datos o GitHub).
   - El manifiesto se actualiza marcando los documentos afectados como `dynamic: true`.

3. **Runtime:**
   - Al recibir una request, el servidor consulta el manifiesto.
   - Si el documento no está parcheado: sirve el HTML estático del build.
   - Si el documento está parcheado: renderiza y sirve la versión dinámica desde el backend.

4. **Próximo build:**
   - El contenido parcheado se vuelve a cargar desde el backend y se "congela" de nuevo en estático.
   - El manifiesto se regenera sin marcas dinámicas.

### Implementación resumida

- Restaurar `src/content.config.ts` con `mixed([glob(...), github(...)])`.
- Añadir `src/lib/manifest.ts` para leer/escribir el manifiesto.
- Añadir `src/lib/content-service/dynamic.ts` para leer parches dinámicos.
- Añadir endpoints en `src/pages/api/content/[...slug].ts` y `src/pages/api/manifest.ts`.
- Modificar `src/pages/[...slug].astro` para decidir entre versión estática y dinámica según el manifiesto.

### Pros

- Mantiene la velocidad y simplicidad del estático para el 99% del contenido.
- Permite actualizaciones puntuales sin rebuild completo.
- Los modos no son excluyentes: el mismo despliegue sirve contenido estático y dinámico.
- Aprovecha CDN para contenido no modificado.
- El manifiesto da trazabilidad de qué contenido desvía del build.

### Contras

- Mayor complejidad general.
- Requiere un servidor Node.js persistente para el backend y la lógica de overrides.
- Necesita almacenamiento persistente en runtime para parches y manifiesto.
- Posibles inconsistencias si el manifiesto no está sincronizado con el build.

### Preguntas pendientes

1. ¿Dónde se guardan los parches dinámicos? ¿Filesystem local, base de datos o commits de vuelta a GitHub?
2. ¿Dónde vive el manifiesto? ¿Solo en `dist/`, o actualizable en runtime?
3. ¿La versión estática pura sin servidor sigue funcionando "out of the box"?
4. ¿El backend expone una UI de administración o solo API REST?
5. ¿Los parches dinámicos deben sobrevivir a reinicios del servidor?

---

## Comparativa rápida

| Criterio | Propuesta A | Propuesta B |
|---|---|---|
| Velocidad de carga | Media/lenta (fetch a GitHub) | Rápida (estático) + parches |
| Frescura del contenido | Siempre fresca | Fresca solo si se parchea |
| Complejidad | Media | Alta |
| Requiere servidor | Solo en modo `github` | Sí, para backend y overrides |
| Almacenamiento persistente | No | Sí |
| CDN/cacheable | En modo local | Sí, contenido base |
| Modos excluyentes | Sí | No |

---

## Decisión pendiente

A la fecha de este documento no se ha decidido cuál propuesta adoptar. La Propuesta A fue implementada parcialmente y se considera revertir en favor de la Propuesta B si se confirma que esta última se ajusta mejor a los objetivos del proyecto.
