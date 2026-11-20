# Layouts

> Composición visual compartida de Astro: documentos HTML base, cabecera, shell de página y scripts de restauración de estado.

**Nivel:** Núcleo (adaptador de Astro)  ·  **Entornos:** browser (componentes Astro SSR con scripts cliente)

## Qué hace
- `Layout.astro`: documento completo para páginas autenticadas y de lectura. Obtiene la sesión (o usa la que recibe vía prop `session`), resuelve y compila el tema, lee la cookie `nanobook-color-mode`, y escribe `<html data-theme data-theme-key data-color-mode>`, `<style data-nanobook-theme>` y `<meta data-theme-state>`; activa `ClientRouter`.
- `LandingLayout.astro`: documento para la landing pública; mismo mecanismo de tema, sin shell. Usa `monocromo` salvo `?theme=nanobook`.
- `components/LayoutShell.astro`: estructura de la página (cabecera, sidebar, `main` con prosa, tabla de contenidos, footer, `ToastHost`, controladores de cierre de sesión y estado de autenticación) y coordina el ancho de contenido entre `#content-wrapper` y `#header-inner`.
- `components/Header.astro`: marca, navegación del proyecto (Explorar, Mis nanobooks, Temas), menú «Vista» (modo de color y ancho), menú de cuenta/«Ingresar», migas del nanobook, y cierre de menús con Escape/clic fuera. Los enlaces dependientes de sesión llevan `data-auth-required` / `data-auth-anonymous`.
- `components/ContentWidthToggle.astro`: botón de ancho constreñido/completo (`localStorage` `content-width-mode`).
- `components/StateRestoreScripts.astro`: migra `localStorage.theme` a la cookie `nanobook-color-mode`, instala `ThemeNavigationController` y restaura el ancho de contenido tras `astro:after-swap`/`astro:page-load`.
- `components/Footer.astro`.
- NO contiene reglas de negocio, resolución de temas (la hace `theme`), autenticación (la hace `auth`) ni datos de navegación (los obtiene `navigation`).

## Cómo está construido
```text
src/layouts/
  Layout.astro
  LandingLayout.astro
  components/
    LayoutShell.astro
    Header.astro
    Footer.astro
    ContentWidthToggle.astro
    StateRestoreScripts.astro
    Header.test.ts
```
- **Capas (domain / application / infraestructure):** No aplica. Es un adaptador de presentación de Astro; la lógica vive en los módulos que consume.
- **Puertos:** No aplica; consume `getApp()` (`Application` del servidor) en el frontmatter SSR.
- **Eventos / DOM:** el shell escucha `content:mode` en `#content-wrapper` y propaga `data-content-mode` a `#header-inner`; los scripts se re-ejecutan en `astro:after-swap` / `astro:page-load` y usan banderas globales (`__nanobookColorModeMigrated`, `__nanobookContentWidthRestored`, `__nanobookThemeNavigation`) para no duplicar listeners con `ClientRouter`.
- **Persistencia:** cookie `nanobook-color-mode` (modo de color) y `localStorage` `content-width-mode`; no hay base de datos ni servicios externos.
- **Librerías:** `astro` y `astro:transitions` (`ClientRouter`); estilos de `src/shared/styles/global.css` (importa `theme/browser/ui/styles/contract.css`) y Tailwind.

## Cómo se usa
- Página típica (la mayoría recibe `theme` ya resuelto):
```astro
<Layout title="Temas" description="..." session={session} theme={theme}
        navigationContext={{ section: "project" }} headings={headings} hideToc>
  ...
</Layout>
```
Props de `Layout`: `title`, `description`, `headings`, `hideToc`, `loginHref` (`/login`), `canonicalHref`, `navigationService`, `theme`, `navigationContext`, `deferSessionUi`, `session` (si se pasa, incluso `null`, no se consulta la sesión).
- Usan `Layout`: `documents/browser/ui/pages/{DocumentPage,EditPage,NewPage,PreviewPage}.astro`, `auth/browser/ui/AuthForm.astro`, `nanobooks/browser/ui/NanobooksPage.astro`, `profiles/browser/ui/ProfilePage.astro`, `theme/browser/ui/ThemesPage.astro` y `pages/verify-email.astro`. Usa `LandingLayout`: `application/browser/ui/LandingPage.astro`.
- Rutas HTTP: ninguna propia.

## Dependencias
- **Depende de:** `application/server` (`getApp`: sesión y tema), `theme` (`normalizeColorModePreference`, `AppliedTheme`, `ColorModeToggle`, `ThemeNavigationController`), `auth` (`AuthenticatedUser`, `AuthStatusController`), `profiles` (`SignOutController`), `navigation` (`SidebarNav`, `Breadcrumb`, `OpenSidebar`, `NavigationService`, `NavigationContext`), `documents` (`TableOfContents`), `toast` (`ToastHost`), `shared` (estilos, iconos).
- **Lo usan:** las páginas y componentes de presentación listados arriba.
- Acoplamientos a vigilar: depende de muchos módulos a la vez (por naturaleza de composición) y varios de ellos importan `Layout` de vuelta (p. ej. `ThemesPage`); mantener la lógica fuera del shell y los `<script>` cliente sin importar valores de servidor. `Header.test.ts` lee archivos fuente con `readFileSync` (pruebas de contenido, no de comportamiento).

## Seguridad y autorización
- No autoriza: solo muestra u oculta enlaces según `signedIn` (`hidden`, `data-auth-required`, `data-auth-anonymous`); la autorización real ocurre en las rutas y casos de uso. Con `deferSessionUi` el estado de sesión se completa en el cliente (`data-auth-deferred`).
- El JSON de variables del tema se serializa en `data-theme-variables` desde `CompileTheme`, no desde entrada del usuario sin validar (los tokens se validan en `theme`).

## Pruebas
`npx vitest run src/layouts` (`Header.test.ts`: contenido de Layout/LayoutShell/Header, enlaces del encabezado y reutilización de la sesión suministrada). `themeStyles.test.ts` de `theme` también lee `LandingLayout.astro`.

## Decisiones y límites conocidos
- Pendientes: `Layout.astro` y `LandingLayout.astro` duplican la lógica de resolver/compilar/instalar tema y el bloque `<head>` del tema; el footer muestra el texto fijo «Rendered with Astro + Tailwind»; la documentación del layout existe duplicada en `layout/` e `interfaz/layout/` con contenido distinto.
