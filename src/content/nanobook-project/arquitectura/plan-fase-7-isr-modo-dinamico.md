---
title: "Plan de implementación — Fase 7: ISR con modo dinámico"
description: "Plan de implementación — Fase 7: ISR con modo dinámico"
date: 2026-08-23
author: "Nanobook Team"
tags:
  - arquitectura
  - build
  - incremental
  - refactoring
  - roadmap
  - decision
draft: false
index: false
---

# Plan de implementación — Fase 7: ISR con modo dinámico

## Objetivo

Completar la integración del recompilado incremental en el flujo de ejecución real del proyecto, permitiendo servir páginas de contenido bajo demanda y regenerar selectivamente solo lo que cambia, sin perder las ventajas de SEO y velocidad de las páginas pre-renderizadas.

## Estado al final de la Fase 6

El proyecto puede:

1. Modelar el árbol de documentos como un grafo explícito (`DocumentGraph`).
2. Detectar dependencias entre documentos (`parent-child`, `sibling-order`, `proxy-target`, `internal-link`).
3. Calcular el conjunto mínimo de documentos a regenerar ante un cambio (`computeInvalidatedIds`).
4. Renderizar y cachear cuerpos de documentos de forma selectiva (`PageRenderer`, `FileSystemRenderedPageCache`).
5. Detectar cambios mediante snapshot (`pnpm content:status`) y regenerar cuerpos (`pnpm content:render`).

**Lo que aún falta**:

- Las páginas Astro siguen generándose estáticamente en build time.
- `AstroCollectionRepository` depende de `getCollection("content")`, que solo funciona en build time.
- No hay un `ContentRepository` que funcione en runtime para modo dinámico.
- No hay integración con un mecanismo de ISR de Astro ni endpoint de invalidación.

## Principios rectores

1. **Server como modo canónico**: el proyecto se configura siempre como `output: "server"` (o `"hybrid"`), simplificando la mentalidad y la configuración.
2. **Prerender selectivo**: las páginas que no cambian (home, legales, etc.) pueden seguir siendo estáticas con `prerender = true`.
3. **Storage-agnostic**: las páginas y el servicio de navegación no saben si el contenido viene de filesystem, GitHub u otra fuente.
4. **Cache explícito**: el HTML servido debe poder invalidarse cuando cambia el contenido.
5. **Reutilizar lo construido**: `PageRenderer`, `FileSystemRenderedPageCache`, `ContentChangeService` y `DocumentGraph` son la base.

## Opciones de ISR en Astro

Astro no tiene ISR nativo propio; delega el comportamiento al adaptador de despliegue o a cabeceras HTTP. Las opciones disponibles son:

### Opción 1: Vercel con ISR nativo

Si el despliegue es en Vercel, `@astrojs/vercel` soporta ISR de forma nativa:

```typescript
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel({
    isr: {
      expiration: 3600, // segundos
    },
  }),
});
```

**Ventajas**: configuración mínima, revalidación automática, on-demand ISR disponible.  
**Desventajas**: vendor lock-in con Vercel.

### Opción 2: Cabeceras HTTP `stale-while-revalidate`

Para Netlify, Cloudflare, VPS propia o cualquier CDN que respete la cabecera:

```astro
---
export const prerender = false;

Astro.response.headers.set(
  'Cache-Control',
  'public, max-age=60, stale-while-revalidate=600'
);
---
```

**Ventajas**: portable entre plataformas.  
**Desventajas**: depende de que la CDN respete la cabecera; menos control que ISR nativo.

### Opción 3: Caché de rutas experimental de Astro

Astro 5.x incluye una API experimental de caché de rutas:

```typescript
// astro.config.mjs
export default defineConfig({
  output: 'server',
  experimental: {
    cache: true,
  },
});
```

```astro
---
Astro.cache({ ttl: 60 });
---
```

**Ventajas**: nativo de Astro, abstrae el almacén de caché.  
**Desventajas**: experimental, API sujeta a cambios; soporte de adaptadores limitado.

### Opción 4: ISR manual con servidor Node

Funciona en cualquier servidor Node/VPS:

1. `output: "server"` + `@astrojs/node`.
2. Páginas de contenido `prerender = false`.
3. `PageRenderer` consulta `FileSystemRenderedPageCache`.
4. Endpoint `/api/invalidate` recibe cambios y limpia cache.
5. Primera petición post-invalidación regenera el cuerpo y lo cachea.

**Ventajas**: máximo control, funciona en cualquier servidor.  
**Desventajas**: hay que implementar la invalidación y el cacheo a mano.

