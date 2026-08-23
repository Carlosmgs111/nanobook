---
title: "README del proyecto"
description: "Documentación de alto nivel de Nanobook: qué hace, cómo instalarlo y cómo está organizado."
date: 2026-08-21
author: "Nanobook Team"
tags: ["documentation", "nanobook"]
draft: false
index: false
---

# README del proyecto

Nanobook es un sitio estático construido con Astro para publicar contenido técnico organizado en libros, capítulos y artículos. Usa una estructura de carpetas y archivos Markdown con frontmatter para generar automáticamente índices de navegación.

## Características

- Índices jerárquicos generados automáticamente a partir de la estructura de carpetas.
- Contenido en Markdown con frontmatter.
- Renderizado de páginas estáticas o bajo demanda con Astro.
- Diseño con Tailwind CSS.
- Soporte para temas claro y oscuro.
- Editor integrado en desarrollo para editar documentos desde el navegador.
- Modos de despliegue estático (`OUTPUT_MODE=static`) y dinámico (`OUTPUT_MODE=dynamic`).
- Ordenamiento configurable de documentos mediante el campo `position` en frontmatter.

## Stack

![Astro](https://img.shields.io/badge/Astro-5-BC52EE?logo=astro&logoColor=white&style=plastic)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white&style=plastic)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white&style=plastic)
![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=nodedotjs&logoColor=white&style=plastic)
![Markdown](https://img.shields.io/badge/Markdown-000000?logo=markdown&logoColor=white&style=plastic)

## Requisitos

- Node.js >= 22.12.0

## Instalación

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — Inicia el servidor de desarrollo.
- `npm run build` — Genera el sitio en `dist/`. Por defecto usa `OUTPUT_MODE=static`.
- `npm run preview` — Previsualiza el sitio generado.

### Modos de despliegue

```bash
# Modo estático (default): genera HTML estático desde src/content/.
OUTPUT_MODE=static npm run build

# Modo dinámico: renderiza bajo demanda con contenido remoto desde GitHub.
OUTPUT_MODE=dynamic npm run build
```

## Estructura de contenido

El contenido se ubica en `src/content/` y sigue una jerarquía basada en carpetas:

```text
src/content/
├── index.md                              → /
├── blog/
│   ├── index.md                          → /blog/
│   └── overthinking.md                   → /blog/overthinking/
├── books/
│   ├── index.md                          → /books/
│   └── responsive-development/
│       ├── index.md                      → /books/responsive-development/
│       ├── overview.md                   → /books/responsive-development/overview/
│       └── chapter-1.md                  → /books/responsive-development/chapter-1/
├── guias/
│   ├── index.md                          → /guias/
│   └── markdown.md                       → /guias/markdown/
├── nanobook-project/
│   ├── index.md                          → /nanobook-project/
│   ├── meta/                             → /nanobook-project/meta/
│   ├── arquitectura/                     → /nanobook-project/arquitectura/
│   ├── interfaz/                         → /nanobook-project/interfaz/
│   ├── editor/                           → /nanobook-project/editor/
│   └── flujo-de-trabajo/                 → /nanobook-project/flujo-de-trabajo/
├── portfolio/
│   ├── index.md                          → /portfolio/
│   └── carlos-munoz.md                   → /portfolio/carlos-munoz/
└── proyectos/
    ├── index.md                          → /proyectos/
    └── generador-demos.md                → /proyectos/generador-demos/
```

## Convenciones de frontmatter

```md
---
title: "Título del documento"
description: "Breve descripción del contenido"
date: 2026-07-30
author: "Autor"
tags: ["tag1", "tag2"]
draft: false
index: true
position: 0
---
```

Campos:

- `title` (obligatorio): Título del documento o carpeta.
- `description` (obligatorio): Descripción corta.
- `date` (obligatorio): Fecha de publicación.
- `author` (obligatorio): Autor del contenido.
- `tags` (obligatorio): Lista de etiquetas.
- `draft` (opcional): Si es `true`, el documento no se genera.
- `index` (obligatorio para `index.md`): Marca el archivo como representación de una carpeta.
- `position` (opcional): Orden del documento dentro de su índice. Menor número = primero.
- `cover` (opcional): URL de imagen de portada para índices visuales.

## Reglas de indexado

- Cada carpeta que quiera aparecer en la navegación debe contener un archivo `index.md` con `index: true`.
- Las carpetas sin `index.md` no son visibles en los índices superiores.
- Los archivos que no son `index.md` se renderizan como documentos finales.
- Los documentos se listan en el índice de su carpeta padre inmediata.

## Arquitectura del proyecto

- `src/content/` — Contenido en Markdown.
- `src/pages/[...slug].astro` — Ruta dinámica universal que decide si renderizar un índice o un documento.
- `src/pages/[...slug]/edit.astro` — Vista de edición integrada.
- `src/documentIndex/components/IndexList.astro` — Componente de listado de índices.
- `src/layouts/Layout.astro` — Layout base del sitio.
- `src/content.config.ts` — Configuración de la colección de contenido.
- `src/document/` — Dominio de documentos: tipos, repositorios y adapters (`AstroCollectionRepository`, `MemoryRepository`, `DatabaseRepository`).
- `src/navigation/` — Construcción del árbol de navegación, breadcrumbs, sidebar e índices.
- `src/rendering/` — Capa de renderizado de Markdown con múltiples adapters y workers.
- `src/editor/` — Componentes y utilidades del editor integrado.
- `src/theme/` — Componentes relacionados con el tema claro/oscuro.
- `src/document/components/TableOfContents/` — Componentes y lógica de la tabla de contenidos.
- `src/contentWidth/` — Componente de control de ancho de contenido.
- `src/shared/` — Utilidades compartidas entre módulos.

## Extensibilidad

El sistema usa la API de loaders de Astro 5. El modo de despliegue se elige mediante `OUTPUT_MODE`:

- **Modo estático**: el loader `glob` lee archivos Markdown locales desde `src/content/`.
- **Modo dinámico**: el loader `github` obtiene contenido remoto desde un repositorio de GitHub.

En el futuro se pueden añadir loaders para CMS headless, S3, Notion u otras fuentes sin modificar el dominio de Nanobook.

## Licencia

Nanobook se distribuye bajo la [GNU Affero General Public License v3.0 (AGPL-3.0)](../../../../LICENSE).

Esto significa que el código fuente está disponible públicamente, puede estudiarse, modificarse y redistribuirse, y cualquier versión modificada que se ponga a disposición del público como servicio web debe publicar su código fuente bajo la misma licencia.
