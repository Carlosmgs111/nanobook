# Convenciones para agentes de código

## Versionado

El proyecto usa **Semantic Versioning** y **Conventional Commits**.

- Formato de versión: `MAJOR.MINOR.PATCH`. Actualmente estamos en `0.x.x`.
- Mensajes de commit: `tipo(alcance): descripción`.
  - `feat` — nueva funcionalidad.
  - `fix` — corrección de bug.
  - `refactor` — cambio de estructura sin cambiar comportamiento.
  - `docs` — documentación.
  - `style` — cambios visuales.
  - `chore` — tareas de mantenimiento.
- Alcances comunes: `theme`, `layout`, `sidebar`, `toc`, `content-width`, `docs`.

Antes de cualquier commit o tag, ejecutar `npm run build` y asegurarse de que pase.

## Changelog

Mantener `CHANGELOG.md` actualizado. Los cambios sin versión van en `[Unreleased]`. Al releasear, moverlos a una versión numerada con fecha.

## Tags

Crear tags anotados sobre `main`:

```bash
git tag -a v0.x.x -m "Release v0.x.x: descripción corta"
```

## Estructura de módulos

El código fuente en `src/` se organiza por dominios de negocio. Cada dominio se divide en carpetas semánticas:

```text
src/
  document/          # Dominio: documentos
    model/           # Tipos y contratos puros (Document, ContentRepository, etc.)
    parse/           # Frontmatter, parseDocument, path, proxy
    change/          # Snapshot, detección de cambios, invalidación
    reference/       # Contratos y lógica pura de referencias
    adapters/        # Implementaciones concretas
      repository/    # ContentRepository implementations
      cache/         # Cachés de repositorio y páginas renderizadas
      loader/        # Loaders (github-loader)
      reference/     # Resolutores de referencias con side effects
    api/             # API routes
    ui/              # Componentes Astro del documento

  navigation/        # Dominio: navegación
    model/           # Tipos (NavigationNode, DocumentGraph, etc.)
    graph/           # DocumentGraph, dependencias, invalidación
    service/         # NavigationService (breadcrumbs, sidebar)

  rendering/         # Dominio: renderizado
    model/           # Tipos (RenderedDocument, DocumentRenderer)
    page/            # PageRenderer, PageCache
    adapters/        # Implementaciones
      markdown/      # Renderizadores Markdown
      cache/         # Cachés de páginas renderizadas
    client/workers/  # Workers de renderizado en cliente

  edition/           # Dominio: edición
    client/          # Código que corre en navegador
    ui/              # Componentes Astro de edición

  shared/            # Utilidades transversales
    utils/           # Funciones puras genéricas
```

Reglas:
- `model/` solo contiene tipos y contratos, sin dependencias de Astro ni I/O.
- `adapters/` contiene implementaciones con side effects (filesystem, red, Astro, etc.).
- `client/` contiene código que depende de APIs del navegador.
- `ui/` contiene componentes Astro.
- Evitar `core` como cajón de sastre; usar nombres que describan la responsabilidad.

## Documentación de decisiones

Las decisiones arquitectónicas, bugs importantes y cambios de convenciones deben documentarse en `src/content/nanobook-project/` cuando aporten contexto para futuras sesiones.
