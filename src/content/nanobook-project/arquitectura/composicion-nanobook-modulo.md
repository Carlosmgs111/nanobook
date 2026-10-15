---
id: "c2e0c4b0-1c7f-4b7d-a9f2-ef68c4a3d5db"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Composición por nanobook"
description: "Decisión sobre la frontera de composición y el ciclo de vida de las capacidades aisladas por nanobook."
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
nanobook tiene su propio alcance de documentos, grafo de navegación,
publicación, eventos y namespace de caché. Una composición global que guardara
el identificador dentro del módulo documental dejaría abierta la posibilidad
de reutilizarlo con el nanobook equivocado.

## Decisión

`Application` conserva las capacidades transversales de la instancia y
compone `NanobookModule`. Este último es la frontera de composición del
contenido de nanobooks y contiene el flujo de alta documental:

```text
Application
  ├── AuthServerModule
  ├── ProfileModule
  ├── NanobookModule
  │     ├── repositorio y casos de uso de nanobooks
  │     ├── consultas `GetNanobookById` y `GetNanobookBySlug`
  │     ├── capacidades de creación, consulta y listado
  │     ├── controladores de creación y listado
  │     ├── DocumentModule compartido (repositorio y casos de uso sin estado)
  │     └── sin capacidades de presentación ni asociaciones por nanobook

Application.createNanobookCapabilities(nanobook)
  ├── DocumentModuleDocumentProvider (solo durante la solicitud)
  ├── NavigationModule (raíz index y basePath canónica)
  └── PublishingModule (namespace de caché del nanobook)
```

`NanobookModule` no crea ni conserva capacidades de navegación o publicación.
`Application.createNanobookCapabilities()` las compone bajo demanda para la
solicitud actual, usando el `nanobookId` explícito para cargar documentos y
aislar la clave del caché de páginas. No existe un `Map` por tenant,
`contentVersion` no controla el ciclo de vida de módulos y no hay un
`NanobookContext` o bus acotado que deba cerrarse entre solicitudes.

Las capacidades transversales, como `RouteProtector`, se reciben desde
`Application` mediante inyección. El módulo conoce el contrato de la capacidad,
pero no si la implementación proviene de Better Auth u otro proveedor.

La composición de las capacidades pertenece a la raíz de aplicación, pero el
módulo de documentos no se instancia por colección. `NanobookModule` crea una
sola instancia de `DocumentModule`, que instancia directamente el
`DrizzleContentRepository` y sus capacidades. Cada operación documental recibe
el `nanobookId` como primer parámetro y el repositorio aplica ese alcance en
cada consulta y mutación. El proveedor documental, la navegación y la
publicación se crean bajo demanda por solicitud. La invalidación persistente de
caché no depende de suscriptores en memoria, ya que una siguiente invocación
puede ejecutarse en otra instancia serverless.

Las rutas consultan nanobooks mediante `GetNanobookById` y
`GetNanobookBySlug`. El repositorio permanece privado dentro del compositor y
solo los casos de uso conocen el puerto de persistencia. La consulta por ID
devuelve un error de aplicación cuando la entidad no existe; la consulta por
slug devuelve `null` para que el adaptador de ruta produzca un `404`.

Los casos de uso y controladores concretos se instancian dentro de
`NanobookModule` y se consumen mediante sus propiedades públicas. El barrel del
módulo expone contratos, entidades y errores; no obliga a los consumidores a
conocer las clases concretas de aplicación o infraestructura.

`CreateNanobook` persiste el nanobook mediante `NanobookRepository.create` y
usa la instancia compartida de `DocumentModule`; llama a
`getDocument.executeRaw(nanobookId, "index")` y
`createDocument.execute(nanobookId, ...)` para crear el documento `index` solo
cuando no existe.
Son dos operaciones independientes: si la segunda falla, el nanobook permanece
creado y el siguiente intento lo retoma sin duplicar la raíz.

El caso de uso usa `setupStatus` (`pending`, `failed`, `ready`). Su prueba usa
`InMemoryNanobookRepository` y un módulo documental simulado para validar
reintentos e idempotencia sin transacciones entre módulos.
`DrizzleNanobookRepository` persiste ese estado en `nanobook.setup_status`; los
registros existentes se consideran `ready` mediante la migración
`0008_grey_kitty_pryde`.

## Justificación

1. **Aislamiento explícito**: las capacidades de contenido reciben siempre el
   `nanobookId`; la instancia del módulo no puede quedar accidentalmente
   ligada a una colección.
2. **Composición centralizada**: `Application` es el único lugar que conecta
   documentos con navegación y publicación.
3. **Ciclo de vida serverless**: cada solicitud obtiene capacidades nuevas y no
   deja asociaciones o handlers retenidos por nanobook.
4. **Rutas adaptadoras**: las páginas y APIs resuelven la entidad mediante
   `app.nanobookModule`, solicitan capacidades efímeras a `Application` y
   pasan explícitamente los servicios a los componentes.

## Consecuencias

- Las rutas sin un nanobook canónico no pueden usar capacidades de contenido.
- `Application` no conoce el orden de creación del nanobook y su documento
  raíz; ese flujo pertenece a `CreateNanobook`.
- Las capacidades de presentación no requieren un cierre coordinado: no
  registran handlers en un bus compartido y sus recursos terminan con la
  solicitud.
- Crear un nuevo proveedor de documentos requiere cambiar la composición del
  módulo documental, no cada página Astro ni un contexto adicional.

## Estado

Aceptada. Las rutas canónicas usan capacidades administradas por
`NanobookModule` y las rutas de documentos sin un nanobook canónico permanecen
retiradas (`410`).
