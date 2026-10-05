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

`src/auth/server/infrastructure/index.ts` es el único compositor del entorno de servidor. Expone el singleton `authModule`, que concentra el handler público de Better Auth y la capacidad `protect()`.

`protect()` es un decorador de rutas HTTP. Antes de invocar la capacidad que envuelve, obtiene la sesión mediante el adaptador `BetterAuthSessionReader`. Si no existe una persona autenticada, termina con `401`; si existe, continúa el flujo y deja el usuario en `Astro.locals.currentUser` y su identidad en `Astro.locals.currentUserId`.

El decorador no contiene reglas de autorización de documentos, roles ni propiedad. Es una capacidad de autenticación reutilizable. `DocumentModule` consume el contrato mínimo `RouteProtector` y compone sus mutaciones HTTP (`POST`, `PATCH` y `DELETE`) mediante `protectDocumentMutationRoutes()`. Por eso el módulo de documentos no importa Better Auth ni las capacidades internas de `auth`, y el endpoint solo expone las rutas ya protegidas por el módulo.

Con una sesión válida, el decorador deja el actor en `Astro.locals`. Las reglas futuras de propietario, editor o administrador se aplicarán en el controlador y sus casos de uso usando ese actor, sin cambiar la integración con Better Auth.