## Arquitectura objetivo

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Petición HTTP                                │
│              /nanobook-project/arquitectura/proxy-documents/        │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Página Astro SSR (prerender = false)                    │
│   - Recibe slug                                                      │
│   - Configura Cache-Control según estrategia                         │
│   - Obtiene Document[] desde ContentRepository                       │
│   - Renderiza cuerpo con PageRenderer (con cache)                    │
│   - Construye navegación con NavigationService                       │
│   - Devuelve HTML completo                                           │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
┌─────────────────────┐         ┌─────────────────────┐
│   PageRenderer      │         │  RenderedPageCache  │
│   (cuerpo + nav)    │         │  (cuerpo + hash)    │
└─────────────────────┘         └─────────────────────┘
           │                               │
           ▼                               ▼
┌─────────────────────┐         ┌─────────────────────┐
│  DocumentRenderer   │         │  .nanobook/cache/   │
│  (unified/markdown) │         │  pages/<hash>.json  │
└─────────────────────┘         └─────────────────────┘
```

## Sub-fases de implementación

### Fase 7.1 — Configurar modo server canónico

**Qué hacer**:

- Cambiar `astro.config.mjs` a `output: "server"` (o `"hybrid"`) con el adapter correspondiente.
- Decidir el adapter según plataforma de despliegue:
  - Vercel → `@astrojs/vercel`
  - Netlify → `@astrojs/netlify`
  - Cloudflare → `@astrojs/cloudflare`
  - VPS propia → `@astrojs/node`
- Eliminar `OUTPUT_MODE` como selector de modo. Puede mantenerse como legacy o usarse solo para seleccionar fuente de contenido (`local` vs `github`).
- Actualizar `content.config.ts` para que siempre use el loader adecuado en build time, pero las páginas no dependan de `getCollection` en runtime.

**Riesgos**:

- Cambiar a server requiere que todas las rutas API y dinámicas funcionen en runtime.
- Build inicial más lento por el adapter.

### Fase 7.2 — Factory de ContentRepository

**Qué hacer**:

- Crear `src/document/adapters/repository/factory.ts`:

```typescript
export function createContentRepository(): ContentRepository {
  const source = process.env.CONTENT_SOURCE ?? "local";

  if (source === "github") {
    return new GitHubRepository({
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
      branch: process.env.GITHUB_BRANCH ?? "main",
      token: process.env.GITHUB_TOKEN,
    });
  }

  return new FileSystemRepository();
}
```

- Reemplazar instanciaciones directas de `AstroCollectionRepository` en páginas Astro por `createContentRepository()`.
- En modo server, `AstroCollectionRepository` solo se usa en build time para páginas `prerender = true`.

### Fase 7.3 — GitHubRepository

**Qué hacer**:

- Crear `src/document/adapters/repository/github-repository.ts` que implemente `ContentRepository`.
- Reutilizar `src/document/adapters/github-loader/api.ts` para fetch de archivos.
- Reutilizar `parser.ts` para convertir paths a IDs y parsear frontmatter.
- Implementar `list()`, `get(id)` y `listChildren(parentId)`.
- Resolver proxies mediante `CompositeReferenceResolver` con `GitHubReferenceResolver`.

**Decisiones**:

- Cachear la lista de documentos de GitHub en memoria por un TTL configurable.
- Manejar rate limits con `GITHUB_TOKEN` y retry básico.

### Fase 7.4 — Prerender condicional

**Qué hacer**:

- Crear helper `getPrerenderMode()` que devuelva `true` para páginas que no cambian.
- Marcar `prerender = true` en:
  - Home principal (`src/pages/index.astro`)
  - Páginas legales/sistema si las hay
- Marcar `prerender = false` en:
  - `src/pages/[...slug]/index.astro`
  - `src/pages/[...slug]/edit.astro`
  - `src/pages/[...slug]/preview.astro`
- Las API routes son siempre dinámicas en modo server.

### Fase 7.5 — SSR de páginas de contenido

**Qué hacer**:

- Refactorizar `src/pages/[...slug]/index.astro` para que en runtime:
  1. Obtenga el `slug` de `Astro.params`.
  2. Cree `createContentRepository()`.
  3. Obtenga el documento por ID.
  4. Use `PageRenderer` para cuerpo y metadatos de navegación.
  5. Pase todo a `Layout` y `DocumentPage`.
- Extraer lógica común a `renderDocumentPage(documentId, repository)`.
- Manejar 404 cuando el documento no existe.

### Fase 7.6 — Estrategia de cache según plataforma

**Vercel**:

- Configurar `@astrojs/vercel` con `isr: { expiration: ... }`.
- Opcionalmente exponer endpoint `/api/invalidate` usando `revalidate()` de Vercel para on-demand ISR.

**Netlify / Cloudflare / VPS / CDN genérico**:

- Inyectar cabecera `Cache-Control: public, max-age=60, stale-while-revalidate=600` en las páginas de contenido.
- Mantener `FileSystemRenderedPageCache` como cache de cuerpos para evitar re-renderizar Markdown.
- Endpoint `/api/invalidate` limpia cache de cuerpos y fuerza revalidación de CDN si es posible.

**Astro experimental cache**:

- Evaluar `experimental.cache` como alternativa futura.
- No implementar como primera opción por ser experimental.

### Fase 7.7 — Endpoint de invalidación

**Qué hacer**:

- Crear `src/pages/api/invalidate.ts`.
- Aceptar POST con `ChangeSet`:

```json
{
  "changes": [
    { "id": "blog/overthinking", "kind": "modified", "scope": "content" }
  ]
}
```

- Reutilizar `ContentChangeService` para calcular documentos invalidados.
- Llamar a `FileSystemRenderedPageCache.invalidate(invalidatedIds)`.
- En Vercel, llamar también a revalidación on-demand.
- Devolver `{ invalidatedIds: [...] }`.

**Seguridad**:

- Requerir `INVALIDATE_TOKEN` en header `Authorization: Bearer <token>`.

### Fase 7.8 — Webhook de GitHub (opcional)

**Qué hacer**:

- Crear `src/pages/api/webhook/github.ts`.
- Verificar firma con `GITHUB_WEBHOOK_SECRET`.
- Parsear payload de `push` para obtener archivos modificados/agregados/eliminados.
- Mapear archivos a IDs de documentos.
- Construir `DocumentChange[]` y llamar al endpoint de invalidación internamente.

### Fase 7.9 — Testing y documentación

**Tests**:

- `GitHubRepository` con mock de fetch.
- `createContentRepository()` según `CONTENT_SOURCE`.
- Endpoint `/api/invalidate` con token válido/inválido.
- Integración: cambio de contenido → invalidación → renderizado selectivo.

**Documentación**:

- Actualizar `recompilado-incremental-estado-actual.md` marcando Fase 7 como completada.
- Crear documento de despliegue según plataforma (Vercel, Netlify, VPS, etc.).

## Variables de entorno

| Variable | Valor ejemplo | Descripción |
|----------|---------------|-------------|
| `OUTPUT_MODE` | `server` | Modo de salida (legacy, puede eliminarse). |
| `CONTENT_SOURCE` | `local` / `github` | Fuente de contenido en runtime. |
| `GITHUB_OWNER` | `usuario` | Owner del repo de contenido. |
| `GITHUB_REPO` | `nanobook-content` | Repo de contenido. |
| `GITHUB_BRANCH` | `main` | Rama del contenido. |
| `GITHUB_TOKEN` | `ghp_...` | Token para GitHub API. |
| `INVALIDATE_TOKEN` | `secreto` | Token para endpoint `/api/invalidate`. |
| `GITHUB_WEBHOOK_SECRET` | `secreto` | Secreto para validar webhooks. |

## Flujo completo en producción

```text
1. Autor edita un Markdown en src/content/ o en el repo remoto.
        │
        ▼
