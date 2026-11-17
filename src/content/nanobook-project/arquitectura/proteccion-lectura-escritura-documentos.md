---
id: "7c3e5a2e-91b4-4d0f-b6a8-2f4d1e9c5b37"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Protección de lectura y escritura desde documents"
description: "Decisión: el módulo documents resuelve por sí mismo la protección de lectura (ReadDocument) y la autorización de escritura (WriteAccess)."
date: 2026-11-16
author: "Claude"
tags: ["arquitectura", "documentos", "seguridad"]
draft: false
---

## Lectura

La lectura de contenido protegido pasa siempre por `ReadDocument` (documento) y `ListReadableDocuments` (listados). `ReadDocument` compone `GetDocument.executeChain` con `AuthorizeDocumentAccess` y devuelve `not-found`, `allowed` o `challenge`. Es fail-closed.

- `getDocument` queda solo para rutas de escritura (edit, new y preview, que exigen permiso `write`) y para `CreateNanobook`. `authorizeDocumentAccess` dejó de ser parte de la API pública de `DocumentModule`; solo sigue como variable local en `src/documents/server/index.ts` y en los tipos y pruebas de `ReadDocument`.
- El visor se identifica con un `userId` perezoso: solo se resuelve si la cadena de proxies contiene un enlace protegido. El módulo decide si es escritor mediante el puerto `WriteAccess`; un fallo del puerto cuenta como «no escritor».
- Un desafío devuelve el documento **almacenado** redactado (`Document.redacted()`), no el destino del proxy, para no filtrar el título de otro documento protegido.
- `allowed` lleva la evidencia `via: "open" | "writer" | "grant"`.
- La página pública marca como `noindex, nofollow` (`X-Robots-Tag`) todo acceso a contenido protegido.

## Escritura

`documents` define el puerto `WriteAccess`; no puede importar `nanobooks`, que es quien construye `DocumentModule` (habría un ciclo). `nanobooks` lo implementa con `NanobookWriteAccess`, que delega la decisión de escritura en la política de nanobooks del módulo `authorization` (vía `Authorizer.require`), y lo inyecta en `DocumentModule.create`.

Crear, actualizar, borrar y fijar o quitar contraseña autorizan por el permiso `write` del nanobook dentro de cada caso de uso. El `ownerId` del documento es solo metadato de auditoría (lo estampa `CreateDocument` con el actor); los documentos sin dueño ya no quedan bloqueados para su escritor.

## Limitaciones conocidas

1. En una cadena de proxies el documento resuelto conserva el id del almacenado, de modo que un grant del enlace almacenado puede desbloquear también un destino protegido con otra contraseña. Solo los escritores del nanobook pueden crear proxies, así que no es explotable por visores.
2. El documento crudo se cachea en `DocumentSourceCache`; una invalidación tardía podría servir brevemente como abierto un documento recién protegido.
3. Superficies pendientes de auditar: `getAllDocuments` de navigation, búsqueda, `llms.txt`, RSS y endpoints `.md`.
4. `astro check` y `tsc` no están instalados en el repositorio, por lo que el chequeo de tipos nunca se ejecutó sobre este cambio.
