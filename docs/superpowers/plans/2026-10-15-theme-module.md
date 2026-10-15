# Módulo de temas visuales reutilizables — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear un módulo autónomo que aplique temas oficiales, permita guardar personalizaciones estructuradas y reutilizables, y las asigne a nanobooks sin dependencias directas entre módulos de negocio.

**Architecture:** `theme` resuelve, valida, persiste y presenta temas mediante capacidades públicas compuestas en `ThemeModule`. Los componentes consumen propiedades CSS semánticas; `application/server` coordina la asignación de un tema a un nanobook usando capacidades de `theme` y `nanobooks`, sin que esos módulos se importen entre sí.

**Tech Stack:** Astro 7, TypeScript, CSS Custom Properties, Drizzle ORM, SQLite/libSQL, Zod ya instalado y Vitest.

**Spec:** `docs/superpowers/specs/2026-10-15-theme-module-design.md`

## Global Constraints

- Node.js `>=22.12.0`; mantener las dependencias actuales y no añadir una librería de theming.
- Seguir Semantic Versioning y Conventional Commits; ejecutar `npm run build` antes de cada commit.
- Registrar cambios sin versión en `CHANGELOG.md`.
- Organizar primero por módulo y después por entorno; servidor con `domain`, `application`, infraestructura e `index.ts` solo cuando exista comportamiento real para cada capa.
- `theme` no importa código de `auth`, `nanobooks`, `documents`, `profiles`, `navigation` ni `publishing`; solo puede depender de `shared`.
- La raíz `application/server` es la única que coordina capacidades de dos módulos de negocio.
- No aceptar ni almacenar CSS, HTML, JavaScript, URLs de recursos o nombres de fuentes arbitrarios.
- No implementar eliminación, revisiones, borradores, marketplace, carga de assets ni temas por documento.
- Los nanobooks existentes sin selección conservan `classic`; los nanobooks nuevos seleccionan `nanobook`.
- Cada tarea introduce únicamente contratos exigidos por su capacidad ejecutable; no crear puertos, eventos o entidades para trabajo futuro.

## Review Focus

1. Tema personalizado ajeno: no puede listarse, editarse ni asignarse, pero un nanobook público que ya lo referencia debe poder renderizar sus valores sin revelar propietario o nombre.
2. JSON desconocido, color inválido o intento de CSS: rechazar la escritura completa y no emitir ninguna parte del valor recibido.
3. Referencia inexistente o fila corrupta: renderizar `classic` completo; nunca una mezcla parcial ni una excepción visible al lector.
4. Navegación con `ClientRouter`: actualizar `data-theme`, `data-color-mode` y las variables inline sin conservar valores del nanobook anterior.
5. Compatibilidad visual: antes de activar `nanobook`, `classic` debe conservar la apariencia actual en layouts, contenido, navegación, formularios, editor y toasts.

---

### Task 1: Aplicar temas oficiales desde SSR

**Files:**
- Create: `src/theme/server/infraestructure/OfficialThemeCatalog.ts`
- Create: `src/theme/server/application/ResolveTheme.ts`
- Create: `src/theme/server/application/ResolveTheme.test.ts`
- Create: `src/theme/server/index.ts`
- Create: `src/theme/browser/styles/contract.css`
- Create: `src/theme/browser/styles/classic.css`
- Create: `src/theme/browser/styles/nanobook.css`
- Create: `src/theme/browser/styles/themeStyles.test.ts`
- Modify: `src/shared/styles/global.css`
- Delete: `src/shared/styles/theme.css`
- Modify: `src/layouts/Layout.astro`
- Modify: `src/layouts/LandingLayout.astro`
- Modify: `src/application/server/Application.ts`

**Interfaces:**
- Consumes: ninguna capacidad de otro módulo; solo valores constantes del propio módulo.
- Produces: `ResolveTheme.execute({ kind: "official", id }): Promise<AppliedTheme>` y `AppliedTheme { key, baseId, lightVariables, darkVariables }`; `ThemeModule.resolveTheme`.

- [ ] **Step 1: Write the failing resolver tests**

