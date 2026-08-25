---
title: "Despliegue en Vercel"
description: "Guía de despliegue de Nanobook en Vercel con ISR isomórfico"
date: 2026-08-25
author: "Nanobook Team"
tags:
  - arquitectura
  - deploy
  - vercel
  - isr
draft: false
index: false
---

# Despliegue en Vercel

## Requisitos

- Cuenta en Vercel.
- Repo de Nanobook conectado a Vercel.
- Si el contenido vive en un repo separado, un token de GitHub con acceso de lectura.

## Configuración del adapter

El proyecto usa `@astrojs/vercel` cuando la variable `VERCEL_DEPLOY` es `true`. Vercel la puede configurar en el dashboard:

```text
VERCEL_DEPLOY=true
```

Localmente el build usa `@astrojs/node` para evitar problemas de symlinks en Windows.

## Variables de entorno en Vercel

| Variable | Valor ejemplo | Descripción |
|----------|---------------|-------------|
| `VERCEL_DEPLOY` | `true` | Activa el adapter de Vercel. |
| `CONTENT_SOURCE` | `local` / `github` | Fuente de contenido. |
| `GITHUB_OWNER` | `usuario` | Owner del repo de contenido (solo si CONTENT_SOURCE=github). |
| `GITHUB_REPO` | `nanobook-content` | Repo de contenido. |
| `GITHUB_BRANCH` | `main` | Rama del contenido. |
| `GITHUB_TOKEN` | `ghp_...` | Token de GitHub. |
| `GITHUB_PATH` | `src/content` | Ruta base del contenido en el repo. |
| `INVALIDATE_TOKEN` | `secreto` | Token para /api/invalidate. |
| `GITHUB_WEBHOOK_SECRET` | `secreto` | Secreto del webhook de GitHub. |
| `CACHE_BACKEND` | `memory` | Cache de cuerpos en serverless. |

## Webhook de GitHub

En el repo de contenido, configurar un webhook:

- **Payload URL**: `https://tu-dominio.com/api/webhook/github`
- **Content type**: `application/json`
- **Secret**: el mismo valor de `GITHUB_WEBHOOK_SECRET`
- **Eventos**: **Just the push event.**

Cuando se hace push, el webhook invalida automáticamente el cache de cuerpos de los documentos afectados.

## Invalidación manual

Si no se usa webhook, se puede llamar al endpoint manualmente:

```bash
curl -X POST https://tu-dominio.com/api/invalidate \
  -H "Authorization: Bearer $INVALIDATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"changes": [{"id": "blog/post", "kind": "modified", "scope": "content"}]}'
```

## Comportamiento de cache

Las páginas de contenido responden con:

```http
Cache-Control: public, max-age=60, stale-while-revalidate=600
```

Esto significa:

- La CDN de Vercel cachea la página durante 60 segundos.
- Después de esos 60 segundos, sigue sirviendo la versión cacheada mientras regenera en background durante 600 segundos.
- El cache de cuerpos (RenderedPageCache) acelera la regeneración.

## Limitaciones conocidas

- El build local con `@astrojs/vercel` puede fallar en Windows sin permisos de desarrollador por symlinks. Por eso el adapter de Vercel solo se activa con `VERCEL_DEPLOY=true`.
- `GitHubRepository` no soporta guardar documentos; es de solo lectura.
