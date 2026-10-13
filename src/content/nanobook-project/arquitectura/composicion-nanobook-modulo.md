---
id: "c2e0c4b0-1c7f-4b7d-a9f2-ef68c4a3d5db"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Composición por nanobook"
description: "Decisión sobre la frontera de composición y el ciclo de vida de los contextos aislados por nanobook."
date: 2026-10-13
author: "Nanobook Team"
tags:
  - arquitectura
  - nanobook
  - composition-root
  - decision
draft: false
---

# Composición por nanobook

## Contexto

La aplicación administra varios nanobooks dentro de una misma instancia. Cada
nanobook tiene su propio repositorio de documentos, grafo de navegación,
publicación, eventos y namespace de caché. Una composición global de esas
capacidades deja abierta la posibilidad de mezclar documentos entre libros y
obliga a mantener módulos que ya no representan el flujo canónico.

## Decisión

`Application` conserva únicamente las capacidades transversales de la
instancia: autenticación, perfiles y `NanobookModule`. El módulo de nanobooks
es la frontera de composición del contenido:

```text
Application
  ├── AuthServerModule
  ├── ProfileModule
  └── NanobookModule
        ├── repositorio y casos de uso de nanobooks
        ├── controladores de creación y listado
        └── NanobookContext por colección
              ├── DocumentModule (SQL acotado por nanobookId)
              ├── NavigationModule (raíz index)
              └── PublishingModule (caché aislada)
```

`NanobookModule` también posee el caché de contextos. Reutiliza un contexto
mientras su `contentVersion` no cambie, lo cierra cuando debe reconstruirlo y
expone las resoluciones por identidad o por `slug`. `NanobookContext` se limita
a componer las capacidades de una colección y a cerrar sus recursos.

Las capacidades transversales, como `RouteProtector`, se reciben desde
`Application` mediante inyección. El módulo conoce el contrato de la capacidad,
pero no si la implementación proviene de Better Auth u otro proveedor.

La misma frontera se aplica a los módulos contextuales. `Application` entrega
un paquete `NanobookContextModules` con los constructores de documentos,
navegación, publicación, proveedor documental y bus de eventos. El factory de
`NanobookContext` recibe ese paquete y compone las instancias por colección;
la composición contextual de `nanobooks` no importa esas implementaciones
directamente.

La creación usa la capacidad explícita `NanobookCreationStore.createWithRoot`.
El repositorio SQL implementa esa capacidad mediante una transacción que inserta
el nanobook, su documento `index`, la revisión inicial, el evento outbox y la
nueva versión de contenido. No existe un camino de creación que persista el
nanobook sin su raíz.

## Justificación

1. **Aislamiento explícito**: las capacidades de contenido reciben siempre el
   `nanobookId` y no existe un repositorio global como fallback.
2. **Composición centralizada**: `Application` es el único lugar que conoce
   los constructores concretos y los entrega como capacidades al contexto.
3. **Ciclo de vida coherente**: la misma frontera crea, cachea y cierra un
   contexto; no se dejan buses o handlers de publicación fuera de su colección.
4. **Rutas adaptadoras**: las páginas y APIs resuelven el contexto mediante
   `app.nanobookModule` y pasan explícitamente sus servicios a los componentes
   de presentación.

## Consecuencias

- Las rutas sin un nanobook canónico no pueden usar capacidades de contenido.
- El módulo de nanobooks es más grande que un módulo puramente CRUD porque
  contiene la composición de su subdominio; esa concentración evita duplicar la
  misma lógica en `Application` y en las rutas.
- El cierre de la aplicación debe cerrar `NanobookModule` si el runtime necesita
  liberar handlers o cachés antes de terminar.
- Crear un nuevo proveedor de documentos requiere cambiar la composición del
  contexto, no cada página Astro.

## Estado

Aceptada. Las rutas canónicas usan contextos por nanobook y las rutas de
documentos sin ese contexto permanecen retiradas (`410`).