```ts
describe("ResolveTheme", () => {
  it("resolves the complete classic theme", async () => {
    const result = await new ResolveTheme(new OfficialThemeCatalog()).execute(
      { kind: "official", id: "classic" },
    );
    expect(result).toMatchObject({ key: "official:classic", baseId: "classic" });
    expect(result.darkVariables["--theme-dark-page-bg"]).toBe("#050505");
  });

  it("falls back to classic for an unknown official id", async () => {
    const result = await new ResolveTheme(new OfficialThemeCatalog()).execute(
      { kind: "official", id: "missing" },
    );
    expect(result.key).toBe("official:classic");
  });
});
```

- [ ] **Step 2: Run the resolver test and verify RED**

Run: `npm test -- src/theme/server/application/ResolveTheme.test.ts`

Expected: FAIL because `ResolveTheme` and `OfficialThemeCatalog` do not exist.

- [ ] **Step 3: Implement the smallest official catalog and resolver**

Keep the accepted IDs inside `OfficialThemeCatalog`; do not create a domain entity or repository yet. The resolver must return a complete map for `classic` and `nanobook`, with light and dark palettes, typography preset, radius, density and decoration preset. Unknown input returns a complete `classic` result.

```ts
export type OfficialThemeId = "classic" | "nanobook";
export type ColorMode = "light" | "dark";
export type ThemeReference = { kind: "official"; id: string };

export interface AppliedTheme {
  key: string;
  baseId: OfficialThemeId;
  lightVariables: Readonly<Record<`--theme-light-${string}`, string>>;
  darkVariables: Readonly<Record<`--theme-dark-${string}`, string>>;
}
```

- [ ] **Step 4: Add the CSS contract and official selectors**

`contract.css` defines semantic fallbacks and compatibility aliases. Existing components must continue rendering through aliases during the migration:

```css
:root {
  --theme-page-bg: var(--theme-light-page-bg);
  --theme-surface-bg: var(--theme-light-surface-bg);
  --theme-text: var(--theme-light-text);
  --theme-text-muted: var(--theme-light-text-muted);
  --theme-accent: var(--theme-light-accent);
  --theme-border: var(--theme-light-border);
  --theme-border-subtle: var(--theme-light-border-subtle);
  --theme-danger: #ef4444;
  --theme-font-body: system-ui, sans-serif;
  --theme-font-heading: var(--theme-font-body);
  --theme-font-code: ui-monospace, monospace;
  --theme-control-radius: 0;
  --theme-panel-radius: 0;
  --theme-content-gap: 1.5rem;
  --theme-page-pattern: none;

  --bg: var(--theme-page-bg);
  --text: var(--theme-text);
  --muted: var(--theme-text-muted);
  --accent: var(--theme-accent);
  --grid-line: var(--theme-border-subtle);
  --grid-line-strong: var(--theme-border);
}

:root[data-color-mode="dark"] {
  --theme-page-bg: var(--theme-dark-page-bg);
  --theme-surface-bg: var(--theme-dark-surface-bg);
  --theme-text: var(--theme-dark-text);
  --theme-text-muted: var(--theme-dark-text-muted);
  --theme-accent: var(--theme-dark-accent);
  --theme-border: var(--theme-dark-border);
  --theme-border-subtle: var(--theme-dark-border-subtle);
}

@media (prefers-color-scheme: dark) {
  :root[data-color-mode="system"] {
    --theme-page-bg: var(--theme-dark-page-bg);
    --theme-surface-bg: var(--theme-dark-surface-bg);
    --theme-text: var(--theme-dark-text);
    --theme-text-muted: var(--theme-dark-text-muted);
    --theme-accent: var(--theme-dark-accent);
    --theme-border: var(--theme-dark-border);
    --theme-border-subtle: var(--theme-dark-border-subtle);
  }
}
```

Import `contract.css`, `classic.css` and `nanobook.css` from `global.css`. Move the existing values from `src/shared/styles/theme.css` into `classic.css`; make `nanobook.css` reproduce the landing language without copying layout-specific rules.

- [ ] **Step 5: Make layouts apply an `AppliedTheme`**

`Layout.astro` defaults to resolved `classic`; `LandingLayout.astro` receives resolved `nanobook`. Both render these values in the initial HTML:

