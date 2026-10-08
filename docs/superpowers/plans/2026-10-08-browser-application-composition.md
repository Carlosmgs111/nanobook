# Browser Application Composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Componer los módulos de autenticación y edición del navegador mediante una única `Application` síncrona y hacer que todos los scripts cliente consuman esa composición.

**Architecture:** `src/browser/Application.ts` será el composition root del navegador. `Application.create()` construirá `AuthModule` y `EditionModule`, mientras `getApp()` conservará una instancia por contexto JavaScript; las páginas y componentes solo seleccionarán capacidades desde esa instancia. El servidor conservará su composición asíncrona independiente y `toast` seguirá siendo un adaptador global fuera de esta aplicación.

**Tech Stack:** TypeScript, Astro 7, Vitest, scripts cliente de Astro y documentación Markdown en `src/content/nanobook-project/`.

**Spec:** `docs/superpowers/specs/2026-10-08-browser-application-composition-design.md`

## Global Constraints

- `Application` se llamará exactamente `Application`; no se creará `BrowserApplication`.
- `Application.create()` y `getApp()` serán síncronos porque los adaptadores actuales se inicializan sin I/O asíncrono.
- `Application` solo compondrá `AuthModule` y `EditionModule`; no importará módulos de servidor ni variables de entorno de Astro.
- `getApp()` se invocará únicamente desde scripts o módulos ejecutados en el navegador.
- Se eliminarán los exports singleton `authModule` y `edition`; las fábricas `AuthModule.create()` y `EditionModule.create()` permanecerán disponibles para composición y pruebas.
- `toast` permanecerá fuera de `Application` en esta entrega.
- No se añadirán dependencias nuevas ni se cambiará el comportamiento de autenticación, edición o preview.
- Cada commit de implementación usará Conventional Commits y se hará después de `npm run build`.

## Review Focus

- Identidad singleton: dos llamadas a `getApp()` deben devolver el mismo objeto y no reconstruir módulos.
- Composición explícita: `Application.create()` debe invocar exactamente las fábricas de autenticación y edición y exponer sus resultados.
- Frontera SSR/cliente: ningún `.astro` debe invocar `getApp()` en frontmatter ni importar `server` desde un script cliente.
- Migración completa: no deben quedar imports de los exports eliminados `authModule` o `edition`.
- Integridad de módulos: eliminar los exports singleton no debe eliminar los tipos, eventos ni fábricas públicas que usan las pruebas y componentes.

---

### Task 1: Añadir la prueba de la composición Browser

**Files:**
- Create: `src/browser/Application.test.ts`

**Interfaces:**
- Consumes: `AuthModule.create(): AuthModule` desde `src/browser/auth/index.ts` y `EditionModule.create(): EditionModule` desde `src/browser/edition/index.ts`.
- Produces: expectativas ejecutables para `Application.create()` y `getApp()` que guiarán la implementación de `src/browser/Application.ts`.

- [ ] **Step 1: Escribir la prueba fallida de composición y singleton**

  Crear `src/browser/Application.test.ts` con mocks de las dos fábricas para aislar el composition root:

  ```ts
  import { beforeEach, describe, expect, it, vi } from "vitest";
  import { Application, getApp } from "./Application";

  const { authModule, editionModule, createAuth, createEdition } = vi.hoisted(
    () => {
      const authModule = { name: "auth" };
      const editionModule = { name: "edition" };
      return {
        authModule,
        editionModule,
        createAuth: vi.fn(() => authModule),
        createEdition: vi.fn(() => editionModule),
      };
    },
  );

  vi.mock("./auth", () => ({
    AuthModule: { create: createAuth },
  }));

  vi.mock("./edition", () => ({
    EditionModule: { create: createEdition },
  }));

  describe("Application", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("compone los módulos de autenticación y edición", () => {
      const app = Application.create();

      expect(createAuth).toHaveBeenCalledOnce();
      expect(createEdition).toHaveBeenCalledOnce();
      expect(app.authModule).toBe(authModule);
      expect(app.editionModule).toBe(editionModule);
    });

    it("devuelve la misma instancia desde getApp", () => {
      const first = getApp();
      const second = getApp();

      expect(first).toBe(second);
      expect(createAuth).toHaveBeenCalledTimes(1);
      expect(createEdition).toHaveBeenCalledTimes(1);
    });
  });
  ```

- [ ] **Step 2: Ejecutar la prueba para confirmar que falla**

  Ejecutar:

  ```bash
  npx vitest run src/browser/Application.test.ts
  ```

  Resultado esperado: FAIL porque `src/browser/Application.ts` todavía no existe.

- [ ] **Step 3: Commit de la prueba fallida**

  Después de ejecutar `npm run build`, ejecutar `git add src/browser/Application.test.ts` y crear el commit:

  ```bash
  git commit -m "test(browser): specify application composition"
  ```

### Task 2: Implementar `Application` y retirar los singletones de módulo

