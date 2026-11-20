# Toast

> Notificaciones efímeras en el navegador: un notificador que publica eventos DOM y un host Astro que los dibuja.

**Nivel:** Opcional  ·  **Entornos:** browser

## Qué hace
- Expone `BrowserToastNotifier` para mostrar y cerrar toasts de tipo `loading`, `success`, `error` e `info` desde código cliente.
- Define el puerto `ToastNotifier` (`show(message, kind, options?) => id`) para que los controladores lo reciban por inyección y se puedan probar con un doble.
- `ToastHost.astro` renderiza el contenedor, una plantilla `<template data-toast-template>` y escucha el evento `nanobook:toast`.
- Duración por defecto: 4500 ms para `success` e `info`; `error` y `loading` permanecen (0) hasta cerrarse. Reutilizar un `id` reemplaza el toast existente (útil para pasar de `loading` a `success`/`error`).
- Accesibilidad: `role="alert"` para `error`, `role="status"` para el resto; botón de cierre; respeta `prefers-reduced-motion`.
- NO tiene entorno server, no persiste nada, no cola ni apila por prioridad, no decide cuándo notificar (lo hace cada controlador).

## Cómo está construido
```text
src/toast/
  browser/
    BrowserToastNotifier.ts   # ToastNotifier, ToastKind, ToastOptions, BrowserToastNotifier, instancia `toast`
    ToastHost.astro           # Markup + <script> cliente + estilos con variables --theme-*
    *.test.ts
```
- **Capas:** No aplica (módulo de presentación sin dominio; solo `browser/`).
- **Puertos:** `ToastNotifier`; adaptador `BrowserToastNotifier`.
- **Eventos:** emite `nanobook:toast` en `document` con `detail` `{operation:"show", id, kind, message, duration}` o `{operation:"dismiss", id}`; lo consume `ToastHost.astro`.
- **Persistencia / servicios externos:** No aplica.
- **Librerías:** ninguna (usa `crypto.randomUUID` si existe).

## Cómo se usa
- `src/layouts/components/LayoutShell.astro` monta `<ToastHost />` una vez por página (el host usa el selector `[data-toast-host]`).
- Los controladores construyen un notificador, a menudo con un `id` por defecto, e inyectan el puerto:
```ts
const notifier = new BrowserToastNotifier("auth-flow");
notifier.loading("Iniciando sesión...");
notifier.success("Listo");   // mismo id: reemplaza el toast
notifier.dismiss();
```
- Usuarios actuales: `auth/browser/ui/AuthFormController.astro` (`"auth-flow"`, tipo `ToastNotifier` en `AuthFormController.ts`) y `profiles/browser/ui/SignOutController.astro` (`"sign-out"`).
- No hay rutas HTTP ni páginas.

## Dependencias
- **Depende de:** nada de otros módulos; solo consume variables CSS del tema (`--theme-border`, `--theme-text`, `--theme-status-error`, `--theme-page-bg`, `--theme-decoration-shadow`).
- **Lo usan:** `layouts` (monta el host), `auth` y `profiles` (envían toasts).
- Acoplamiento a vigilar: `ToastHost.astro` importa solo el tipo `ToastKind` de `BrowserToastNotifier` (sin valores) y duplica localmente las interfaces del evento; mantener sincronizadas ambas definiciones.

## Seguridad y autorización
No aplica. El mensaje se inserta con `textContent` (no HTML), por lo que no interpreta marcado.

## Pruebas
`npx vitest run src/toast`. `BrowserToastNotifier.test.ts` cubre la publicación de eventos y `ToastHost.test.ts` verifica que el markup viva en un `<template>` y no se construya con `document.createElement`.

## Decisiones y límites conocidos
- Límite: sin límite de toasts simultáneos ni deduplicación por mensaje; solo por `id`.
