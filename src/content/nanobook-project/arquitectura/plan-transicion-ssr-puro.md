---
title: "Plan de transición a SSR puro"
description: "Plan por fases para eliminar el modo híbrido estático/dinámico y consolidar Nanobook como aplicación server-first"
date: 2026-08-25
author: "Nanobook Team"
tags:
  - arquitectura
  - ssr
  - roadmap
  - refactor
draft: false
index: false
---

# Plan de transición a SSR puro

## Estado de ánimo

El proyecto comenzó como un sitio estático con Astro Content Collections y luego creció hacia un modelo dinámico con `ContentRepository`, SSR, cache isomórfico y webhooks. Hoy tenemos dos sistemas de carga de contenido conviviendo:

1. **Astro Content Loader** (`github-loader` en `content.config.ts`) — usado en build/dev.
2. **`ContentRepository`** (`GitHubRepository`, `FileSystemRepository`) — usado en runtime.

Esta duplicación genera:
- Doble fetch de GitHub (loader + repository).
- Bifurcaciones `OUTPUT_MODE` / `CONTENT_SOURCE` difíciles de razonar.
- Dependencias de `astro:content` en el dominio puro del documento.
- Build local de Vercel que falla por symlinks y `vercel dev` que carga el loader innecesariamente.

La transición a **SSR puro** consolida el proyecto como aplicación server-first: una sola fuente de verdad (`ContentRepository`), sin loaders de Astro en runtime, y despliegue en Vercel/Node/serverless.

## Principios rectores

1. **No código nuevo innecesario**: solo mover, eliminar o simplificar.
2. **Una sola fuente de verdad**: `ContentRepository` es el único punto de lectura/escritura de documentos.
3. **Astro Content Collections como detalle interno**: `content.config.ts` seguirá existiendo para los archivos locales de `src/content/`, pero no cargará contenido de GitHub.
4. **Mínima ruptura**: cada fase debe dejar tests y build verdes.
5. **Documentación actualizada**: cada decisión se refleja en los documentos del proyecto.

## Fases

### Fase 1 — Preparación y auditoría

**Objetivo**: tener una foto clara de todo lo que depende del modo híbrido.

**Tareas**:
- Listar todos los archivos que importan `astro:content`.
- Listar todos los usos de `OUTPUT_MODE`, `outputMode`, `isDynamicMode`, `isStaticMode`.
- Identificar páginas Astro que usen `getCollection`, `AstroCollectionRepository`, `astro-cache`.
- Revisar documentación obsoleta que mencione `OUTPUT_MODE` o modos estático/dinámico.
- Ejecutar tests y build como línea base.

**Archivos a revisar**:
- `src/content.config.ts`
- `src/document/api/document.ts`
- `src/document/adapters/repository/astro-collection-repository.ts`
- `src/document/adapters/cache/astro-cache.ts`
- `src/document/parse/document.ts`
- `src/document/parse/proxy.ts`
- `src/document/reference/types.ts`
- `src/document/reference/resolver.ts`
- `src/document/adapters/reference/internal-resolver.ts`
- `src/document/adapters/repository/factory.ts`
- `src/pages/**/*.astro`
- Documentación en `src/content/nanobook-project/`

**Criterios de éxito**:
- Inventario completo de dependencias.
- Tests y build pasan antes de tocar código.

**Inventario confirmado (línea base)**:

Dependencias de `astro:content`:
- `src/content.config.ts` — define colección usando `defineCollection` y `z`.
- `src/document/adapters/repository/astro-collection-repository.ts` — `AstroCollectionRepository`, usa `getAstroEntries()` y `CollectionEntry`.
- `src/document/adapters/cache/astro-cache.ts` — envuelve `getCollection("content")`.
- `src/document/parse/document.ts` — `toDocument` recibe `CollectionEntry`.
- `src/document/parse/proxy.ts` — `resolveProxy` recibe `CollectionEntry`.
- `src/document/reference/types.ts` — `ReferenceResolver.resolve` recibe `CollectionEntry`.
- `src/document/reference/resolver.ts` — `CompositeReferenceResolver.resolve` recibe `CollectionEntry`.
- `src/document/adapters/reference/internal-resolver.ts` — usa `Map<string, CollectionEntry>`.

Usos de `OUTPUT_MODE`:
- `src/content.config.ts` — selecciona loader `github` vs `glob`.
- `src/document/api/document.ts` — `prerender` condicional.
- Documentación en `src/content/nanobook-project/`.

Páginas Astro que usan `createContentRepository()` (no requieren cambio):
- `src/pages/[...slug]/index.astro`
- `src/pages/[...slug]/edit.astro`
- `src/pages/[...slug]/preview.astro`

### Fase 2 — Eliminar `OUTPUT_MODE`

**Objetivo**: quitar la variable `OUTPUT_MODE` y asumir `output: "server"` siempre.

**Tareas**:
- En `astro.config.mjs`: eliminar cualquier lógica condicional basada en `OUTPUT_MODE`.
- En `content.config.ts`: eliminar `outputMode`, `isDynamicMode`, `dynamicLoader`.
- En `src/document/api/document.ts`: cambiar `prerender` a `false` directamente.
- Revisar scripts (`package.json`) y variables de entorno para eliminar `OUTPUT_MODE`.
- Actualizar `.env` y `.env.local` de ejemplo.