**Files:**
- Create: `src/browser/Application.ts`
- Modify: `src/browser/auth/index.ts:1-55`
- Modify: `src/browser/edition/index.ts:1-78`
- Test: `src/browser/Application.test.ts`

**Interfaces:**
- Consumes: `AuthModule.create()` y `EditionModule.create()`.
- Produces: `Application.create(): Application`, `getApp(): Application`, `Application.authModule: AuthModule` y `Application.editionModule: EditionModule`.

- [ ] **Step 1: Crear el composition root mínimo**

  Crear `src/browser/Application.ts` con esta implementación:

  ```ts
  import { AuthModule } from "./auth";
  import { EditionModule } from "./edition";

  export class Application {
    private constructor(
      public readonly authModule: AuthModule,
      public readonly editionModule: EditionModule,
    ) {}

    static create(): Application {
      return new Application(AuthModule.create(), EditionModule.create());
    }
  }

  let app: Application | null = null;

  export function getApp(): Application {
    if (!app) {
      app = Application.create();
    }
    return app;
  }
  ```

- [ ] **Step 2: Eliminar únicamente los exports singleton**

  En `src/browser/auth/index.ts`, conservar `GetAuthenticatedSession` y `AuthModule` sin cambios de comportamiento y eliminar solo:

  ```ts
  export const authModule = AuthModule.create();
  ```

  En `src/browser/edition/index.ts`, conservar todos los exports de tipos, `DocumentChanged` y `EditionModule`, y eliminar solo:

  ```ts
  export const edition = EditionModule.create();
  ```

- [ ] **Step 3: Ejecutar la prueba para confirmar que pasa**

  Ejecutar:

  ```bash
  npx vitest run src/browser/Application.test.ts
  ```

  Resultado esperado: PASS con las dos pruebas de composición.

- [ ] **Step 4: Verificar los módulos afectados**

  Ejecutar:

  ```bash
  npx vitest run src/browser/auth src/browser/edition
  ```

  Resultado esperado: PASS; los tests de las capacidades siguen usando sus fábricas o adaptadores sin depender de exports singleton.

- [ ] **Step 5: Commit de la composición**

  Después de ejecutar `npm run build`, crear el commit:

  ```bash
  git add src/browser/Application.ts src/browser/Application.test.ts src/browser/auth/index.ts src/browser/edition/index.ts
  git commit -m "feat(browser): add application composition root"
  ```

### Task 3: Migrar consumidores de autenticación al composition root

**Files:**
- Modify: `src/browser/auth/AuthForm.astro:118-124`
- Modify: `src/browser/layouts/components/Header.astro:64-73`
- Modify: `src/pages/profile.astro:29-40`
- Modify: `src/browser/layouts/components/Header.test.ts`
- Modify: `src/pages/profile.test.ts`

**Interfaces:**
- Consumes: `getApp(): Application` desde `src/browser/Application.ts`.
- Produces: scripts cliente que acceden a `app.authModule` sin importar `src/browser/auth` como singleton.

- [ ] **Step 1: Actualizar el formulario de autenticación**

  En `src/browser/auth/AuthForm.astro`, sustituir el import y las dos llamadas directas por:

  ```ts
  import { getApp } from "../Application";

  const app = getApp();
  document.addEventListener("astro:page-load", () => app.authModule.mount());
  app.authModule.mount();
  ```

- [ ] **Step 2: Actualizar Header y perfil**

  En `src/browser/layouts/components/Header.astro`, importar `getApp`, obtener `const app = getApp()`, y pasar `app.authModule.getAuthenticatedSession` al `AuthStatusController`.

  En `src/pages/profile.astro`, importar `getApp`, obtener `const app = getApp()`, y reemplazar la llamada del listener por:

  ```ts
  void app.authModule.signOutController.execute();
  ```

- [ ] **Step 3: Añadir comprobaciones de contrato a la prueba de consumidores**

  Extender `src/browser/layouts/components/Header.test.ts` con una lectura de `Header.astro` y `AuthForm.astro` que compruebe que contienen `getApp()` y no contienen `authModule` como import nombrado desde `auth`. Extender `src/pages/profile.test.ts` para comprobar que contiene `getApp()` y no contiene `import { authModule }`.

- [ ] **Step 4: Ejecutar las pruebas de autenticación y páginas**

  Ejecutar:

  ```bash
  npx vitest run src/browser/auth src/browser/layouts/components/Header.test.ts src/pages/profile.test.ts
  ```

  Resultado esperado: PASS sin referencias a `authModule` exportado.

- [ ] **Step 5: Commit de la migración de autenticación**

  Después de `npm run build`, crear el commit:

  ```bash
  git add src/browser/auth/AuthForm.astro src/browser/layouts/components/Header.astro src/pages/profile.astro src/browser/layouts/components/Header.test.ts src/pages/profile.test.ts
  git commit -m "refactor(browser): consume auth through application"
  ```

### Task 4: Migrar consumidores de edición al composition root