```astro
<html
  lang="es"
  data-theme={theme.baseId}
  data-theme-key={theme.key}
  data-color-mode={colorModePreference}
  style={[...Object.entries(theme.lightVariables), ...Object.entries(theme.darkVariables)]
    .map(([key, value]) => `${key}:${value}`)
    .join(";")}
>
```

Have `Application` compose `ThemeModule` and expose it. Pages and layouts may consume the public capability through application composition; no business module imports `theme`.

- [ ] **Step 6: Add source-level theme application tests**

Assert that both official selectors implement every variable declared in the contract, and that both layouts render `data-theme`, `data-color-mode` and the resolved variable map. This test protects a complete fallback rather than the textual order of declarations.

- [ ] **Step 7: Verify and commit the technical slice**

Run:

```powershell
npm test -- src/theme
npm run build
git diff --check
```

Commit: `feat(theme): aplicar temas oficiales desde SSR`

### Task 2: Migrar la base visual y controles compartidos al contrato semántico

**Files:**
- Modify: `src/shared/styles/base.css`
- Modify: `src/shared/styles/prose.css`
- Modify: `src/shared/styles/utilities.css`
- Modify: `src/shared/styles/components/hatch.css`
- Modify: `src/shared/styles/components/index-card.css`
- Modify: `src/layouts/components/LayoutShell.astro`
- Modify: `src/layouts/components/Header.astro`
- Modify: `src/layouts/components/Footer.astro`
- Modify: `src/layouts/components/DocumentControls.astro`
- Modify: `src/layouts/components/ContentWidthToggle.astro`
- Modify: `src/layouts/components/StateRestoreScripts.astro`
- Rename: `src/theme/browser/components/ThemeToggle.astro` to `src/theme/browser/components/ColorModeToggle.astro`
- Test: `src/theme/browser/styles/themeStyles.test.ts`

**Interfaces:**
- Consumes: variables `--theme-*` de Task 1.
- Produces: layouts y primitivas compartidas sin referencias a las variables visuales heredadas.

- [ ] **Step 1: Extend the style test with the legacy-token failure**

