---
id: "f28c4f88-7d5f-4a8f-92aa-0b5f7a4f3dd2"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Composición de la aplicación de navegador"
description: "Decisión de composición para los módulos de autenticación y edición que se ejecutan en el navegador."
date: 2026-10-08
author: "Nanobook Team"
tags:
  - arquitectura
  - browser
  - application
  - composicion
  - decision
draft: false
---

# Composición de la aplicación de navegador

## Contexto

El entorno de servidor ya tenía un punto de composición explícito en
`src/server/Application.ts`. En el navegador, `AuthModule` y `EditionModule`
construían y exportaban sus propios singletones desde sus índices. Los
componentes podían funcionar, pero el ciclo de vida quedaba distribuido y la
incorporación de un módulo nuevo podía crear composiciones parciales.

## Decisión

El navegador tiene un único composition root en
`src/browser/Application.ts`:

```text
scripts cliente de pages y browser
                │
                ▼
       browser/Application.getApp()
          ├── AuthModule
          └── EditionModule
                │
                ▼
             shared + HTTP
```

`Application.create()` construye `AuthModule` y `EditionModule` una vez.
`getApp()` conserva esa instancia dentro del contexto JavaScript del
navegador. Ambos métodos son síncronos porque los adaptadores actuales se
inicializan sin I/O asíncrono.

Los módulos mantienen sus fábricas `create()` para pruebas y para la
composición. Los exports singleton `authModule` y `edition` se eliminan; los
consumidores seleccionan sus capacidades mediante `getApp()`:

```ts
const app = getApp();
app.authModule.mount();
app.editionModule.saveDocument.execute(documentId);
```

## Límites de ejecución

- `Application` solo importa módulos de `browser` y contratos/utilidades de
  `shared` a través de esos módulos.
- Ningún frontmatter SSR invoca `getApp()`; las páginas Astro lo usan dentro
  de sus scripts cliente.
- Los scripts cliente no importan módulos de `server`, secretos ni APIs de
  Node.
- `src/pages/` delega en `server` durante SSR y en `browser/Application` en
  el cliente, sin ensamblar dependencias por su cuenta.
- `toast` permanece fuera de `Application`: es un adaptador global de UI y no
  forma parte de la composición de autenticación o edición.

## Consecuencias

La identidad de la aplicación es estable durante una navegación cliente y
las páginas ya no dependen de exports singleton distribuidos. Las pruebas
pueden verificar por separado la composición y cada módulo. Como coste, un
nuevo módulo de navegador debe añadirse explícitamente a `Application` y sus
consumidores deben acceder a él desde `getApp()`.

## Estado

Aceptada e implementada el 2026-10-08. La composición del servidor continúa
siendo asíncrona e independiente.

## Véase también

- [Separación de módulos por entorno](./separacion-entornos-browser-server)
- [Composición raíz modular del servidor](./composicion-raiz-modular)