**Criterios de éxito**:
- No quedan referencias a `OUTPUT_MODE` en código fuente.
- `pnpm build` y `pnpm test` pasan.

### Fase 3 — Simplificar `content.config.ts`

**Objetivo**: que `content.config.ts` solo gestione la colección local de `src/content/` (documentación del proyecto), sin fetch de GitHub.

**Tareas**:
- Dejar `content.config.ts` con un solo loader `glob` sobre `./src/content/`.
- Eliminar el loader `github` de Astro (o dejarlo como adapter interno si se quiere reusar, pero no en `content.config.ts`).
- Actualizar el schema si es necesario.
- Asegurar que `astro dev` y `astro build` no intenten cargar contenido de GitHub.

**Criterios de éxito**:
- `astro dev` arranca sin hacer fetch a GitHub por el loader.
- `astro build` completa.
- `src/content/` sigue siendo una colección válida de Astro.

### Fase 4 — Migrar dependencias de `astro:content`

**Objetivo**: eliminar imports de `astro:content` del dominio del documento.

**Tareas**:
- `src/document/adapters/repository/astro-collection-repository.ts`: eliminar.
- `src/document/adapters/cache/astro-cache.ts`: eliminar.
- `src/document/parse/document.ts`: eliminar `toDocument` basado en `CollectionEntry`; si es necesario, mover a un adapter o eliminar si no se usa.
- `src/document/parse/proxy.ts`: reemplazar `CollectionEntry` por `Document`.
- `src/document/reference/types.ts` y `src/document/reference/resolver.ts`: reemplazar `CollectionEntry` por `Document`.
- `src/document/adapters/reference/internal-resolver.ts`: reemplazar `CollectionEntry` por `Document`.
- Actualizar `createContentRepository` en `factory.ts` para quitar la opción `astro`.

**Criterios de éxito**:
- No quedan imports de `astro:content` en `src/document/` ni `src/navigation/` ni `src/rendering/`.
- Tests pasan.

### Fase 5 — Limpiar páginas Astro

**Objetivo**: asegurar que todas las páginas usan `createContentRepository()` y no `getCollection` ni `AstroCollectionRepository`.

**Tareas**:
- Revisar `src/pages/**/*.astro` y `src/pages/**/*.ts`.
- Reemplazar cualquier uso residual de `getCollection` o `CollectionEntry`.
- Asegurar que `prerender` sea `false` donde corresponda.
- Eliminar `src/document/api/document.ts` si ya no aporta valor (o simplificarlo).

**Criterios de éxito**:
- No quedan imports de `astro:content` en `src/pages/`.
- `vercel dev` funciona con `CONTENT_SOURCE=github` o `local`.

### Fase 6 — Actualizar documentación

**Objetivo**: que la documentación refleje el modelo SSR puro.

**Tareas**:
- Actualizar `content-model-architecture.md`.
- Actualizar `informe-factibilidad-recompilado-incremental.md`.
- Actualizar `recompilado-incremental-estado-actual.md`.
- Actualizar `plan-fase-7-isr-modo-dinamico.md` si es necesario.
- Actualizar `despliegue-vercel.md`.
- Actualizar `AGENTS.md` si menciona modos estáticos.
- Actualizar `CHANGELOG.md`.

**Criterios de éxito**:
- Ningún documento menciona `OUTPUT_MODE` o modo estático como opción vigente.
- El modelo server-first está explicado claramente.

### Fase 7 — Verificación final

**Objetivo**: consolidar y asegurar que todo funciona.

**Tareas**:
- Ejecutar `pnpm test`.
- Ejecutar `pnpm build`.
- Probar `vercel dev` con `CONTENT_SOURCE=local`.
- Probar `vercel dev` con `CONTENT_SOURCE=github` (si no hay rate limit).
- Probar invalidación manual y webhook.
- Revisar que no queden imports muertos ni archivos huérfanos.
- Actualizar versión en `package.json` y `CHANGELOG.md` si corresponde.

**Criterios de éxito**:
- 0 imports de `astro:content` fuera de `content.config.ts`.
- 0 referencias a `OUTPUT_MODE`.
- Tests y build verdes.
- `vercel dev` funciona en ambos modos de contenido.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Se rompe resolución de proxies | Migrar `parse/proxy.ts` y `reference/resolver.ts` con cuidado, manteniendo tests. |
| Se pierde funcionalidad de edición | `FileSystemRepository` sigue disponible para `CONTENT_SOURCE=local`. |
| Build de Vercel sigue fallando | El build de Vercel requiere symlinks en Windows; esto no cambia. Usar `vercel dev` o CI/Linux. |
| `src/content/` deja de funcionar | `content.config.ts` sigue cargando archivos locales. |

## Próximos pasos

1. Revisar y aprobar este plan.
2. Ejecutar Fase 1 para confirmar el inventario.
3. Avanzar fase por fase, commit por fase.