Scan only the files listed in this task and fail on `var(--bg)`, `var(--text)`, `var(--muted)`, `var(--accent)` and `var(--grid-line*)`. Also verify that `.light` is no longer used as the source de verdad del modo.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/theme/browser/styles/themeStyles.test.ts`

Expected: FAIL listing the current legacy references.

- [ ] **Step 3: Replace visual decisions with semantic tokens**

Use this mapping consistently:

```text
--bg                 -> --theme-page-bg
--text               -> --theme-text
--muted              -> --theme-text-muted
--accent             -> --theme-accent
--grid-line          -> --theme-border-subtle
--grid-line-strong   -> --theme-border
hardcoded red states -> --theme-danger
font-family          -> --theme-font-body / heading / code
border-radius        -> --theme-control-radius / panel-radius
grid decoration      -> --theme-page-pattern
```

Do not replace structural properties such as `display`, grid columns, positioning or responsive breakpoints with tokens.

- [ ] **Step 4: Move color mode from classes/localStorage to an attribute and cookie**

`ColorModeToggle.astro` writes `nanobook-color-mode=light|dark|system; Path=/; SameSite=Lax` and updates `data-color-mode`. Rename the component because it changes illumination, not the selected visual theme, and update `DocumentControls.astro`. The server reads the cookie and defaults to `system`; CSS, no JavaScript, elige la paleta mediante `prefers-color-scheme`. `StateRestoreScripts.astro` must not overwrite the server value with stale `localStorage`. Preserve one-time migration from the existing `theme` localStorage key, then remove that key.

- [ ] **Step 5: Verify classic compatibility and build**

Run:

```powershell
npm test -- src/theme
npm run build
git diff --check
```

Manually compare `/profile`, `/nanobooks` and one document under `data-theme="classic"` before committing.

Commit: `refactor(theme): migrar estilos compartidos al contrato semantico`

### Task 3: Migrar componentes de negocio sin cambiar su estructura

**Files:**
- Modify: `src/auth/browser/ui/AuthForm.astro`
- Modify: `src/profiles/browser/ui/ProfileForm.astro`
- Modify: `src/profiles/browser/ui/ProfilePage.astro`
- Modify: `src/nanobooks/browser/ui/NanobookCard.astro`
- Modify: `src/nanobooks/browser/ui/NanobooksPage.astro`
- Modify: `src/documents/browser/ui/components/DocumentEditor.astro`
- Modify: `src/documents/browser/ui/components/EditorStatus.astro`
- Modify: `src/documents/browser/ui/components/EditorToolbar.astro`
- Modify: `src/documents/browser/ui/components/TableOfContents/TocIndicator.astro`
- Modify: `src/documents/browser/ui/components/TableOfContents/TocNav.astro`
- Modify: `src/documents/browser/ui/components/TableOfContents/TocToggle.astro`
- Modify: `src/documents/browser/ui/pages/DocumentPage.astro`
- Modify: `src/documents/browser/ui/pages/EditPage.astro`
- Modify: `src/documents/browser/ui/pages/NewPage.astro`
- Modify: `src/navigation/browser/ui/components/Breadcrumb.astro`
- Modify: `src/navigation/browser/ui/components/IndexList/DocumentIndex.astro`
- Modify: `src/navigation/browser/ui/components/IndexList/index.astro`
- Modify: `src/navigation/browser/ui/components/SidebarNav/CloseSidebar.astro`
- Modify: `src/navigation/browser/ui/components/SidebarNav/index.astro`
- Modify: `src/navigation/browser/ui/components/SidebarNav/OpenSidebar.astro`
- Modify: `src/navigation/browser/ui/components/SidebarNav/SidebarHeader.astro`
- Modify: `src/navigation/browser/ui/components/SidebarNav/SidebarList.astro`
- Modify: `src/navigation/browser/ui/components/SidebarNav/SidebarModeToggle.astro`
- Modify: `src/navigation/browser/ui/components/SidebarNav/ToolTip.astro`
- Modify: `src/toast/browser/ToastHost.astro`
- Modify: `src/pages/verify-email.astro`
- Test: `src/theme/browser/styles/themeStyles.test.ts`

**Interfaces:**
- Consumes: contrato semántico estabilizado por Tasks 1–2.
- Produces: componentes actuales compatibles con ambos temas oficiales.

- [ ] **Step 1: Extend the migration test to the listed presentation files**

The test must reject legacy theme variables and visual literals that duplicate a contract value. Keep syntax-highlight colors, document content colors and transparent values outside this prohibition unless they are part of application chrome.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/theme/browser/styles/themeStyles.test.ts`

- [ ] **Step 3: Migrate one module at a time without changing markup responsibilities**

Apply the Task 2 mapping to auth/profile/nanobooks, then documents, navigation and toast. Add a new semantic token only when at least one real difference exists between `classic` and `nanobook`; add it to contract and both official themes in the same change.

- [ ] **Step 4: Remove the compatibility aliases**

After the scan passes, delete the old `--bg`, `--text`, `--muted`, `--accent` and `--grid-line*` aliases from `contract.css`. A build failure at this point indicates a missed consumer and must be fixed in its owning component.

- [ ] **Step 5: Verify both official themes and commit**

Run:

```powershell
npm test -- src/theme src/auth/browser src/profiles/browser src/nanobooks/browser src/documents/browser src/navigation/browser
npm run build
git diff --check
```

Commit: `refactor(theme): adaptar componentes a temas oficiales`

### Task 4: Persistir una personalización válida dentro de `theme`

**Files:**
- Create: `src/theme/server/domain/Theme.ts`
- Create: `src/theme/server/domain/Theme.test.ts`
- Create: `src/theme/server/domain/ThemeTokens.ts`
- Create: `src/theme/server/domain/errors.ts`
- Create: `src/theme/server/domain/ports/ThemeRepository.ts`
- Create: `src/theme/server/infraestructure/database/DrizzleThemeSchema.ts`
- Create: `src/theme/server/infraestructure/repository/DrizzleThemeRepository.ts`
- Create: `src/theme/server/infraestructure/repository/DrizzleThemeRepository.test.ts`
- Create: `src/theme/server/infraestructure/repository/InMemoryThemeRepository.ts`
- Create: generated migration `drizzle/0009_custom_themes.sql`
- Modify: `src/theme/server/application/ResolveTheme.ts`
- Modify: `src/theme/server/application/ResolveTheme.test.ts`

