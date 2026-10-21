# Personalización visual completa — Implementation Plan

**Estado (2026-10-21):** Implementadas las seis áreas del plan en `codex/personalizacion-visual`. Verificación automatizada: 333 pruebas y `npm run build` correctos. Se comprobó en navegador una página pública de lectura en claro y oscuro y el selector de ancho. La interacción del editor de temas con sesión autenticada queda pendiente de revisión manual; las rutas de guardado, herencia y vista previa tienen pruebas automatizadas.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar los tokens y controles visuales más útiles de Nanobook sin perder la herencia de los temas oficiales ni la legibilidad de las páginas.

**Architecture:** El dominio valida un conjunto pequeño de opciones públicas; `ResolveTheme` superpone los valores guardados a cada tema oficial y `contract.css` expone roles semánticos estables. El editor reutiliza los mismos presets que el servidor y analiza las combinaciones de color resueltas. Los componentes y la composición de lectura consumen esos roles, con una vista previa que cubre los estados relevantes.

**Tech Stack:** Astro 7, TypeScript, CSS custom properties, Vitest.

**Spec:** `src/content/nanobook-project/meta/referentes-personalizacion-visual.md` y `src/content/nanobook-project/meta/personalizacion-visual.md`.

## Global Constraints

- Conservar la estructura por módulo y entorno de `AGENTS.md`; los contratos puros no importan Astro, DOM ni I/O.
- Conservar el formato existente de temas persistidos. Un campo ausente sigue heredando del tema oficial y las opciones existentes conservan su significado.
- Los scripts enviados al navegador no importan valores de `theme/server`.
- Documentar decisiones relevantes en `src/content/nanobook-project/` y anotar cambios en `[Unreleased]` de `CHANGELOG.md`.
- Antes de cada commit ejecutar `npm run build`; si se hacen commits, usar Conventional Commits. Este plan no solicita tags ni release.

## File Map

| Responsabilidad | Archivos principales |
| --- | --- |
| Contrato y validación de opciones | `src/theme/server/domain/ThemeTokens.ts`, `src/theme/server/application/dto/ThemeDtos.ts` |
| Valores oficiales y resolución | `src/theme/server/infraestructure/OfficialThemeCatalog.ts`, `src/theme/server/application/ResolveTheme.ts`, `src/theme/shared/ThemePresets.ts` |
| Roles CSS por modo | `src/theme/browser/styles/contract.css` |
| Editor y vista previa | `src/theme/browser/ui/ThemeEditor.astro`, `src/theme/browser/ThemeEditorController.ts`, nuevo `src/theme/shared/ThemeContrast.ts` |
| Composición de página | `src/layouts/components/LayoutShell.astro`, `src/shared/styles/prose.css`, `src/layouts/components/ContentWidthToggle.astro` |
| Consumo por componentes | `src/shared/styles/components/`, `src/navigation/browser/ui/components/`, `src/documents/browser/ui/components/`, `src/layouts/components/` y `src/toast/browser/` |

## Review Focus

1. Un tema antiguo sin campos nuevos debe mantener su aspecto heredado en ambos modos: prueba de resolución en tarea 1.
2. Un tema con fondo semitransparente oficial debe producir un análisis de contraste correcto sobre el fondo real: prueba de mezcla alfa en tarea 2.
3. Un cambio de acento sin cambio de `accentText` puede crear contraste insuficiente: prueba de advertencia en tarea 2.
4. El modo de ancho completo debe ampliar tablas y código sin producir párrafos demasiado largos: prueba estructural y revisión visual en tarea 4.
5. La navegación cliente entre nanobooks con temas diferentes debe sustituir todos los roles nuevos: prueba de instalación/navegación en tarea 6.

---

## Entrega 1: legibilidad y estados

### Task 1: Roles públicos de color y compatibilidad

