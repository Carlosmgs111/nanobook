---
title: "Plan de implementación — Fase 7: ISR con modo dinámico en Vercel"
description: "Plan de implementación — Fase 7: ISR con modo dinámico en Vercel"
date: 2026-08-23
author: "Nanobook Team"
tags:
  - arquitectura
  - build
  - incremental
  - refactoring
  - roadmap
  - decision
  - vercel
draft: false
index: false
---

# Plan de implementación — Fase 7: ISR con modo dinámico en Vercel

## Objetivo

Completar la integración del recompilado incremental en el flujo de ejecución real del proyecto, desplegando en Vercel con ISR nativo.

## Por qué Vercel

Vercel es la opción recomendada porque @astrojs/vercel soporta ISR nativo: revalidación automática por TTL, revalidación bajo demanda mediante revalidate(), despliegue serverless sin gestionar servidor Node, y CDN global integrada.

## Principios rectores

1. Server como modo canónico: output server con @astrojs/vercel.
2. Prerender selectivo: páginas que no cambian usan prerender true.
3. Storage-agnostic: las páginas no saben la fuente del contenido.
4. Cache en dos niveles: ISR de Vercel para HTML + cache propio para cuerpos.
5. Reutilizar PageRenderer, FileSystemRenderedPageCache, ContentChangeService y DocumentGraph.

## Sub-fases de implementación

### Fase 7.1 — Instalar y configurar @astrojs/vercel

Ejecutar pnpm add @astrojs/vercel y actualizar astro.config.mjs para usar output server, adapter vercel con isr expiration y bypassToken. OUTPUT_MODE deja de ser selector de modo; puede usarse como legacy para CONTENT_SOURCE.

### Fase 7.2 — Factory de ContentRepository

Crear src/document/adapters/repository/factory.ts que devuelva FileSystemRepository o GitHubRepository según CONTENT_SOURCE. Reemplazar instanciaciones directas de AstroCollectionRepository en páginas Astro.

### Fase 7.3 — GitHubRepository

Crear src/document/adapters/repository/github-repository.ts que implemente ContentRepository usando la API de GitHub. Reutilizar github-loader/api.ts y parser.ts. Implementar list, get y listChildren. Cachear lista de documentos en memoria con TTL.

### Fase 7.4 — Prerender condicional

Marcar prerender true en src/pages/index.astro y páginas legales. Marcar prerender false en src/pages/[...slug]/index.astro, edit.astro y preview.astro.

### Fase 7.5 — SSR de páginas de contenido

Refactorizar src/pages/[...slug]/index.astro para obtener slug de Astro.params, crear createContentRepository, obtener documento por ID, usar PageRenderer para cuerpo y navegación, y pasar todo a Layout y DocumentPage.

Consideraciones de Vercel: timeout de funciones serverless y cold start. El cache de cuerpos mitiga cold starts en requests subsiguientes.

### Fase 7.6 — Endpoint de invalidación on-demand

Crear src/pages/api/invalidate.ts que use revalidate de @vercel/functions. Recibir un ChangeSet, calcular invalidatedIds con ContentChangeService, revalidar cada ruta afectada y limpiar FileSystemRenderedPageCache. Requerir INVALIDATE_TOKEN en header Authorization.

### Fase 7.7 — Webhook de GitHub

Crear src/pages/api/webhook/github.ts que verifique firma con GITHUB_WEBHOOK_SECRET, parse el payload de push, mapee archivos a IDs y llame al endpoint de invalidación internamente.

### Fase 7.8 — Testing y documentación

Tests de GitHubRepository, factory, endpoint de invalidación e integración. Actualizar recompilado-incremental-estado-actual.md y crear documento de despliegue en Vercel.

## Variables de entorno

- CONTENT_SOURCE: local o github
- GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, GITHUB_TOKEN
- INVALIDATE_TOKEN
- GITHUB_WEBHOOK_SECRET
- VERCEL_ISR_BYPASS_TOKEN

## Criterios de éxito

- output server es el modo canónico.
- Las páginas de contenido se sirven bajo demanda con ISR.
- PageRenderer consulta y guarda cache de cuerpos.
- El endpoint /api/invalidate revalida correctamente en Vercel.
- pnpm test y pnpm build pasan.