**Interfaces:**
- Consumes: IDs oficiales y tokens realmente usados por Tasks 1–3.
- Produces: entidad `Theme`, puerto privado `ThemeRepository` y resolución de una definición personalizada persistida.

- [ ] **Step 1: Write failing domain tests for the behaviors now required**

```ts
it("creates a reusable theme from validated overrides", () => {
  const result = Theme.create({
    id: "theme-1",
    ownerId: "owner-1",
    name: "Editorial",
    baseThemeId: "nanobook",
    tokens: {
      light: { accent: "#3159d8" },
      dark: { accent: "#8ca7ff" },
      typography: { family: "editorial-serif" },
      shape: { radius: "soft" },
      layout: { density: "relaxed" },
      decoration: { pattern: "none" },
    },
  });
  expect(result.isSuccess).toBe(true);
});

it.each([
  { light: { accent: "red;display:none" } },
  { typography: { family: "url(https://example.com/font)" } },
  { unknown: "value" },
])("rejects unsafe or unknown tokens", (tokens) => {
  expect(Theme.create(validTheme({ tokens })).isSuccess).toBe(false);
});
```

- [ ] **Step 2: Run the domain test and verify RED**

Run: `npm test -- src/theme/server/domain/Theme.test.ts`

- [ ] **Step 3: Model only persisted invariants**

Implement `Theme` with trimmed non-empty `id`, `ownerId` and `name` (maximum 80 characters), base `classic|nanobook`, strict token keys, `#rrggbb` colors and closed presets. Add `rename` or `updateTokens` only if the update use case in Task 5 needs it; otherwise recreate through a validated factory as current modules do.

- [ ] **Step 4: Write repository tests before the adapter**

Cover create/find/list/update, owner isolation at query input, JSON round-trip, duplicate ID and corrupt `tokens_json`. A corrupt row returns `ThemeRepositoryError`; it must not materialize a partial theme.

- [ ] **Step 5: Add the table without importing another module's schema**

```sql
CREATE TABLE `theme` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `name` text NOT NULL,
  `base_theme_id` text NOT NULL,
  `tokens_json` text NOT NULL DEFAULT '{}',
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE INDEX `theme_owner_idx` ON `theme` (`owner_id`);
```

Generate through the existing Drizzle workflow and inspect the SQL. Do not import the Better Auth user schema or nanobook schema into `DrizzleThemeSchema.ts`.

- [ ] **Step 6: Implement the repository and custom resolution**

Extend `ResolveTheme` by injecting `ThemeRepository`. For `{ kind: "custom", id }`, load the definition, overlay validated tokens on its official base and return only CSS variables. A missing/corrupt custom theme returns the complete `classic` result; repository infrastructure errors remain distinguishable for management operations.

- [ ] **Step 7: Verify persistence and commit**

Run:

```powershell
npm test -- src/theme/server/domain src/theme/server/infraestructure/repository src/theme/server/application/ResolveTheme.test.ts
npm run build
git diff --check
```

Commit: `feat(theme): persistir temas personalizados`

### Task 5: Exponer capacidades de gestión sin filtrar infraestructura

**Files:**
- Create: `src/theme/server/application/CreateTheme.ts`
- Create: `src/theme/server/application/UpdateTheme.ts`
- Create: `src/theme/server/application/ListThemes.ts`
- Create: `src/theme/server/application/GetTheme.ts`
- Create: `src/theme/server/application/GetAssignableTheme.ts`
- Create: `src/theme/server/application/dto/ThemeDtos.ts`
- Create: `src/theme/server/application/ThemeManagement.test.ts`
- Create: `src/theme/server/infraestructure/rest/ThemeCollectionController.ts`
- Create: `src/theme/server/infraestructure/rest/ThemeItemController.ts`
- Create: `src/theme/server/infraestructure/rest/ThemeControllers.test.ts`
- Create: `src/pages/api/themes/index.ts`
- Create: `src/pages/api/themes/[themeId].ts`
- Modify: `src/theme/server/index.ts`
- Modify: `src/application/server/Application.ts`

**Interfaces:**
- Consumes: `ThemeRepository` privado de Task 4 y `RouteProtector` transversal inyectado en el compositor.
- Produces: `createTheme`, `updateTheme`, `listThemes`, `getTheme`, `getAssignableTheme`, `resolveTheme` y rutas HTTP protegidas; no expone repositorio, entidad Drizzle ni schema.

