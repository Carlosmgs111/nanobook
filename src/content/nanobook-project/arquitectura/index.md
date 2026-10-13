---
id: "eb9f6c0c-a4eb-4bcd-95dd-c7787e2e2703"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Arquitectura"
description: "Decisiones y propuestas arquitectónicas del proyecto Nanobook."
date: 2026-08-23
author: "Nanobook"
tags: ["nanobook", "arquitectura", "decisiones"]
draft: false
nanobook: true
---

## Decisiones recientes

- Persistencia de documentos en SQL y múltiples nanobooks: almacenamiento administrado por la instancia, aislamiento, revisiones optimistas, outbox, alias legacy y migración verificable. El corte se activa con `NANOBOOK_SQL_CUTOVER=true` después de verificar el manifiesto.

- [Separación de módulos por entorno](./separacion-entornos-browser-server): límites entre `browser`, `server`, `content`, `pages` y `shared` y sus reglas de dependencia.
- [Composición de la aplicación de navegador](./composicion-application-browser): composición síncrona de `AuthModule` y `EditionModule` mediante `Application` y `getApp()`.
- [Autenticación del servidor y decorador de capacidades](./autenticacion-servidor-decorador-capacidades): frontera de servidor del módulo `auth`, composición única y protección reutilizable de rutas HTTP.
- [Composición raíz modular](./composicion-raiz-modular): por qué se introdujo `src/Application.ts` y los módulos `DocumentModule`, `NavigationModule` y `PublishingModule`.
- [Refactorización del grafo de dependencias](./refactorizacion-grafo-dependencias): por qué `DocumentsGraph` se movió a `navigation` y cómo se calculan los `invalidatedIds`.
- [Webhook de GitHub: ubicación y dependencias](./webhook-github-arquitectura): dónde se ubicó el caso de uso del webhook y qué alternativas se evaluaron.
- [Thundering herd contra la API de GitHub](./thundering-herd-github): el error `503 Backend.max_conn reached` tras la refactorización y la solución con in-flight promises.
- [Cardinalidad de la notificación document/publishing](./notificacion-cambio-document): por qué la fuente del cambio siempre debe activar el flujo de notificación y cómo mantener el desacoplamiento si la necesidad la declara `publishing`.
- [Tipos de buses de eventos](./tipos-de-buses-de-eventos): un bus de eventos no es una sola categoría; diferencias entre intra-proceso, inter-proceso y distribuido.

## Navegación contextual de Nanobooks

Un documento índice puede declarar `nanobook: true` en su frontmatter. La
marca conserva la ruta pública y la jerarquía física, pero convierte ese índice
en la raíz visible de navegación de su propio subárbol. Solo es válida en
documentos índice.

Al abrir un documento, la navegación busca el índice Nanobook ancestro más
cercano. El breadcrumb inicia entonces en `Inicio`, enlazado a dicho índice, y
omite sus ancestros externos. El sidebar del propio índice muestra sus hijos
inmediatos y no permite subir a la colección contenedora. Un Nanobook anidado
define un contexto nuevo y prevalece sobre su contenedor; sin una marca
ancestro se conserva la navegación global existente.

## Propuesta de persistencia SQL — 2026-10-12

Se propone almacenar usuarios, perfiles, nanobooks y documentos en la misma base Drizzle/libSQL administrada por la instancia. Cada nanobook será una entidad independiente con identidad, configuración y árbol lógico propios; no contendrá otros nanobooks. Los documentos y directorios pertenecerán a un único libro. Los usuarios crearán contenido sin configurar GitHub ni credenciales de almacenamiento.

La marca histórica `nanobook: true`, descrita en la sección anterior como comportamiento actual, dejará de establecer fronteras activas. Breadcrumbs y sidebar usarán la raíz explícita del libro; mover un directorio dentro del mismo no cambiará la configuración ni el ámbito de sus documentos. Bibliotecas que agrupen nanobooks y transferencias entre libros quedan para una evolución posterior; el renombrado normal no puede reasignar pertenencia.

La migración exigirá clasificar cada frontera histórica como libro independiente o directorio normal. Preservará IDs y propiedad, declarará los cambios de rutas/configuración/referencias y conservará acceso por URLs antiguas mediante alias autorizados. Incluirá revisiones, transacciones de subárboles, control de concurrencia y aislamiento de API y cachés. No se propone escritura doble; después de aceptar escrituras SQL, una reversión requiere reconciliar los nuevos datos.

Estado: implementación disponible. La especificación completa se conserva en `docs/superpowers/specs/2026-10-12-sql-multinanobook-design.md` y el plan ejecutable en `docs/superpowers/plans/2026-10-12-sql-multinanobook.md` dentro del repositorio. Se mantiene el fallback legacy mientras no se active el corte y se conservan pendientes las pruebas estáticas antiguas que aún apuntan a rutas de módulos previas.
