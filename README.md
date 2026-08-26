# Nanobook

![Versión](https://img.shields.io/badge/version-0.2.0--alpha.1-BC52EE?style=plastic)
![Astro](https://img.shields.io/badge/Astro-7-BC52EE?logo=astro&logoColor=white&style=plastic)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white&style=plastic)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white&style=plastic)
![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=nodedotjs&logoColor=white&style=plastic)
![Markdown](https://img.shields.io/badge/Markdown-000000?logo=markdown&logoColor=white&style=plastic)

Nanobook es un sitio de documentación técnica construido con Astro. Organiza el contenido en libros, capítulos, guías, artículos y proyectos a partir de archivos Markdown con frontmatter, generando automáticamente índices, navegación y tablas de contenidos.

> **Estado**: `v0.3.0`. El proyecto es funcional pero aún en fase alpha. La API de contenido, URLs y componentes puede cambiar hasta llegar a `v1.0.0`.

## Características

### Contenido y navegación

- **Índices jerárquicos** generados automáticamente a partir de la estructura de carpetas en `src/content/`.
- **Sidebar navegable** con modo expandido/colapsado, tooltips y drawer en mobile.
- **Breadcrumbs** automáticos según la posición del documento en el árbol.
- **Tabla de contenidos (TOC)** con scroll spy, indicador visual y modos estándar/compacto.
- **Ordenamiento configurable** de documentos mediante el campo `position` en frontmatter.
- **Soporte para borradores**: los documentos con `draft: true` no se generan.
- **Etiquetas (`tags`)** y metadatos (`title`, `description`, `date`, `author`, `cover`).

### Lectura y experiencia de usuario

- **Temas claro y oscuro** con toggle y persistencia en `localStorage`.
- **Ancho de contenido ajustable** (`constrained` / `full`) con persistencia.
- **Diseño responsive** con header sticky y adaptación mobile.
- **Renderizado Markdown** con soporte para GitHub Flavored Markdown, anclas en headings y resaltado de sintaxis con Shiki.
- **Navegación fluida** mediante `ClientRouter` de Astro.

### Edición y preview

- **Editor integrado en desarrollo** accesible desde `/{slug}/edit`, basado en CodeMirror 6.
- **Preview sin guardar** en `/{slug}/preview`: renderiza el borrador en el navegador usando un Web Worker.
- **Renderizado en worker** con `markdown-it` + Shiki para no bloquear la UI del editor.
- **Persistencia efímera** del borrador en `sessionStorage`, limpiada al salir del flujo edit/preview.

### Arquitectura y despliegue

- **SSR puro con Astro**: todas las rutas se renderizan bajo demanda (`output: "server"`) y se cachean con `Cache-Control`.
- **Fuentes de contenido intercambiables**: `FileSystemRepository` (local), `GitHubRepository` (remoto) y `MemoryRepository` (tests). Se eligen mediante `CONTENT_SOURCE`.
- **Capa de dominio desacoplada** en `src/document/`, `src/navigation/`, `src/rendering/`, `src/edition/` y `src/theme/`.
- **Adapters de rendering** pluggables: `MarkdownItRenderer` (activo), `AstroMarkdownRenderer` y `UnifiedMarkdownRenderer`.

## Stack

- **Framework**: Astro 7
- **Estilos**: Tailwind CSS 4 + `@tailwindcss/typography`
- **Lenguaje**: TypeScript
- **Runtime**: Node.js >= 22.12.0
- **Editor**: CodeMirror 6
- **Renderizado Markdown**: markdown-it, @shikijs/markdown-it, markdown-it-anchor
- **Syntax highlighting**: Shiki con motor de regex JavaScript

## Requisitos

- Node.js >= 22.12.0
- npm

## Instalación

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — Inicia el servidor de desarrollo.
- `npm run build` — Genera el sitio SSR en `dist/`.
- `npm run preview` — Previsualiza el sitio generado.
- `npm run start` — Inicia el servidor Node.js (requiere build previo).

### Fuentes de contenido

Por defecto se lee desde `src/content/`. Para usar GitHub como fuente:

```bash
CONTENT_SOURCE=github \
  GITHUB_OWNER=owner \
  GITHUB_REPO=repo \
  GITHUB_BRANCH=main \
  GITHUB_TOKEN=token \
  npm run dev
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
cover: "/images/portada.png"
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
- `src/pages/[...slug]/index.astro` — Ruta dinámica universal para documentos e índices.
- `src/pages/[...slug]/edit.astro` — Vista de edición integrada.
- `src/pages/[...slug]/preview.astro` — Vista de preview del borrador.
- `src/document/` — Dominio de documentos: tipos, repositorios y adapters (`FileSystemRepository`, `GitHubRepository`, `MemoryRepository`).
- `src/document/components/IndexList/` — Listado de índices jerárquicos.
- `src/document/components/TableOfContents/` — Componentes y lógica de la tabla de contenidos.
- `src/navigation/` — Construcción del árbol de navegación, breadcrumbs, sidebar e índices.
- `src/rendering/` — Capa de renderizado de Markdown con múltiples adapters y Web Worker.
- `src/edition/` — Componentes y lógica del editor integrado (CodeMirror, stage, save).
- `src/theme/` — Componentes relacionados con el tema claro/oscuro.
- `src/layouts/` — Layouts base, incluyendo control de ancho de contenido.
- `src/shared/` — Utilidades compartidas entre módulos.
- `src/content.config.ts` — Configuración de la colección de contenido.

## Extensibilidad

El sistema usa `ContentRepository` como contrato. La fuente de contenido se elige mediante `CONTENT_SOURCE`:

- **FileSystemRepository**: lee archivos Markdown locales desde `src/content/`.
- **GitHubRepository**: obtiene contenido remoto desde un repositorio de GitHub.

En el futuro se pueden añadir repositorios para CMS headless, S3, Notion u otras fuentes implementando `ContentRepository` sin modificar el dominio de Nanobook.

## Versionado

El proyecto sigue [Semantic Versioning](https://semver.org/lang/es/) y [Conventional Commits](https://www.conventionalcommits.org/). Consulta `CHANGELOG.md` y `src/content/nanobook-project/flujo-de-trabajo/versionado.md` para más detalles.

## Licencia

Nanobook se distribuye bajo la [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).

Esto significa que:

- El código fuente está disponible públicamente y puede estudiarse, modificarse y redistribuirse.
- Cualquier versión modificada que se distribuya o ponga a disposición del público como servicio web debe publicar su código fuente bajo la misma licencia.
- Se preserva la atribución al autor original.
- No se permite convertir el proyecto o derivados en software propietario cerrado.

Para más detalles, consulta el archivo [LICENSE](LICENSE) o <https://www.gnu.org/licenses/agpl-3.0.html>.