- [ ] **Step 1: Write application tests for ownership and safe DTOs**

Test that creation generates the ID on the server; listing returns official choices plus only the caller's custom themes; `GetTheme` returns editable tokens only to its owner; update rejects another owner; `GetAssignableTheme` accepts both official themes, accepts a custom theme owned by the caller and rejects another user's theme.

The HTTP/application DTO is limited to:

```ts
interface ThemePaletteDto {
  pageBackground?: string;
  surfaceBackground?: string;
  text?: string;
  textMuted?: string;
  accent?: string;
  border?: string;
}

interface ThemeTokensDto {
  light?: ThemePaletteDto;
  dark?: ThemePaletteDto;
  typography?: { family?: "system-sans" | "editorial-serif" | "mono" };
  shape?: { radius?: "square" | "soft" | "rounded" };
  layout?: { density?: "compact" | "comfortable" | "relaxed" };
  decoration?: { pattern?: "none" | "grid" | "hatch" };
}

interface ThemeSummary {
  reference: { kind: "official" | "custom"; id: string };
  name: string;
  baseThemeId: "classic" | "nanobook";
  editable: boolean;
}

interface ThemeDetails extends ThemeSummary {
  tokens: ThemeTokensDto;
}
```

- [ ] **Step 2: Run application tests and verify RED**

Run: `npm test -- src/theme/server/application/ThemeManagement.test.ts`

- [ ] **Step 3: Implement the five use cases**

Use `crypto.randomUUID()` in `CreateTheme`. Pass `userId` explicitly to every management operation. Keep input parsing strict; `UpdateTheme` accepts only `name` and `tokens`, and preserves ID, owner, base theme and creation date.

- [ ] **Step 4: Write controller tests and verify RED**

Cover unauthenticated 401, invalid JSON 400, invalid token 400, foreign theme 403, missing theme 404 and repository failure 500 without returning internal causes.

- [ ] **Step 5: Compose routes inside `ThemeModule`**

`ThemeModule.create(routeProtector)` creates its repository and cases internally, then exposes ready-to-use handlers. `GET /api/themes/:themeId` delegates to `GetTheme` and never returns details for another owner. `src/pages/api/themes/*` only delegates to those handlers through `getApp()`.

```ts
export class ThemeModule {
  private constructor(
    public readonly resolveTheme: ResolveTheme,
    public readonly getAssignableTheme: GetAssignableTheme,
    public readonly listThemes: ListThemes,
    public readonly getTheme: GetTheme,
    public readonly collectionRoutes: { GET: APIRoute; POST: APIRoute },
    public readonly itemRoutes: { GET: APIRoute; PATCH: APIRoute },
  ) {}
}
```

- [ ] **Step 6: Verify routes and commit**

Run:

```powershell
npm test -- src/theme/server
npm run build
git diff --check
```

Commit: `feat(theme): exponer gestion de temas personalizados`

### Task 6: Crear el editor reutilizable con previsualización local

**Files:**
- Create: `src/theme/browser/HttpThemeApi.ts`
- Create: `src/theme/browser/HttpThemeApi.test.ts`
- Create: `src/theme/browser/ThemeEditorController.ts`
- Create: `src/theme/browser/ThemeEditorController.test.ts`
- Create: `src/theme/browser/ThemeEditorController.astro`
- Create: `src/theme/browser/ui/ThemeEditor.astro`
- Create: `src/theme/browser/ui/ThemesPage.astro`
- Create: `src/pages/themes.astro`
- Modify: `src/layouts/components/Header.astro`

**Interfaces:**
- Consumes: HTTP `GET/POST /api/themes`, `GET/PATCH /api/themes/:themeId` y DTOs públicos de Task 5.
- Produces: biblioteca y editor de temas propios; ninguna API del navegador importa servidor o repositorios.

- [ ] **Step 1: Write failing HTTP adapter tests**

Test exact methods, JSON bodies, URL encoding and extraction of API error messages for list/get/create/update. The browser adapter defines its own transport DTOs and does not import `theme/server`.

- [ ] **Step 2: Implement `HttpThemeApi` and verify GREEN**

