# Theme

> Dueño de la apariencia de Nanobook: catálogo de temas oficiales, temas personalizados por usuario, resolución y compilación a variables CSS, contrato visual `--theme-*` y editor de temas.

**Nivel:** Capa superior  ·  **Entornos:** browser / server / shared

## Qué hace
- Define los 6 temas oficiales (`classic`, `nanobook`, `herbario`, `plano`, `monocromo`, `companio`) en `shared/OfficialThemeCatalog.ts`.
- Gestiona temas personalizados por usuario: crear, listar, leer y actualizar (`Theme`, `CreateTheme`, `UpdateTheme`, `ListThemes`, `GetTheme`). Solo se guardan los tokens que el usuario cambió sobre un tema base oficial.
- Valida los tokens (`validateThemeTokens`): colores `#rrggbb`, tipografía, forma, layout y decoración con valores de un conjunto cerrado; rechaza campos no permitidos. Migra el campo heredado `decoration.pagePattern` a `decoration.pattern`.
- Resuelve la referencia de tema de un nanobook (`ResolveTheme`) a variables `--theme-light-*` / `--theme-dark-*` y las compila (`CompileTheme`) en una hoja CSS determinista.
- Valida y asigna la referencia de tema a un nanobook (`AssignNanobookTheme`), delegando la escritura en una función inyectada.
- Provee el contrato visual (`browser/ui/styles/contract.css`), el editor de temas (`/themes`), la reaplicación del tema tras navegación de `ClientRouter` y el botón de modo claro/oscuro.
- NO persiste ni autoriza la asignación al nanobook (eso es de `nanobooks`), no importa módulos de negocio desde el código de producción, no admite CSS arbitrario, borrado de temas ni historial.

## Cómo está construido
```text
src/theme/
  shared/                       # Puro, usable en browser y server
    OfficialThemeCatalog.ts     # Definiciones light/dark de los 6 temas; get(id) cae a monocromo si el id no existe
    ThemePresets.ts             # Valores concretos de presets (patrón, esquinas, sombra, densidad, ritmo, portada)
    ThemeCss.ts                 # serializeThemeCss: variables -> ":root[data-theme-key]{...}" ordenado
    ThemeContrast.ts            # analyzeThemeContrast: pares WCAG (4.5 / 3)
    ColorPreview.ts
  server/
    index.ts                    # ThemeModule (compositor)
    domain/                     # Theme, ThemeTokens, errors, ports/ThemeRepository
    application/                # Casos de uso, DTOs (dto/ThemeDtos.ts), ownership.ts, ColorModePreference.ts
    infraestructure/
      repository/               # DrizzleThemeRepository, InMemoryThemeRepository
      database/                 # DrizzleThemeSchema.ts (tabla `theme`)
      rest/                     # ThemeCollectionController, ThemeItemController, AssignNanobookThemeController, responses.ts
  browser/
    infrastructure/HttpThemeApi.ts      # Cliente fetch de /api/themes
    ui/ThemesPage.astro, ThemeEditor.astro, ThemeEditorController(.astro/.ts)
    ui/ThemeNavigationController.ts     # Reinstala la hoja del tema tras navegar
    ui/components/ColorModeToggle.astro
    ui/styles/contract.css              # Selecciona paleta activa y deriva roles semánticos
```
- **Dominio:** `Theme` (id, ownerId, nombre <= 80, `baseThemeId`, tokens validados; `Theme.create` devuelve `Result`), `ThemeTokens` y errores `InvalidThemeError` / `ThemeRepositoryError`.
- **Aplicación:** `ResolveTheme`, `CompileTheme`, `GetAssignableTheme`, `AssignNanobookTheme`, `CreateTheme`, `UpdateTheme`, `ListThemes` (antepone los 6 oficiales con `editable: false`), `GetTheme`, `findOwned` (distingue `ThemeNotFoundError` de `ThemeAccessDeniedError`) y `normalizeColorModePreference` (todo valor distinto de `light`/`dark` -> `light`).
- **Puertos:** `ThemeRepository` (`create`, `update`, `findById`, `findByOwner`, `listByOwner`) -> `DrizzleThemeRepository` (SQLite, tokens en `tokens_json`) y `InMemoryThemeRepository`. `NanobookThemeWriter` (definido en `AssignNanobookTheme.ts`) lo implementa `NanobookModule.setNanobookTheme`, inyectado por `Application`.
- **Contrato compartido:** `ThemeReference` / `isThemeReference` viven en `src/shared/theme/ThemeReference.ts` (`{kind:"official", id}` | `{kind:"custom", id}`), para que `nanobooks` no importe `theme`.
- **Eventos:** no emite ni consume.
- **Persistencia:** tabla `theme` (`id`, `owner_id`, `name`, `base_theme_id`, `tokens_json`, `created_at`, `updated_at`; índice por propietario) vía `shared/infrastructure/database/drizzleDatabase`. Cookie `nanobook-color-mode` para el modo de color (la lee SSR en los layouts y la escribe `ColorModeToggle`).
- **Librerías:** `drizzle-orm` (sqlite-core), `astro` (APIRoute). Sin dependencias específicas adicionales.

Flujo de aplicación: `ResolveTheme.execute(ref)` superpone los tokens del tema (si es `custom`) sobre el base oficial y prefija las claves -> `AppliedTheme {key, baseId, lightVariables, darkVariables}` -> `CompileTheme.execute` -> `ThemeInstallation {key, baseId, variables, cssText}` -> el layout lo escribe en `<style data-nanobook-theme>` y en `<meta data-theme-state>`. `contract.css` mapea `--theme-light-*` a `--theme-*` según `html[data-color-mode]`.