**Files:** Modify `src/theme/server/domain/ThemeTokens.ts`, `src/theme/server/application/dto/ThemeDtos.ts`, `src/theme/server/infraestructure/OfficialThemeCatalog.ts`, `src/theme/server/application/ResolveTheme.ts`, `src/theme/browser/styles/contract.css`; test `src/theme/server/domain/Theme.test.ts`, `src/theme/server/application/ResolveTheme.test.ts`, `src/theme/server/application/CompileTheme.test.ts`, `src/theme/browser/styles/themeStyles.test.ts`.

**Interfaces:** Añadir a cada paleta los nombres externos `link`, `focusRing`, `selectionBg`, `selectionText`, `surfaceRaised`; conservar los nombres actuales. El DTO mapea esos nombres uno a uno a `ThemeColorTokens`, y el CSS instalado expone `--theme-{light|dark}-{link|focus-ring|selection-bg|selection-text|surface-raised}`. El contrato activo expone `--theme-link`, `--theme-focus-ring`, `--theme-selection-bg`, `--theme-selection-text`, `--theme-surface-raised`.

- [ ] Escribir pruebas que acepten los cinco campos, rechacen un campo desconocido y verifiquen compilación y selección de modo.
- [ ] Añadir valores oficiales para claro y oscuro: `link` y `focusRing` heredan el acento; `selectionBg` hereda el acento; `selectionText` hereda `accentText`; `surfaceRaised` conserva la mezcla actual de superficie (92 %) y texto (8 %). Resolver esas referencias por modo antes de compilar para que un override de acento se propague si el rol dependiente no fue personalizado.
- [ ] Extender DTO, validación, superposición y contrato CSS. Un tema sin campos nuevos debe resolver al mismo valor oficial; un tema con override debe afectar solo al modo indicado.
- [ ] Ejecutar `npm test -- src/theme/server/domain/Theme.test.ts src/theme/server/application/ResolveTheme.test.ts src/theme/server/application/CompileTheme.test.ts src/theme/browser/styles/themeStyles.test.ts` y `npm run build`; confirmar que pasan.
- [ ] Actualizar `CHANGELOG.md` y el contrato documental. Si se registra un commit, usar `feat(theme): ampliar roles semánticos de color` después del build.

### Task 2: Análisis de contraste de paletas resueltas

**Files:** Create `src/theme/shared/ThemeContrast.ts`, `src/theme/shared/ThemeContrast.test.ts`; modify `src/theme/browser/ThemeEditorController.ts`, `src/theme/browser/ui/ThemeEditor.astro`; test `src/theme/browser/ThemeEditorController.test.ts`.

**Interfaces:** `analyzeThemeContrast(palettes: { light: Record<string, string>; dark: Record<string, string> }): ContrastIssue[]`, donde cada issue incluye `mode`, `pair`, `ratio`, `minimum`. Entradas: variables CSS sin prefijo del catálogo superpuestas con los controles explícitos. Pares mínimos: `text/page-bg`, `text/surface-bg`, `text-muted/page-bg`, `link/page-bg`, `accent-text/accent`, `selection-text/selection-bg`, `focus-ring/page-bg`, `focus-ring/surface-bg` y bordes de controles contra su fondo. Umbrales: 4.5:1 para texto normal y 3:1 para borde/foco necesario. Un fondo `rgba` se compone sobre `page-bg` antes del cálculo.

- [ ] Escribir pruebas para luminancia y razón WCAG, alfa sobre fondo, ambos modos y el caso de acento modificado con texto sobre acento heredado.
- [ ] Implementar el cálculo puro en `theme/shared`; aceptar `#RRGGBB`, `rgb()` y `rgba()` del catálogo y sus fondos compuestos. Informar como `unverifiable` si el color no puede resolverse, sin presentar un aprobado falso.
- [ ] Resolver en el editor las paletas base más overrides en cada cambio de control, mostrar pares, razón y umbral, y enlazar cada advertencia al control responsable. Mantener el guardado permitido con advertencias: la validación de dominio sigue siendo sintáctica.
- [ ] Probar que restablecer herencia y cambiar tema base actualiza el análisis; comprobar que el servidor no entra en el bundle cliente.
- [ ] Ejecutar pruebas dirigidas y `npm run build`; verificar manualmente los dos temas oficiales y un acento problemático. Registrar `feat(theme): mostrar contraste de paletas` si se hace commit.

