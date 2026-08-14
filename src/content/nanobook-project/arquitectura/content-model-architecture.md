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

Nanobook nació como un generador estático que carga Markdown desde `src/content/` mediante el loader `glob` de Astro. Más adelante se añadió un loader `github` para mezclar contenido remoto. Eso funciona, pero el código depende demasiado de la forma en que Astro expone las entradas (`entry.id`, `entry.data`, `entry.body`).

Surge la pregunta: ¿deberíamos migrar el contenido a una base de datos para poder ofrecer edición online, colaboración y SaaS?

## Decisión

**No migrar a base de datos en esta etapa.**

Seguimos con:

```text
Markdown + Filesystem + Git + Astro
```

Pero cambiamos la arquitectura para que el modelo de contenido no dependa del filesystem ni de Astro. Astro pasa a ser una capa de publicación/rendering, no el corazón del dominio.

## Principio rector

> El dominio de Nanobook nunca debe saber si un documento proviene de Markdown, PostgreSQL, GitHub o una API.

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
            Publishing API
                   │
        ┌──────────┴──────────┐
        │                     │
   Static Build            Runtime
        │                     │
     Astro SSG            Astro SSR
        │                     │
     HTML/CDN              Server
```

Por debajo:

```text
           Storage Adapter
                  │
        ┌─────────┴─────────┐
        │                   │
    Filesystem           Database
        │                   │
      Markdown          PostgreSQL
        │                   │
        └──────────┬──────────┘
                   │
            Content Tree
```

## Conceptos del dominio

- **Document**: unidad mínima de contenido. Tiene `id`, `slug`, `parentId`, `position`, `title`, `description`, `content` y `metadata`.
- **ContentRepository**: interfaz para listar, obtener y buscar hijos de documentos.
- **NavigationBuilder**: construye árboles de navegación a partir de una lista de documentos.
- **DocumentRenderer**: convierte el contenido crudo en HTML y extrae headings.
- **Publisher**: genera el sitio público, estático o en runtime.

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
- El build genera 52 páginas correctamente.

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

No optimizar prematuramente. Hoy el árbol completo es la solución pragmática. Cuando el SaaS lo requiera, se añadirá una estrategia de rama parcial sobre la misma arquitectura.

## Próximos pasos documentados

1. **DocumentRenderer**: abstraer el renderizado de Markdown. Actualmente `AstroCollectionRepository.render()` hace ese trabajo porque Astro necesita su entrada original; en el futuro se puede extraer a un adapter propio.
2. **Storage adapters**: añadir `FileSystemRepository`, `MemoryRepository` y un stub de `DatabaseRepository` cuando sea necesario. No se implementan ahora porque Astro sigue siendo el único publisher.
3. **Publisher + manifest**: habilitar static/SSR híbrido y parches dinámicos. Se deja documentado para cuando se retome la Propuesta B de parches dinámicos.
4. **Ordering**: añadir `position` al frontmatter y al schema de Astro para permitir orden explícito de documentos.

## Lo que NO se hará ahora

- No se implementa un adapter de base de datos real.
- No se cambia el flujo de build estático.
- No se añade SSR ni API REST todavía.

Todo eso se documenta y se deja listo para continuar sin reescribir el core.