Run: `npm test -- src/theme/browser/HttpThemeApi.test.ts`

- [ ] **Step 3: Write failing editor controller tests**

Cover control changes updating only the preview root, toggling light/dark preview, rejecting an empty name before HTTP, disabling duplicate submits, showing server errors and remounting safely after `astro:page-load`.

- [ ] **Step 4: Implement local preview with the same closed mappings**

The form exposes color inputs and selects for the supported presets. `ThemeEditorController` maps those controls to the corresponding `--theme-*` properties on `[data-theme-preview]`; it never accepts a free-form CSS field. Saving sends structured tokens to `HttpThemeApi`.

- [ ] **Step 5: Render the authenticated page**

`/themes` checks the session, calls `app.themeModule.listThemes.execute(session.id)` and passes plain summaries to `ThemesPage`. Add a header link visible for authenticated users.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
npm test -- src/theme/browser src/theme/server
npm run build
git diff --check
```

Commit: `feat(theme): agregar editor de temas reutilizables`

### Task 7: Asignar temas a nanobooks mediante composición

**Files:**
- Create: `src/shared/theme/ThemeReference.ts`
- Create: `src/nanobooks/server/application/SetNanobookTheme.ts`
- Create: `src/nanobooks/server/application/SetNanobookTheme.test.ts`
- Create: `src/application/server/AssignNanobookTheme.ts`
- Create: `src/application/server/AssignNanobookTheme.test.ts`
- Create: `src/application/server/AssignNanobookThemeController.ts`
- Create: `src/pages/api/nanobooks/[nanobookId]/theme.ts`
- Modify: `src/nanobooks/server/domain/types.ts`
- Modify: `src/nanobooks/server/domain/Nanobook.ts`
- Modify: `src/nanobooks/server/domain/Nanobook.test.ts`
- Modify: `src/nanobooks/server/application/CreateNanobook.ts`
- Modify: `src/nanobooks/server/index.ts`
- Modify: `src/application/server/Application.ts`
- Modify: `src/pages/nanobooks.astro`
- Modify: `src/nanobooks/browser/ui/NanobookCard.astro`
- Modify: `src/nanobooks/browser/nanobookCards.ts`

**Interfaces:**
- Consumes: `ThemeModule.getAssignableTheme`, `NanobookModule.setNanobookTheme` y una única referencia transversal creada porque ambos módulos ya necesitan intercambiarla.
- Produces: `POST /api/nanobooks/:nanobookId/theme` y persistencia de la selección en `NanobookSettings`.

- [ ] **Step 1: Introduce the minimal cross-module value**

```ts
export type ThemeReference =
  | { kind: "official"; id: "classic" | "nanobook" }
  | { kind: "custom"; id: string };