### Task 3: Estados de interacción coherentes

**Files:** Modify `src/theme/browser/styles/contract.css`, `src/shared/styles/base.css`, `src/shared/styles/components/index-card.css`, `src/shared/styles/prose.css`, `src/layouts/components/Header.astro`, `src/navigation/browser/ui/components/SidebarNav/index.astro`, `src/toast/browser/ToastHost.astro`, and other actual consumers found by the inventory; test `src/theme/browser/styles/themeStyles.test.ts` and component tests beside changed components.

**Interfaces:** El contrato deriva `--theme-action-hover`, `--theme-action-active`, `--theme-control-disabled`, `--theme-navigation-selected-bg` y `--theme-navigation-selected-text` de los roles de tarea 1. `focus-visible` utiliza `--theme-focus-ring`; la selección de texto utiliza los roles de selección. Los estados de error conservan su rol de estado.

- [ ] Inventariar con `rg` colores literales y roles usados en botón, enlace, campo, tarjeta, navegación, aviso y código; registrar en `src/content/nanobook-project/meta/personalizacion-visual.md` los estados que aplican a cada familia.
- [ ] Escribir pruebas de contrato para ambos modos y de componentes para al menos foco visible, elemento seleccionado y estado deshabilitado.
- [ ] Sustituir los valores literales o mezclas locales relevantes por roles del contrato. No forzar estados que el componente no tiene.
- [ ] Verificar con teclado y ratón `hover`, `active`, `focus-visible`, `selected`, `disabled` y error en páginas reales; probar móvil y escritorio, claro y oscuro.
- [ ] Ejecutar pruebas dirigidas y `npm run build`; registrar `feat(theme): unificar estados visuales` si se hace commit.

## Entrega 2: composición editorial

### Task 4: Presets tipográficos y medida de lectura

**Files:** Modify `src/theme/server/domain/ThemeTokens.ts`, `src/theme/server/application/dto/ThemeDtos.ts`, `src/theme/shared/ThemePresets.ts`, `src/theme/server/infraestructure/OfficialThemeCatalog.ts`, `src/theme/server/application/ResolveTheme.ts`, `src/theme/browser/styles/contract.css`, `src/theme/browser/ui/ThemeEditor.astro`, `src/theme/browser/ThemeEditorController.ts`, `src/layouts/components/LayoutShell.astro`, `src/shared/styles/prose.css`; test existing domain, DTO, resolver and controller suites.

**Interfaces:** Añadir `typography.rhythm: "compact" | "balanced" | "airy"` y `layout.readingMeasure: "narrow" | "standard" | "wide"`. `rhythm` define juntos interlineado del cuerpo, relación de títulos y espacio entre párrafos; `readingMeasure` fija máximos de `60ch`, `72ch` y `84ch`. Los temas existentes heredan `balanced` y `standard` sin cambio de CSS efectivo hasta que se seleccione un override. El ancho de lienzo que controla `ContentWidthToggle` permanece separado de la medida de lectura.

- [ ] Escribir pruebas de aceptación/rechazo de presets, herencia y salida CSS en los dos modos; añadir prueba de markup/CSS que confirme una región de prosa limitada y tablas/código con espacio del lienzo.
- [ ] Definir valores de `rhythm` en `ThemePresets.ts` tomando el ritmo visual actual como `balanced`; reutilizar el mismo mapa en resolver y vista previa. Mantener tamaño general `typography.scale` compatible.
- [ ] Aplicar `readingMeasure` solo a bloques de lectura (párrafos, títulos, listas, citas), preservando contenedores anchos para tabla, imagen y `pre`. Evitar recortes con contenido largo sin espacios.
- [ ] Añadir controles y vista previa con documento de muestra que contenga títulos, párrafos largos, listas, cita, tabla y código; probar también ancho completo y móvil.
- [ ] Ejecutar pruebas dirigidas y `npm run build`; registrar `feat(theme): añadir ritmo y medida de lectura` si se hace commit.

