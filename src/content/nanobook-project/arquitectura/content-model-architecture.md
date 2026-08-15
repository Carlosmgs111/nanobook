---
title: "Arquitectura del modelo de contenido"
description: "Decisión de mantener filesystem-first pero storage-agnostic, separando Content Model de Storage y Astro como capa de publicación."
date: 2026-08-13
author: "Nanobook Team"
tags: ["arquitectura", "contenido", "storage", "decision"]
draft: false
index: false
---

## Contexto

Nanobook nació como un generador estático que carga Markdown desde `src/content/` mediante el loader `glob` de Astro. Con el tiempo surgió la necesidad de poder actualizar contenido en producción sin generar un nuevo build, pero sin perder la capacidad de que cualquiera clone el repo, guarde contenido local y genere un sitio estático.

Este documento define la arquitectura actual: dos modos de despliegue excluyentes, cada uno con una sola fuente de verdad y edición directa de archivos.

## Decisión

**No migrar a base de datos en esta etapa.**

Seguimos con:

```text
Markdown + Astro
```

Pero la fuente de los Markdown depende del modo de despliegue:

- **Modo estático**: archivos locales en `src/content/`.
- **Modo dinámico**: archivos remotos en GitHub (por defecto), renderizados bajo demanda.

En ambos casos la edición se hace directamente sobre la fuente de verdad; no hay overrides ni manifest.

## Modos de despliegue

Los modos son **mutuamente excluyentes**. Se eligen mediante la variable de entorno `OUTPUT_MODE`:

```text
OUTPUT_MODE=static   # default
OUTPUT_MODE=dynamic
```

### Modo estático

- `output: "static"` en Astro.
- Fuente de verdad: archivos Markdown en `src/content/`.
- El build genera HTML estático en `dist/`.
- La edición solo puede ocurrir en modo desarrollo, antes del build de producción.
- En desarrollo se desplegará un editor integrado para modificar los archivos Markdown sin salir del navegador.

### Modo dinámico

- `output: "server"` en Astro + adapter `@astrojs/node`.
- Fuente de verdad: repositorio de GitHub (configurable en el futuro).
- El servidor renderiza las páginas bajo demanda.
- Permite edición en vivo sobre la fuente remota.
- Todos los archivos viven fuera del build.

## Principio rector

> El dominio de Nanobook nunca debe saber si un documento proviene del filesystem local, GitHub, PostgreSQL o una API.

## Arquitectura objetivo

```text
              Nanobook Core
                   │
        ┌──────────┴──────────┐
        │                     │
   Content Model        Navigation Model
        │                     │
        └──────────┬──────────┘
                   │
            Rendering Layer
                   │
        ┌──────────┴──────────┐
        │                     │
   Static Build            Runtime
        │                     │
     Astro SSG            Astro SSR
        │                     │
     HTML/CDN              Server
        │                     │
   src/content/           GitHub (default)
```

Por debajo:

```text
           Storage Adapter
                  │
        ┌─────────┴─────────┐
        │                   │
    Filesystem           GitHub
        │                   │
      Markdown          Markdown
        │                   │
        └──────────┬──────────┘
                   │
             Content Tree
```

## Conceptos del dominio

- **Document**: unidad mínima de contenido. Tiene `id`, `slug`, `parentId`, `position`, `title`, `description`, `content` y `metadata`.
- **ContentRepository**: interfaz para listar, obtener y buscar hijos de documentos. Responsabilidad única: persistencia/lectura.
- **NavigationBuilder**: construye árboles de navegación a partir de una lista de documentos.
- **DocumentRenderer**: interfaz para convertir el contenido crudo en HTML. Tiene su propio adapter (ej. `AstroMarkdownRenderer`).

## Estado actual

### Fase 0 completada

- Se creó `src/core/content/types.ts` con los tipos base del dominio.
- Se consolidó `DocumentEntry` en el mismo módulo.
- Se tipó `src/lib/content.ts` para dejar de usar `any[]`.
- El build sigue funcionando igual.

### Fase 1 completada

- Se creó `src/core/content/repository.ts` con la interfaz `ContentRepository` y el adapter `AstroCollectionRepository`, cacheando la colección a nivel de módulo.
- Se creó `src/core/navigation/builder.ts` con `NavigationNode`, `NavigationTree`, `buildNavigationTree`, `getBreadcrumbs`, `getImmediateChildren`, `getSidebarEntries` y `getParentEntry`, cacheando el árbol por el array de documentos.
- Se actualizó `src/pages/[...slug].astro` para construir el árbol de navegación y derivar breadcrumb, sidebar e índices del `nodeMap`.
- Se eliminó `src/lib/content.ts` porque toda su lógica ahora vive en `src/core/`.
- Los componentes `Layout.astro`, `SidebarNav/index.astro` y `SidebarList.astro` ahora usan `NavigationNode`.

### Fase 2 completada

- Se añadió `position` al schema de Astro (`src/content.config.ts`) y a `DocumentMetadata`.
- `NavigationBuilder` ordena por `position` con fallback por título.
- Se creó `src/core/rendering/types.ts` con la interfaz `DocumentRenderer`.
- Se creó `src/core/rendering/adapters/astro-markdown.ts` con `AstroMarkdownRenderer`, el encargado exclusivo de renderizar Markdown mediante Astro.
- `AstroCollectionRepository` ya no se encarga del renderizado; su responsabilidad es solo la lectura de documentos.
- Se creó `src/core/content/astro-cache.ts` para compartir las entradas crudas de Astro entre repository y renderer sin acoplarlos.
- `src/pages/[...slug].astro` crea `repository` y `renderer` como objetos separados.
- El build genera 37 páginas en modo estático (solo contenido local).

