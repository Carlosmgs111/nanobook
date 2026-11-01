---
id: "1b1df64c-0211-4c5f-a849-56ab28a36da2"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Dependencia de navegación hacia documentos"
description: "Decisión sobre la composición de NavigationModule a partir de DocumentModule."
date: 2026-10-31
author: "Codex"
tags: ["arquitectura", "navegación", "documentos"]
draft: false
---

`navigation` mantiene una vista derivada de los documentos de cada nanobook: obtiene sus entradas y la invalida ante sus eventos. Por ello depende de la API pública de `DocumentModule`; `documents` no depende de `navigation`.

`NavigationModule.create` recibe la capacidad pública `getAllDocuments` de `DocumentModule` mediante la composición de `Application`. Se retiraron el puerto `DocumentProvider` y el adaptador `DocumentModuleDocumentProvider`, porque no representaban una implementación intercambiable: solo traducían uno a uno la misma API.

Los grafos se almacenan por `nanobookId` mediante el contrato asíncrono `NavigationGraphCache`. En desarrollo, `InMemoryNavigationGraphCache` comparte el mismo cálculo en curso entre consultas. En Vercel, `VercelNavigationGraphCache` persiste un snapshot plano del grafo en `getCache`, bajo el namespace versionado `nanobook-navigation-graph-v1` y con TTL de cinco minutos. Esto evita depender de la serialización de `Map` y de instancias de clases.

Cada evento `DocumentCreated`, `DocumentUpdated` o `DocumentDeleted` reemplaza la entrada por un nuevo cálculo: las consultas posteriores esperan el grafo reconstruido. El adaptador de Vercel solo mantiene cálculos en vuelo en la memoria local; las consultas resueltas vuelven a Runtime Cache para observar las actualizaciones hechas por otra instancia. Un fallo elimina el cálculo pendiente para permitir el reintento.

Las pruebas de navegación conservan una doble mínima de esa capacidad. Si en el futuro navigation necesita otra fuente de entradas realmente independiente de documents, se reintroducirá un contrato propio en navigation junto con al menos una segunda implementación productiva.
