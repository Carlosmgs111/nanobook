# Changelog

Todos los cambios notables de este proyecto se documentarán en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

### Added
- `parseDocument(entry)` en `src/lib/document.ts` para extraer headings del contenido sin depender del loader ni de la extensión del archivo.

### Changed
- Refactor de `src/lib/content.ts`: elimina `getHeadings()` y su dependencia del filesystem.
- `src/pages/[...slug].astro` ahora consume headings a través de `parseDocument(entry)`.

### Fixed
- Tooltips del sidebar no se mostraban al hacer hover en modo colapsado.

## [0.1.0] - 2026-08-09

### Added
- Layout base con modo de ancho de contenido `constrained` / `full`.
- Header sticky que se adapta al ancho del modo de contenido.
- `SidebarNav` atómico con modo expandido/colapsado, tooltips y toggle.
- `TableOfContents` atómico con scroll spy, indicador visual y modo estándar/compacto.
- `ContentWidthToggle` para alternar entre ancho constrained y full.
- `ThemeToggle` con iconos SVG de sol/luna y brillo en modo oscuro.
- Íconos SVG consistentes con la identidad visual minimalista.
- Scroll vertical en `SidebarNav` con header fijo.
- Estilo global de scrollbar para el proyecto.
- Documentación del proyecto en `src/content/nanobook-project/`.

### Changed
- Migración del layout principal de grid a flex.
- Sidebar declarado con estilos condicionales en componentes hijos mediante `data-sidebar-mode`.
- TOC refactorizado a componentes atómicos basados en IDs y eventos personalizados.
- TOC en modo compacto: fondo con blur, índices más compactos, scrollbar estilizado, animación de despliegue y header sticky con borde inferior.
- Scrollbar de `SidebarNav` oculto para evitar que ocupe espacio en el contenedor.

### Fixed
- Ciclo infinito entre eventos `sidebar:mode` y `toc:mode` en `ContentWidthToggle`.
- Flash inicial del TOC al restaurar el modo guardado desde `localStorage`.
- Truncamiento de ítems largos en la lista del sidebar.
- Comportamiento responsive del header, breadcrumb y TOC en mobile.
- Sidebar en mobile: ahora muestra el texto completo en el drawer, independientemente del modo `collapsed` guardado.

[Unreleased]: https://github.com/usuario/nanobook/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/usuario/nanobook/releases/tag/v0.1.0