2. CI / webhook notifica el cambio al servidor.
        │
        ▼
3. Servidor recibe ChangeSet y ejecuta invalidación.
        │
        ▼
4. Se limpian del cache los cuerpos invalidados.
   En Vercel: se llama a revalidate() on-demand.
   En CDN: stale-while-revalidate regenera en background.
        │
        ▼
5. Primera petición a una página invalidada:
   - ContentRepository carga documentos.
   - PageRenderer consulta cache → miss.
   - Renderiza cuerpo, guarda en cache.
   - Astro SSR ensambla layout completo.
   - Se aplican cabeceras Cache-Control.
        │
        ▼
6. Siguientes peticiones sirven desde cache de CDN/servidor.
```

## Criterios de éxito

- `output: "server"` es el modo canónico del proyecto.
- Las páginas de contenido se sirven bajo demanda usando el `ContentRepository` adecuado.
- `PageRenderer` consulta y guarda cache de cuerpos.
- El endpoint `/api/invalidate` invalida correctamente el cache.
- Las cabeceras de cache o el ISR nativo permiten servir contenido rápido y con buen SEO.
- `pnpm test` y `pnpm build` pasan.

## Decisión pendiente

La implementación concreta de la estrategia de cache depende de la plataforma de despliegue:

- **Vercel**: usar ISR nativo de `@astrojs/vercel`.
- **Netlify / Cloudflare / VPS**: usar `stale-while-revalidate` + cache de cuerpos propio.
- **Otra**: evaluar adapter disponible.

¿En qué plataforma planeas desplegar Nanobook?