```

Move the equivalent internal transport shape to this file only now. It contains no behavior, Astro or I/O.

- [ ] **Step 2: Write failing nanobook tests**

Test that existing `{}` settings remain valid and resolve conceptually to `classic`; new nanobooks receive `{ theme: { kind: "official", id: "nanobook" } }`; `SetNanobookTheme` requires ownership, preserves all other fields/content version and stores only a valid reference shape.

- [ ] **Step 3: Implement the nanobook capability without importing `theme`**

`SetNanobookTheme` accepts the shared value and persists it. It does not check whether a custom ID exists; that responsibility belongs to the composition in the next step. Expose the use case from `NanobookModule`, not its repository.

- [ ] **Step 4: Write the cross-module orchestration tests**

Use structural fakes:

```ts
const themes = { execute: vi.fn() };
const nanobooks = { execute: vi.fn() };
const assign = new AssignNanobookTheme(themes, nanobooks);
```

Assert that an unassignable theme never reaches `SetNanobookTheme`, and an accepted normalized reference is forwarded exactly once. The orchestrator lives in root `application/server`; neither module imports the other.

- [ ] **Step 5: Implement the endpoint and selector**

The controller reads `locals.currentUserId`, `nanobookId` and a strict `reference`, then calls the root capability. `/nanobooks` obtains `ThemeSummary[]` separately from `themeModule.listThemes` and passes plain options to the card. On success, the browser reloads the page; on failure it restores controls and shows the returned error.

- [ ] **Step 6: Verify assignment and commit**

Run:

```powershell
npm test -- src/shared/theme src/nanobooks/server src/application/server/AssignNanobookTheme.test.ts
npm run build
git diff --check
```

Commit: `feat(nanobooks): permitir asignar temas guardados`

### Task 8: Resolver y aplicar el tema efectivo de cada nanobook

**Files:**
- Modify: `src/application/server/Application.ts`
- Modify: `src/application/server/resolveNanobookRoute.ts`
- Modify: `src/documents/browser/ui/pages/DocumentPage.astro`
- Modify: `src/documents/browser/ui/pages/EditPage.astro`
- Modify: `src/documents/browser/ui/pages/NewPage.astro`
- Modify: `src/documents/browser/ui/pages/PreviewPage.astro`
- Modify: `src/layouts/Layout.astro`
- Modify: `src/layouts/components/StateRestoreScripts.astro`
- Create: `src/theme/browser/ThemeNavigationController.test.ts`
- Modify: `src/theme/browser/components/ColorModeToggle.astro`
- Modify: `CHANGELOG.md`
- Create: `src/content/nanobook-project/arquitectura/modulo-de-temas.md`

**Interfaces:**
- Consumes: referencia de `NanobookSettings`, `ThemeModule.resolveTheme` y preferencia de modo desde cookie.
- Produces: `NanobookCapabilities.theme` aplicado en lectura, edición, creación y preview; navegación cliente sin residuos del tema anterior.

- [ ] **Step 1: Write failing effective-theme tests**

Cover existing nanobook without reference -> `classic`; new official reference -> corresponding official theme; owned custom reference -> custom variables; missing/corrupt custom -> complete `classic`; invalid color-mode cookie -> `system`.

- [ ] **Step 2: Add theme resolution to request-scoped composition**

`Application.createNanobookCapabilities(nanobook, request)` calls `themeModule.resolveTheme.execute(nanobook.getSettings().theme, request)` and returns the resolved `AppliedTheme` alongside navigation and publishing. It does not cache a theme per process or import theme internals into `nanobooks`.

- [ ] **Step 3: Pass the resolved theme through every nanobook page**

All four page components request the same request-scoped capabilities and pass `theme` to `Layout`. Remove any page-local theme choice. Platform pages resolve official `nanobook`; existing non-nanobook content retains explicit `classic` until intentionally migrated.

- [ ] **Step 4: Test and handle ClientRouter changes**

On `astro:after-swap`, ensure root attributes and inline custom variables equal the new document. Remove variables present on the previous custom theme but absent on the next one. `ThemeNavigationController.test.ts` must reproduce custom A -> official -> custom B navigation and assert no stale variable remains.

- [ ] **Step 5: Run full verification and document the decision**

Run:

```powershell
npm test -- src --maxWorkers=2
npm run build
git diff --check
```

Manually verify:

```text
/                         platform theme nanobook
/themes                   create and edit a saved theme
/nanobooks                assign official and custom themes
/n/<public-slug>           anonymous reader sees assigned theme
/n/<private-slug>          authorization remains unchanged
```

Update `[Unreleased]` with official themes, saved customization and assignment. Document module ownership, resolution order, safe fallback and deferred capabilities in `modulo-de-temas.md`.

- [ ] **Step 6: Commit the completed vertical flow**

Commit: `feat(theme): aplicar personalizaciones por nanobook`

## Acceptance gate

- `ThemeModule` composes its own repository, use cases and controllers and exposes only usable capabilities.
- No file under `src/theme/` imports another business module; verify with:

```powershell
rg -n 'from ".*(auth|nanobooks|documents|profiles|navigation|publishing)' src/theme
```

Expected: no matches.

- No module of business imports infrastructure or domain internals from `theme`; the only shared value used for integration is `src/shared/theme/ThemeReference.ts`.
- `classic` preserves the current UI; `nanobook` works across the same components.
- Saved values are strict data, never raw CSS, and are serialized only after domain validation.
- A personalized theme can be saved, edited, reused and applied to more than one nanobook.
- Public rendering does not require an authenticated theme request and does not expose owner metadata.
- Existing nanobooks remain on `classic`; newly created nanobooks start on `nanobook`.
- Focused tests, full `src` suite, build and `git diff --check` pass before declaring completion.
