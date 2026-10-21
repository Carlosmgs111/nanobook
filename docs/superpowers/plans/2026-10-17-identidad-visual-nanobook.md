# Nanobook Visual Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the official Nanobook theme and its customization editor with the Landing page’s book-cover identity through safe visual presets and semantic CSS variables.

**Architecture:** Extend the existing theme token contract and resolve presets into mode-specific CSS variables. Migrate Nanobook shell, navigation, and Markdown styles to those variables, then expose the presets and representative components in the local theme preview. Older custom themes inherit their base catalog values.

**Tech Stack:** Astro, TypeScript, CSS custom properties, Vitest, Astro production build.

**Spec:** `docs/superpowers/specs/2026-10-17-identidad-visual-nanobook.md`

## Global Constraints

- Keep palette colors as six-digit hex values.
- Keep user-provided theme values to validated enums; do not accept arbitrary CSS.
- Preserve old custom theme behavior by falling back to the selected official base theme.
- Run `npm run build` before any commit.
- Update `CHANGELOG.md` under `[Unreleased]`.

## Review Focus

- Missing new presets in persisted themes: resolve from official base catalog.
- Invalid enum values in API payloads: reject through existing validation.
- Light and dark theme output: resolve readable decorative colors independently per mode.
- Editor preview: update only the local preview and persist the same presets shown there.
- Decorative selectors on nested Markdown content: avoid duplicate marks and clipped/overlapping corners.

---

### Task 1: Extend and resolve safe identity presets

**Files:**
- Modify: `src/theme/server/domain/ThemeTokens.ts`
- Modify: `src/theme/server/application/dto/ThemeDtos.ts`
- Modify: `src/theme/browser/HttpThemeApi.ts`
- Modify: `src/theme/server/infraestructure/OfficialThemeCatalog.ts`
- Modify: `src/theme/server/application/ResolveTheme.ts`
- Test: `src/theme/server/domain/Theme.test.ts`
- Test: `src/theme/server/application/ResolveTheme.test.ts`
- Test: `src/theme/server/infraestructure/rest/ThemeControllers.test.ts`

**Interfaces:**
- Consumes: existing `ThemeTokens`, official light/dark definitions, `ResolveTheme.execute()`.
- Produces: `shape.cover: "book" | "square" | "rounded"`; `decoration.corners: "none" | "cross" | "line"`; `decoration.shadow: "flat" | "offset" | "soft"`; existing `decoration.pattern` stays `"none" | "grid" | "hatch"`.
- Resolves CSS values for both modes: `cover-radius`, `cover-spine-width`, `decoration-corner-image`, `decoration-hatch-image`, and `decoration-shadow`.

- [ ] Add failing domain tests accepting the new enums and rejecting unknown values in `Theme.test.ts`.
- [ ] Run `npm test -- src/theme/server/domain/Theme.test.ts` and verify the new cases fail.
- [ ] Add failing resolution tests for official Nanobook defaults (`book`, `line`, `offset`, subtle diagonal hatch), Classic defaults, and a legacy custom theme inheriting its base values in `ResolveTheme.test.ts`.
- [ ] Run `npm test -- src/theme/server/application/ResolveTheme.test.ts` and verify the new assertions fail.
- [ ] Extend the DTO parser/serializer and API DTO types with the exact enum fields; add a controller test rejecting invalid values.
- [ ] Implement catalog presets and safe light/dark CSS variable resolution in `OfficialThemeCatalog.ts` and `ResolveTheme.ts`.
- [ ] Run `npm test -- src/theme/server/domain/Theme.test.ts src/theme/server/application/ResolveTheme.test.ts src/theme/server/infraestructure/rest/ThemeControllers.test.ts`; expect all pass.

### Task 2: Move Nanobook components onto the semantic identity variables

**Files:**
- Modify: `src/theme/browser/styles/contract.css`
- Modify: `src/shared/styles/utilities.css`
- Modify: `src/shared/styles/components/hatch.css`
- Modify: `src/shared/styles/components/index-card.css`
- Modify: `src/shared/styles/prose.css`
- Modify: `src/layouts/components/LayoutShell.astro`
- Modify: `src/layouts/components/Header.astro`
- Modify: `src/documents/browser/ui/components/TableOfContents/TocNav.astro`
- Modify: `src/auth/browser/ui/AuthForm.astro`
- Modify: `src/toast/browser/ToastHost.astro`
- Modify: `src/pages/verify-email.astro`
- Test: `src/theme/browser/styles/themeStyles.test.ts`

**Interfaces:**
- Consumes: semantic mode variables emitted by Task 1 and the active `data-color-mode` selector.
- Produces: corner, diagonal pattern, cover edge/spine, and elevation styles in shared CSS, with no component-specific competing visual constants.

- [ ] Add failing style-contract assertions that utility corners, hatch surfaces, index cards, Markdown dividers/tables, and shell panels consume semantic variables.
- [ ] Run `npm test -- src/theme/browser/styles/themeStyles.test.ts` and verify the new assertions fail.
- [ ] Refactor shared corner selectors to use one semantic corner-mark variable and preserve nested-Markdown suppression.
- [ ] Refactor hatch, index-card, document shell, navigation, forms, menu, TOC, and toast styles to consume theme variables for pattern, cover geometry, border, and shadow.
- [ ] Keep pattern and corner decorations absent when their resolved preset is `none`; verify both light and dark contracts.
- [ ] Run `npm test -- src/theme/browser/styles/themeStyles.test.ts` and expect all pass.

### Task 3: Expose presets and preview them in the theme editor

**Files:**
- Modify: `src/theme/browser/ui/ThemeEditor.astro`
- Modify: `src/theme/browser/ThemeEditorController.ts`
- Test: `src/theme/browser/ThemeEditorController.test.ts`
- Test: `src/theme/browser/HttpThemeApi.test.ts`

**Interfaces:**
- Consumes: Task 1 DTO fields and semantic variable names.
- Produces: editor controls for cover geometry, corner marks, and elevation; preview samples for cover/spine, diagonal hatch, corners, and Markdown.

- [ ] Add failing controller tests that choosing `shape.cover`, `decoration.corners`, and `decoration.shadow` updates only preview variables and that submit includes them in the API payload.
- [ ] Run `npm test -- src/theme/browser/ThemeEditorController.test.ts` and verify the new assertions fail.
- [ ] Add the new enum controls and representative preview samples to `ThemeEditor.astro`, selecting values from existing theme tokens or Nanobook defaults.
- [ ] Implement preview-variable mapping for the new presets in `ThemeEditorController.ts` and update the DTO request fixture test.
- [ ] Run `npm test -- src/theme/browser/ThemeEditorController.test.ts src/theme/browser/HttpThemeApi.test.ts`; expect all pass.

### Task 4: Document the release note and verify the integrated theme

**Files:**
- Modify: `CHANGELOG.md`
- Test: `src/theme/browser/styles/themeStyles.test.ts`
- Test: existing focused theme test files from Tasks 1–3

- [ ] Add an `[Unreleased]` entry describing the Nanobook visual presets and component migration.
- [ ] Run `npm test -- src/theme/server/domain/Theme.test.ts src/theme/server/application/ResolveTheme.test.ts src/theme/server/infraestructure/rest/ThemeControllers.test.ts src/theme/browser/ThemeEditorController.test.ts src/theme/browser/HttpThemeApi.test.ts src/theme/browser/styles/themeStyles.test.ts`; expect all pass.
- [ ] Run `npm run build`; expect Astro production build to complete successfully.