### Fase 3 completada

- Se creó `src/core/content/adapters/memory-repository.ts` para tests y desarrollo.
- Se creó `src/core/content/adapters/database-repository.ts` como stub del adapter de base de datos.
- Se documentó la arquitectura de storage adapters en `src/content/nanobook-project/arquitectura/storage-adapters.md`.
- El build sigue usando `AstroCollectionRepository`; los nuevos adapters demuestran que el dominio es storage-agnostic.

### Configuración de modos completada

- `astro.config.mjs` ahora usa `OUTPUT_MODE` para elegir entre `output: "static"` y `output: "server"` + `@astrojs/node`.
- `src/content.config.ts` ahora carga solo archivos locales en modo estático y solo archivos de GitHub en modo dinámico.
- El build pasa en ambos modos.

### Editor integrado por documento

- Cada documento tiene una vista alterna de edición en `/{slug}/edit` (por ejemplo `/markdown/edit`).
- Se añade un botón "Editar" en el header de las páginas de documento; en la vista de edición se muestra un botón "Ver" para volver.
- La vista de edición reutiliza el layout principal pero oculta el TOC (`hideToc`).
- El editor usa CodeMirror 6 (`codemirror`, `@codemirror/lang-markdown`) encapsulado en `src/components/DocumentEditor/` para permitir cambiar de editor más adelante.
- Lectura y escritura de archivos se hace mediante un plugin de Vite (`src/lib/editor/vite-plugin.ts`) que expone endpoints solo en desarrollo.

## Escalabilidad y SSR

### Árbol completo vs. rama parcial

En el modo SSG actual, `NavigationBuilder` construye el árbol de navegación completo a partir de todos los documentos. Esto es correcto porque:

- Astro genera cada página de forma independiente en build time.
- El contenido ya está en memoria.
- Un árbol de cientos o miles de nodos es trivial de construir y cachear.

### Cuándo cambiar el enfoque

Si Nanobook escala a **decenas o cientos de miles de documentos** con SSR, construir el árbol completo por request se vuelve costoso en CPU y memoria. En ese escenario, el `DatabaseRepository` debería cargar solo la rama necesaria:

```text
/nanobook-project/arquitectura/content-model-architecture/
    ↓
cargar: ancestros + padre + hermanos + hijos directos
```

### Cómo la arquitectura actual lo soporta

La separación entre `ContentRepository` y `NavigationBuilder` permite esta evolución sin reescribir el dominio:

```text
ContentRepository              NavigationBuilder
     │                                │
  get(id)                      buildNavigationTree()
  getAncestors(id)             getBreadcrumbs()
  getSiblings(id)              getSidebarEntries()
  getChildren(id)              getImmediateChildren()
```

En SSR, `DatabaseRepository` puede implementar consultas puntuales. `NavigationBuilder` puede evolucionar para aceptar una rama parcial o funciones de consulta en lugar de `Document[]`.

### Regla

No optimizar prematuramente. Hoy el árbol completo es la solución pragmática. Cuando el modo dinámico escale, se añadirá una estrategia de rama parcial sobre la misma arquitectura.

## Editor integrado

El editor integrado permite editar documentos Markdown desde el navegador durante el modo desarrollo, sin necesidad de un editor de código.

- Cada documento tiene su propia URL de edición: `/{slug}/edit`.
- La vista de edición reutiliza el mismo layout que la vista de lectura, pero oculta el TOC y muestra el editor en el área de contenido.
- Botón "Editar" en el header de documentos; botón "Ver" en la vista de edición.
- Editor actual: CodeMirror 6, encapsulado en `src/components/DocumentEditor/` para poder cambiarlo sin tocar las páginas.
- Endpoints: plugin de Vite con `GET /api/editor/document?id=...` y `POST /api/editor/document`.
- Solo edita documentos existentes; índices se excluyen de la vista de edición en esta primera versión.
- Los ids se validan para evitar path traversal y se crean directorios padre automáticamente si se guarda en una ruta nueva.

Preguntas abiertas:

- ¿Edición de índices con una experiencia diferente?
- ¿CRUD completo (crear, renombrar, eliminar) o solo edición de contenido existente?
- ¿Activación explícita mediante variable de entorno o siempre en desarrollo?

## Próximos pasos documentados

1. **Editor integrado**: mejorar UX, añadir atajos de teclado y decidir si se amplía a CRUD completo.
2. **Edición en modo dinámico**: definir el flujo de escritura de vuelta a GitHub (u otra fuente externa) en producción.
3. **SSR a gran escala**: evolucionar `NavigationBuilder` para soportar ramas parciales cuando haya un `DatabaseRepository` y miles de documentos.

## Lo que NO se hará ahora

- No se implementa un adapter de base de datos real.
- No se cambia el flujo de build estático.
- No se añaden overrides ni manifest.

Todo eso se documenta y se deja listo para continuar sin reescribir el core.