## Cómo se usa
- Punto de entrada: `src/theme/server/index.ts` exporta `ThemeModule` (`ThemeModule.create(routeProtector, nanobookThemeWriter)`), los tipos `AppliedTheme`, `ThemeReference`, `ThemeInstallation` y `normalizeColorModePreference`. `src/application/server/Application.ts` lo compone con `routeProtector` y `nanobookModule.setNanobookTheme`. Expone: `resolveTheme`, `compileTheme`, `getAssignableTheme`, `createTheme`, `updateTheme`, `listThemes`, `getTheme`, `collectionRoutes`, `itemRoutes`, `assignNanobookThemeRoute`.
- Ejemplo (páginas SSR y layouts):
```ts
const theme = await app.themeModule.resolveTheme.execute(nanobook.getSettings().theme, Astro.request);
const installation = app.themeModule.compileTheme.execute(theme);
// <style data-nanobook-theme is:inline set:html={installation.cssText}></style>
```
- Referencia de tema por defecto (sin referencia o id oficial desconocido): `monocromo`. `LandingLayout` solo admite `?theme=nanobook`; en otro caso usa `monocromo`.
- Endpoints (adaptadores finos en `src/pages/api`, todos `prerender = false` y protegidos con `routeProtector.protect(...)`; devuelven 401 sin `locals.currentUserId`):

| Ruta | Método | Función |
| --- | --- | --- |
| `/api/themes` | GET | Lista oficiales + propios del usuario |
| `/api/themes` | POST | Crea (`name`, `baseThemeId`, `tokens` solamente) -> 201 |
| `/api/themes/[themeId]` | GET / PATCH | Lee / actualiza (`name`, `tokens`) un tema propio |
| `/api/nanobooks/[nanobookId]/theme` | POST | Asigna `{ reference }` -> 204 |

- Páginas: `src/pages/themes.astro` (SSR; redirige a `/login?callbackURL=/themes` sin sesión) renderiza `theme/browser/ui/ThemesPage.astro` con `?theme=<id>` para editar. `ThemeEditorController.astro` monta el editor en cada `astro:page-load`.
- Cliente: `new HttpThemeApi().list/get/create/update`. `ThemeNavigationController` se instala desde `layouts/components/StateRestoreScripts.astro`.

## Dependencias
- **Depende de:** `shared/` (`Result`, `drizzleDatabase`, `RouteProtector`, `theme/ThemeReference`); `authorization/server` solo en `AssignNanobookThemeController` para `AccessDeniedError`, `AccessCheckFailedError` y `accessErrorResponse`; `auth/shared/AuthSession` (tipo) y `layouts/Layout.astro` en `ThemesPage.astro`; `shared/styles` y `shared/icons`.
- **Lo usan:** `layouts` (`Layout`, `LandingLayout`, `Header`, `StateRestoreScripts`) para resolver, compilar e instalar el tema; `documents/browser/ui/pages/{DocumentPage,EditPage,NewPage,PreviewPage}.astro` para resolver el tema del nanobook; `nanobooks` (`NanobookCard.astro`, valida `isThemeReference`); `application/server` (composición); `shared/styles/global.css` importa `contract.css`.
- Acoplamientos a vigilar: (1) `theme/browser/ui/ThemesPage.astro` importa `layouts/Layout.astro` y `Layout` importa `ColorModeToggle` y `ThemeNavigationController` de `theme` (dependencia circular a nivel de carpetas, aceptada para componentes de presentación); (2) las pruebas `AssignNanobookTheme.test.ts` y `AssignNanobookThemeController.test.ts` importan `nanobooks/` y `authorization/` (el código de producción no importa `nanobooks`); (3) `theme/` tiene un entorno `shared/` que AGENTS.md no lista para este módulo.

## Seguridad y autorización
- Los endpoints `/api/themes*` y `/api/nanobooks/[id]/theme` se envuelven con `RouteProtector.protect`. Los controladores exigen `locals.currentUserId` (401 si falta).
- La propiedad de los temas personalizados se comprueba en el caso de uso con `findOwned` (404 si no existe, 403 si es de otro usuario); no usa `Authorizer` ni registra una `Policy` en `Authorization`.
- La asignación a un nanobook valida la referencia (`GetAssignableTheme`: el oficial debe existir, el personalizado debe pertenecer al usuario) y delega la escritura en `NanobookModule.setNanobookTheme`; la autorización de escritura del nanobook es responsabilidad de `nanobooks` (el controlador traduce `AccessDeniedError` / `AccessCheckFailedError` con `accessErrorResponse`).
- Los tokens se validan contra listas cerradas; no se acepta CSS libre. `ResolveTheme` no reaplica comprobación de propiedad al renderizar (`findById`), por lo que un nanobook público muestra el tema personalizado asignado.

## Pruebas
Junto al código que verifican (dominio, `application/`, `infraestructure/rest`, `infraestructure/repository`, `shared/`, `browser/`). Ejecutar con `npx vitest run src/theme` (incluye `themeStyles.test.ts` sobre el contrato CSS, `ThemeEditorController.test.ts`, `ThemeNavigationController.test.ts`, `DrizzleThemeRepository.test.ts` y presets/contraste). `npm test` ejecuta además la configuración de Astro (`vitest.astro.config.ts`).

## Decisiones y límites conocidos
- Comportamiento: un tema personalizado ausente cae a `monocromo` (`ResolveTheme` y `OfficialThemeCatalog.get`); la tabla es `theme`. Pendiente: `AssignNanobookThemeController` conserva `console.log` de depuración. Sin borrado de temas, historial ni recursos de imagen.
