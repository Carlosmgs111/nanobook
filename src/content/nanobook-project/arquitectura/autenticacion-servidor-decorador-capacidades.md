---
id: "9174049e-c3a7-4ea4-b284-97f56048b23f"
title: "Autenticación del servidor y decorador de capacidades"
description: "Composición de Better Auth y protección reutilizable de rutas HTTP."
date: 2026-10-05
author: "Nanobook"
tags: ["auth", "server", "better-auth", "authorization"]
draft: false
---

# Autenticación del servidor y decorador de capacidades

`browser` y `server` son fronteras de ejecución del módulo `auth`. El código que usa Better Auth, Drizzle, credenciales de OAuth o correo pertenece a `src/auth/server/infrastructure` y no debe importarse desde el navegador.

`src/auth/server/index.ts` es el compositor del entorno de servidor. `Application` crea una única instancia de `AuthServerModule` por aplicación y la expone como `authServerModule`; esta concentra el handler público de Better Auth y la capacidad `protect()`.

`protect()` es la única capacidad de negocio de protección. Delega el trabajo técnico a `withAuthenticatedSession()`, que consulta directamente `BetterAuthSessionReader`; no existe una capacidad de aplicación separada para obtener la sesión. Si no existe una persona autenticada, termina con `401`; si existe, continúa el flujo y deja el usuario en `Astro.locals.currentUser` y su identidad en `Astro.locals.currentUserId`.

El decorador no contiene reglas de autorización de documentos, roles ni propiedad. Es una capacidad de autenticación reutilizable. `DocumentModule` consume el contrato mínimo `RouteProtector` y compone sus mutaciones HTTP (`POST`, `PATCH` y `DELETE`) mediante `protectDocumentMutationRoutes()`. Por eso el módulo de documentos no importa Better Auth ni las capacidades internas de `auth`, y el endpoint solo expone las rutas ya protegidas por el módulo.

Con una sesión válida, el decorador deja el actor en `Astro.locals`. Las reglas futuras de propietario, editor o administrador se aplicarán en el controlador y sus casos de uso usando ese actor, sin cambiar la integración con Better Auth.

En la frontera de navegador, `CachedAuthSessionReader` conserva en memoria el resultado de `GET /api/auth/get-session` y comparte las consultas concurrentes. `SessionCachingAuthApi` actualiza ese caché después de ingresar, registrarse o cerrar sesión; el encabezado vuelve a consultar el nodo actual tras cada navegación de `ClientRouter`. Este estado solo optimiza la interfaz: no autoriza operaciones y se descarta al recargar completamente la página. Cada ruta de servidor protegida continúa validando la cookie mediante Better Auth.

La interfaz marca las acciones mutantes de documentos con `data-auth-document-mutation`. `AuthStatusController` las mantiene ocultas hasta resolver una sesión y conserva públicos los enlaces de lectura. Esta visibilidad es una medida de experiencia de usuario; el decorador de servidor sigue siendo la barrera de seguridad y la autorización por propietario o rol deberá aplicarse después de él.
