---
title: "Publisher y manifest"
description: "Abstracción del publisher y el manifiesto del sitio para soportar static, SSR y parches dinámicos en el futuro."
date: 2026-08-13
author: "Nanobook Team"
tags: ["arquitectura", "publishing", "manifest", "ssr"]
draft: false
index: false
---

## Propósito

Astro es hoy el publisher de Nanobook: genera HTML estático en build time. Pero la arquitectura debe permitir otros modos de publicación en el futuro:

- **Static**: Astro SSG, el modo actual.
- **SSR**: renderizado bajo demanda en runtime.
- **Hybrid**: contenido estático base + parches dinámicos sin rebuild completo.

El `Publisher` y el `SiteManifest` son las abstracciones que habilitan esa evolución.

## Conceptos

### Publisher

Contrato para materializar el sitio público:

```typescript
interface Publisher {
  publish(document: Document, rendered: { html: string }): Promise<void>;
  generateManifest(documents: Document[]): Promise<SiteManifest>;
}
```

Hoy Astro cumple este rol. En el futuro, un `HybridPublisher` podría:

1. Generar HTML estático para todo el contenido en build.
2. Generar un `SiteManifest`.
3. En runtime, consultar el manifiesto y servir HTML estático o renderizar dinámico según corresponda.

### SiteManifest

Registro de todos los documentos publicados:

```typescript
interface SiteManifest {
  generatedAt: string;
  documents: ManifestEntry[];
}

interface ManifestEntry {
  id: string;
  slug: string;
  title: string;
  updatedAt: string;
  source: "filesystem" | "github" | "database";
  dynamic: boolean;
}
```

El campo `dynamic: boolean` indica si un documento ha sido modificado en runtime y debe renderizarse dinámicamente en lugar de servirse desde el build estático.

## Módulos

- `src/core/publishing/types.ts` — tipos `Publisher`, `SiteManifest`, `ManifestEntry`.
- `src/core/publishing/manifest.ts` — `generateManifest`, `serializeManifest`, `parseManifest`.

## Flujo híbrido futuro

```text
Build time:
  ContentRepository → Document[]
                           ↓
                    Publisher.generateManifest()
                           ↓
                    SiteManifest (dist/manifest.json)
                           ↓
                    Astro SSG → HTML estático

Runtime:
  Request /doc
       ↓
  Leer manifest.json
       ↓
  dynamic === false ?
       → servir HTML estático
       → renderizar versión dinámica desde DatabaseRepository
```

## Persistencia del manifest

Dónde vive el manifest depende del modo de publicación:

### SSG puro (modo actual)

En build time se generaría como artefacto en `dist/manifest.json`, pero no tendría utilidad real porque no hay servidor que lo consulte.

### SSR / Híbrido (Propuesta B)

| Opción | Ubicación | Pros | Contras |
|---|---|---|---|
| **Filesystem** | `dist/manifest.json` (build) + `data/manifest.json` (runtime) | Simple, sin DB | No funciona en serverless; requiere volumen persistente |
| **Base de datos** | Tabla `manifests` | Correcto para SaaS y multi-instancia | Requiere DB desde el inicio |
| **Storage externo** | S3, Redis, etc. | Escala bien | Añade infraestructura |

### Decisión recomendada

1. **Build time**: generar `dist/manifest.json` como parte del build estático.
2. **Runtime híbrido**: el servidor lee `dist/manifest.json` al arrancar y mantiene una copia en memoria.
3. **Al parchear un documento**: actualizar la copia en memoria y persistir en `data/manifest.json`.
4. **Cuando llegue el SaaS**: migrar el manifest a PostgreSQL junto con los documentos.

Esta transición permite probar el modo híbrido sin base de datos, pero deja claro que el destino final es la DB.

## Estado

- ✅ Tipos y utilidades de manifest creados.
- ✅ Decisión de persistencia documentada.
- ⏳ Publisher real y conexión con Astro/SSR se implementarán cuando se retome la Propuesta B de parches dinámicos.
