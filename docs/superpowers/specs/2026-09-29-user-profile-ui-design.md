---
id: "user-profile-ui-design-2026-09-29"
title: "Diseño de UI para el perfil de usuario"
description: "Diseño de una página dedicada para consultar y editar el perfil del usuario actual."
date: 2026-09-29
author: "Nanobook Team"
tags:
  - user
  - ui
  - perfil
  - arquitectura
draft: false
---

# Diseño de UI para el perfil de usuario

## Decisión

El perfil del usuario actual se implementará como una página dedicada en `/profile`. No se utilizará un dashboard administrativo, panel lateral ni modal como superficie principal.

La página tendrá un acceso desde el header global, pero el formulario vivirá en una ruta estable y navegable. Esto conserva el contexto de la aplicación sin convertir un documento en el propietario del estado del perfil.

## Motivo

El perfil es una capacidad persistente y potencialmente extensible: además del email y nombre visible actuales, puede incorporar preferencias, avatar, sesiones o integraciones. Una página dedicada ofrece espacio, URL compartible dentro de la sesión, navegación del navegador, accesibilidad más sencilla y una migración natural hacia esas capacidades.

El panel lateral y el modal se reservan como posibles accesos rápidos futuros, pero no serán implementados en esta primera versión porque reducen espacio, complican el foco y obligan a mantener un flujo contextual adicional.

## Alcance funcional

La página `/profile` permitirá:

1. Cargar el perfil del usuario actual mediante `HttpUserApi.getUser()`.
2. Mostrar email y nombre visible.
3. Editar el nombre visible y, si el contrato actual lo permite, el email.
4. Guardar mediante `HttpUserApi.updateUser()`.
5. Mostrar estados de carga, guardado exitoso, validación y error de red/API.
6. Deshabilitar el formulario durante una operación de guardado para evitar solicitudes duplicadas.

La creación, selección del usuario actual, autenticación, logout, cambio de contraseña, sesiones, roles y permisos quedan fuera. La ruta recibirá `currentUserId` desde `Astro.locals` mediante un proveedor de sesión; si no existe, renderizará un estado de acceso no disponible y no hará ninguna consulta. No habrá fallback por email, `localStorage`, configuración pública ni ID hardcodeado.

## Estructura de componentes

```text
src/pages/profile.astro
  └── Layout
      └── UserProfilePage.astro
          └── UserProfileForm.astro
              ├── ProfileField.astro / inputs nativos
              ├── ProfileStatus.astro
              └── client profile controller
```

Responsabilidades:

- `profile.astro`: ruta server-rendered, título, layout y lectura de `Astro.locals.currentUserId`; si falta, muestra el estado de acceso no disponible.
- `UserProfilePage.astro`: estructura visual de la página y datos iniciales.
- `UserProfileForm.astro`: formulario semántico, estados visuales y eventos de submit.
- Controlador cliente: carga el usuario, mantiene estado local, valida campos editables y llama a `HttpUserApi`; no contiene HTML de layout ni lógica de API duplicada.
- `HttpUserApi`: único adaptador HTTP; los componentes no llaman directamente a `fetch`.

Si la implementación demuestra que separar `ProfileField` o `ProfileStatus` no aporta reutilización, pueden permanecer como markup local del formulario. La separación obligatoria es entre ruta, UI y controlador/API.

## Flujo de datos

```text
/profile
  -> obtiene currentUserId desde Astro.locals
  -> si falta, muestra acceso no disponible
  -> UserProfilePage
  -> controlador cliente
  -> HttpUserApi.getUser(userId)
  -> formulario editable

submit
  -> valida displayName/email
  -> HttpUserApi.updateUser(userId, mutableFields)
  -> reemplaza el estado local con UserProfile recibido
  -> muestra confirmación no bloqueante
```

El formulario no enviará `id`, `createdAt` ni `updatedAt`. El email y nombre se inicializarán desde la respuesta del servidor. Un error de carga conserva una pantalla de error con acción de reintento; un error de guardado conserva los valores editados para que el usuario pueda corregir o reintentar.

## Layout y responsive

- Usar `Layout.astro` y el ancho de contenido `constrained` existente.
- Presentar una columna principal de lectura cómoda, con una tarjeta o sección de formulario alineada al lenguaje visual de Nanobook: bordes, líneas de grid, fondo por capas y controles sobrios.
- En desktop, reservar una columna secundaria pequeña para identidad/resumen solo si mejora la jerarquía; no crear un dashboard de métricas.
- En móvil, pasar a una sola columna y mantener acciones visibles sin depender de hover.
- El foco visible, labels asociados y mensajes `aria-live` son obligatorios.
- La página debe funcionar con navegación de Astro `ClientRouter` sin listeners duplicados después de las transiciones.

## Estados de UI

```text
idle/loading profile -> ready
ready -> saving -> saved
ready -> saving -> error
loading profile -> load-error -> retry
```

- `loading`: skeleton o formulario no interactivo.
- `ready`: campos editables y botón Guardar.
- `saving`: botón deshabilitado y texto de progreso.
- `saved`: confirmación breve y valores sincronizados con la respuesta.
- `load-error`/`error`: mensaje accionable sin perder datos locales.

## Criterios de aceptación

- `/profile` renderiza dentro del layout global y tiene un título accesible.
- El frontend usa `HttpUserApi`, no `fetch` directo.
- El formulario nunca envía campos de identidad o auditoría.
- Los errores 400, 404, 409 y de red se muestran como mensajes comprensibles.
- El botón Guardar evita doble submit y se recupera después de un error.
- La página es usable mediante teclado y en viewport móvil.
- Las pruebas cubren carga, edición válida, validación inválida, guardado exitoso, conflicto/error y reintento.

## No incluidos

- Dashboard administrativo o listado de usuarios.
- Modal/panel lateral como flujo principal.
- Auth provider, sesión real, logout o protección de ruta.
- Subida de avatar, preferencias, cambio de contraseña o eliminación de cuenta.