### Task 5: Escala espacial de la página

**Files:** Modify `src/theme/shared/ThemePresets.ts`, `src/theme/server/infraestructure/OfficialThemeCatalog.ts`, `src/theme/server/application/ResolveTheme.ts`, `src/theme/browser/styles/contract.css`, `src/shared/styles/prose.css`, `src/layouts/components/LayoutShell.astro`, `src/theme/browser/ThemeEditorController.ts`; test resolver and editor suites.

**Interfaces:** La opción existente `layout.density` conserva `compact|comfortable|relaxed`, pero produce `--theme-space-inline`, `--theme-space-block`, `--theme-space-section` además de `--theme-content-gap`. Los cuatro valores forman una escala creciente y mantienen los valores actuales de `--theme-content-gap` (`1rem`, `1.5rem`, `2rem`).

- [ ] Escribir pruebas que demuestren progresión monotónica de los tres presets y la conservación del gap existente.
- [ ] Mover los valores de densidad a un solo mapa compartido y aplicarlos en resolver, catálogo, contrato y vista previa.
- [ ] Sustituir espacios aislados en composición de lectura y secciones principales cuando representen ritmo del tema; dejar tamaños táctiles y espacios funcionales mínimos independientes de la densidad.
- [ ] Revisar páginas largas y cortas, con y sin TOC/sidebar, en móvil y escritorio; ejecutar pruebas dirigidas y `npm run build`. Registrar `feat(layout): sistematizar escala espacial` si se hace commit.

## Entrega 3: capas, variantes y cierre

### Task 6: Superficies, variantes y paridad de vista previa

**Files:** Modify `src/theme/browser/styles/contract.css`, `src/theme/browser/ui/ThemeEditor.astro`, `src/theme/browser/ThemeEditorController.ts`, `src/theme/browser/ThemeNavigationController.ts`, `src/shared/styles/components/index-card.css`, `src/navigation/browser/ui/components/IndexList/index.astro`, `src/theme/server/application/ResolveTheme.ts` only if needed; test `src/theme/browser/ThemeNavigationController.test.ts`, `src/theme/browser/ThemeEditorController.test.ts`, `src/theme/browser/styles/themeStyles.test.ts`.

**Interfaces:** `surfaceRaised` de tarea 1 es la capa elevada; las variantes de tarjeta, cubierta y navegación se expresan primero con `shape`, `decoration` y roles semánticos existentes. Solo agregar un selector público de variante si dos diseños útiles no pueden representarse con esos controles. La vista previa debe usar las mismas variables que la página real y mostrar estados normal, elevado, seleccionado y foco.

- [ ] Escribir prueba de sustitución de todos los roles nuevos al navegar entre nanobooks con temas diferentes, incluidos los dos modos.
- [ ] Auditar capas de tarjeta, panel, navegación y aviso; conectar `surfaceRaised`, borde y sombra sin duplicar fórmulas por componente.
- [ ] Extender la vista previa para mostrar una página de lectura, tarjeta, enlace, control y navegación con sus estados; probar herencia, reset y edición de tema existente.
- [ ] Ejecutar `npm test` y `npm run build`, revisar manualmente ambos temas oficiales y uno personalizado extremo en claro/oscuro y móvil/escritorio.
- [ ] Actualizar el contrato documental y `CHANGELOG.md`; registrar `feat(theme): completar capas y vista previa` si se hace commit.

## Criterios de cierre

- Los temas antiguos cargan sin migración de datos y los controles no modificados no se guardan como overrides.
- Cada token público nuevo tiene validación, DTO, valor oficial, resolución, variable activa, consumidor visible, control y vista previa.
- El editor informa contraste insuficiente para las parejas esenciales en ambos modos y no califica como correcto un color que no puede calcular.
- La lectura mantiene medida razonable al ampliar el lienzo; tablas y código aprovechan el espacio disponible sin desbordar móvil.
- `npm test` y `npm run build` pasan. La revisión manual cubre teclado, ratón, móvil/escritorio y claro/oscuro.
