---
title: "Fase 0 — Alpha"
description: "Características mínimas de la primera versión alpha de Nanobook."
date: 2026-08-21
author: "Nanobook"
tags: ["roadmap", "alpha", "nanobook"]
draft: false
index: false
---

# Fase 0 — Alpha

Objetivo de esta fase: tener una versión usable para documentación mínima, con navegación clara y un tema funcional.

## Navegación

- [x] Navegación transversal — Breadcrumb.
- [x] Navegación lateral contextual, elementos adyacentes — Sidebar.
- [ ] Navegación intra-página — Table of Contents activo.

## Internacionalización

- [x] Español como idioma por defecto.
- [ ] Inglés como idioma alternativo.

## Funcionalidades activables via frontmatter

- [ ] Cambiar espaciado de interlinea en bloques de código.
- [ ] Agrupación visual de secciones jerárquicas:

```markdown
## Bloque 1

### Bloque 1.1

<!-- Este bloque debería indicar visualmente que pertenece al Bloque 1 -->

## Bloque 2

### Bloque 2.1

<!-- Este bloque debería indicar visualmente que pertenece al Bloque 2 -->
```

## Criterios de salida

- Se puede publicar contenido técnico jerárquico sin errores de build.
- La navegación principal (breadcrumb + sidebar) funciona en desktop y mobile.
- El tema claro/oscuro es usable.