**Files:**
- Modify: `src/pages/[...slug]/index.astro:56-73`
- Modify: `src/browser/edition/ui/pages/PreviewPage.astro:14-38`
- Modify: `src/browser/edition/ui/pages/NewPage.astro:117-224`
- Modify: `src/browser/edition/ui/components/EditorToolbar.astro:60-143`
- Modify: `src/browser/edition/ui/components/DocumentEditor.astro:44-148`

**Interfaces:**
- Consumes: `getApp(): Application`, `Application.editionModule` y `DocumentChanged` desde `src/browser/edition`.
- Produces: scripts cliente que usan `app.editionModule` para preview, creación, guardado, borrado, renombrado, cambios del editor e inicialización.

- [ ] **Step 1: Migrar la página pública de documento**

  En el `<script>` cliente de `src/pages/[...slug]/index.astro`, reemplazar `import { edition } from "../../browser/edition"` por `import { getApp } from "../../browser/Application"`, crear `const app = getApp()`, y cambiar `edition.getRenderedDocument` por `app.editionModule.getRenderedDocument`.

- [ ] **Step 2: Migrar preview y creación de documentos**

  En `PreviewPage.astro` y `NewPage.astro`, importar `getApp` desde `../../Application`, crear `const app = getApp()`, y cambiar cada uso de `edition` a `app.editionModule`. Mantener `DocumentChanged` importado desde `../../index` en `PreviewPage.astro`.

- [ ] **Step 3: Migrar toolbar y editor**

  En `EditorToolbar.astro` y `DocumentEditor.astro`, importar `getApp` desde `../../Application`, crear `const app = getApp()`, y cambiar todas las operaciones de edición a `app.editionModule`.

- [ ] **Step 4: Verificar que no sobreviven imports singleton**

  Ejecutar:

  ```bash
  rg -n "import \{ (edition|authModule) \}" src --glob '*.{ts,astro}'
  ```

  Resultado esperado: sin coincidencias. Ejecutar también:

  ```bash
  rg -n "from \"\.\./(index|auth)\"|from \"\.\./\.\./(index|auth)\"" src/browser src/pages --glob '*.{ts,astro}'
  ```

  y confirmar que las coincidencias restantes son imports de tipos, eventos o componentes, no singletones eliminados.

- [ ] **Step 5: Ejecutar pruebas y build del flujo de edición**

  Ejecutar:

  ```bash
  npx vitest run src/browser/edition src/pages
  npm run build
  ```

  Resultado esperado: todas las pruebas PASS y compilación Astro completa; las advertencias de tamaño de chunk conocidas no son errores.

- [ ] **Step 6: Commit de la migración de edición**

  Crear el commit:

  ```bash
  git add "src/pages/[...slug]/index.astro" src/browser/edition/ui/pages/PreviewPage.astro src/browser/edition/ui/pages/NewPage.astro src/browser/edition/ui/components/EditorToolbar.astro src/browser/edition/ui/components/DocumentEditor.astro
  git commit -m "refactor(browser): consume edition through application"
  ```

### Task 5: Documentar la decisión y cerrar la verificación

**Files:**
- Create: `src/content/nanobook-project/arquitectura/composicion-application-browser.md`
- Modify: `src/content/nanobook-project/arquitectura/index.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: la implementación de `src/browser/Application.ts` y la decisión aprobada en `docs/superpowers/specs/2026-10-08-browser-application-composition-design.md`.
- Produces: una decisión arquitectónica navegable y una entrada `[Unreleased]` que describen la composición de Browser.

- [ ] **Step 1: Crear la decisión arquitectónica**

  Crear `src/content/nanobook-project/arquitectura/composicion-application-browser.md` con frontmatter de contenido, la decisión de usar `src/browser/Application.ts`, el diagrama `pages/scripts cliente → getApp() → AuthModule/EditionModule`, la razón de mantenerla síncrona, el límite de `toast` y las reglas que impiden importar `server` desde scripts de navegador.

- [ ] **Step 2: Enlazar la decisión en el índice y changelog**

  Añadir a `src/content/nanobook-project/arquitectura/index.md` el enlace `./composicion-application-browser` y una viñeta en `CHANGELOG.md` bajo `[Unreleased]` indicando que autenticación y edición del navegador ahora se componen mediante `Application`/`getApp()`.

- [ ] **Step 3: Ejecutar la verificación completa**

  Ejecutar:

  ```bash
  npm test
  npm run build
  git diff --check
  ```

  Resultado esperado: todos los tests y el build PASS y `git diff --check` sin salida.

- [ ] **Step 4: Commit de documentación y resultado**

  Crear el commit final:

  ```bash
  git add src/content/nanobook-project/arquitectura/composicion-application-browser.md src/content/nanobook-project/arquitectura/index.md CHANGELOG.md
  git commit -m "docs(browser): document application composition"
  ```

- [ ] **Step 5: Confirmar el estado final**

  Ejecutar `git status --short` y `git show --check --format= HEAD`. Resultado esperado: no hay archivos pendientes y el commit final no contiene errores de whitespace.
