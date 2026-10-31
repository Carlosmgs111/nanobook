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

`NavigationModule.create` recibe las capacidades públicas `getAllDocuments` y `refreshDocuments` de `DocumentModule` mediante la composición de `Application`. Se retiraron el puerto `DocumentProvider` y el adaptador `DocumentModuleDocumentProvider`, porque no representaban una implementación intercambiable: solo traducían uno a uno la misma API.

Las pruebas de navegación conservan una doble mínima de esas dos capacidades. Si en el futuro navigation necesita otra fuente de entradas realmente independiente de documents, se reintroducirá un contrato propio en navigation junto con al menos una segunda implementación productiva.
