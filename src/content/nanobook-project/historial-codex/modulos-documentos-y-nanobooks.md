---
id: "6c382c17-ccfd-478d-b545-fa8b2800ffe1"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Codex: módulos, documentos y nanobooks"
description: "Reorganización y correcciones verificadas entre el 12 y el 15 de octubre de 2026."
date: 2026-10-21
author: "Codex"
tags: ["nanobook", "historial", "módulos", "documentos"]
draft: false
---

## 12 de octubre: fronteras entre navegador y servidor

Codex participó en el traslado de componentes de presentación a `browser/ui/` y en la actualización de sus importaciones y pruebas. Una de las tareas confirmó `8327f12` (`refactor(ui): separate browser and server components`); durante esa transición también detectó pruebas que seguían apuntando a rutas antiguas y corrigió una importación de estilos de la tarjeta de índice. La [decisión de separación por entorno](../arquitectura/separacion-entornos-browser-server) documenta la estructura que quedó adoptada. El proyecto continuó reorganizando módulos después de esa entrega, por lo que no se atribuye aquí toda la refactorización de `src/` a una sola tarea.

## 14 y 15 de octubre: correcciones en documentos

La investigación de Codex sobre la carga y creación de documentos encontró dos problemas concretos:

1. El formulario de creación no incluía su controlador de navegador. El envío nativo producía un `GET` y colocaba los campos en la URL. Codex incorporó el controlador y ajustó la redirección hacia el editor del nanobook actual.
2. Tras borrar lógicamente una carpeta, un índice único de SQL seguía reservando su ruta. Codex cambió la unicidad para considerar solo registros activos (`deleted_at IS NULL`) y aplicó la migración a la base local, conservando el historial de la carpeta anterior. La carpeta nueva recibe otra identidad aunque reutilice la ruta.

La tarea informó build y pruebas específicas correctos para ambas correcciones. En la segunda, la suite completa terminó sin diagnóstico, por lo que no consta una validación completa de esa ejecución.

## 15 de octubre: límites del módulo de nanobooks

Codex movió la exposición del controlador y las capacidades concretas de creación y consulta a `NanobookModule`, retirándolas de la composición global. El commit confirmado fue `e72b3e2`. También quitó del barrel público los adaptadores `DrizzleNanobookRepository`, `InMemoryNanobookRepository` y el puerto `NanobookRepository`, que solo se usaban internamente; quedó en `3ddd073`. La [decisión de composición de nanobooks](../arquitectura/composicion-nanobook-modulo) explica el límite entre el módulo y `Application`.

Otra tarea eliminó `createNanobookCapabilities` y restauró navegación y publicación como módulos globales, con un `InMemoryEventBus` compartido y obligatorio para propagar cambios. Codex confirmó la entrega en `52ad9b7`; la [decisión sobre módulos globales y eventos](../global-modules-event-bus) registra el motivo.

## 15 de octubre: portada y ciclo de vida

Codex implementó la landing pública en `/`, con accesos a registro e ingreso, entrada a «Mis nanobooks» para sesiones autenticadas y catálogo de libros públicos. El catálogo solo expone nombre y slug y distingue estados vacío o no disponible. En el mismo conjunto de trabajo se añadieron edición de nombre, slug y visibilidad y eliminación de nanobooks con comprobación de propietario y confirmación. El commit de integración es `fab6454`; las decisiones se explican en [landing pública](../landing-publica) y [ciclo de vida de nanobooks](../nanobook-lifecycle).

La tarea también investigó una aparente redirección persistente de `/` a `/n/nanobook`. Verificó que la landing respondía en el navegador integrado y señaló como causa posible una redirección permanente antigua guardada en otro navegador. Esa observación no equivale a un cambio de código.

## Evidencia y alcance

Los resultados de tareas y los commits respaldan las entregas anteriores. La migración SQL general aparece en Git y en la documentación del proyecto, pero este documento no la atribuye íntegramente a Codex: no hay en las tareas revisadas una correspondencia suficiente para hacerlo. [Volver al índice del historial](./index).
