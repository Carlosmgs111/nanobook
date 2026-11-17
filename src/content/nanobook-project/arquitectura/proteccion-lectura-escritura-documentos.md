---
id: "7c3e5a2e-91b4-4d0f-b6a8-2f4d1e9c5b37"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Protección de lectura y escritura desde documents"
description: "Decisión: el módulo documents resuelve por sí mismo la protección de lectura (ReadDocument y DocumentPasswordPolicy) y delega la autorización de escritura en el módulo authorization."
date: 2026-11-16
author: "Claude"
tags: ["arquitectura", "documentos", "seguridad"]
draft: false
---

## Lectura

La lectura de contenido protegido pasa siempre por `ReadDocument` (documento) y `ListReadableDocuments` (listados). `ReadDocument` compone `GetDocument.executeChain` con `Authorizer` y devuelve `not-found`, `allowed` o `challenge`. Es fail-closed. La protección por contraseña es la política `DocumentPasswordPolicy` del módulo `authorization` (ver [Módulo authorization](./modulo-authorization)); solo restringe lecturas y nunca concede.

- `getDocument` queda solo para rutas de escritura (edit, new y preview, que exigen permiso `write`) y para `CreateNanobook`. El antiguo caso de uso de autorización de documentos desapareció: su lógica pasó a `DocumentPasswordPolicy`, y el helper `documentResource` construye siempre el recurso de lectura con la cadena de enlaces protegidos (`attributes.securedIds`).
- El visor se identifica con un `userId` perezoso: solo se resuelve si la cadena de proxies contiene un enlace protegido. Sin enlaces protegidos no se consulta al autorizador (quien llama ya autorizó el acceso al nanobook). Con enlaces protegidos, `authorize(read)` combina la política de `nanobooks` (puede leer el nanobook) con la de contraseña (grant válido o ser escritor, que se comprueba con `write` sobre el mismo recurso); un fallo técnico lanza `AccessCheckFailedError` y se propaga como 500.
- Un desafío devuelve el documento **almacenado** redactado (`Document.redacted()`), no el destino del proxy, para no filtrar el título de otro documento protegido.
- `allowed` lleva la evidencia `via: "open" | "protected"`. Un agente no puede superar la contraseña: ante un `challenge` recibe `deny(forbidden)` (403 en MCP).
- La página pública marca como `noindex, nofollow` (`X-Robots-Tag`) todo acceso a contenido protegido.

## Escritura

`documents` no importa `nanobooks`, que es quien construye `DocumentModule` (habría un ciclo). Recibe el `Authorizer` y el arreglo de políticas en `DocumentModule.create(eventBus, authorizer, policies)`, registra `DocumentPasswordPolicy` y llama a `authorizer.require({ action: "write", resource: { type: "document", ... } })`; decide `NanobookAccessPolicy`, que evalúa los recursos `document` por su `nanobookId`. Las versiones anteriores usaban un puerto de escritura propio con su adaptador en `nanobooks` y un guard HTTP; todo eso se retiró.

Crear, actualizar, borrar y fijar o quitar contraseña autorizan por el permiso `write` del nanobook dentro de cada caso de uso, antes de cargar o validar nada (`SetDocumentPassword` valida la contraseña después de autorizar). Los controladores traducen los errores con `accessErrorResponse`: ajeno sobre nanobook privado o inexistente, 404 idéntico; sobre uno público, 403; sin sesión, 401. El `ownerId` del documento es solo metadato de auditoría (lo estampa `CreateDocument` con el actor); los documentos sin dueño ya no quedan bloqueados para su escritor.

## Limitaciones conocidas

1. En una cadena de proxies el documento resuelto conserva el id del almacenado, de modo que un grant del enlace almacenado puede desbloquear también un destino protegido con otra contraseña. Solo los escritores del nanobook pueden crear proxies, así que no es explotable por visores.
2. El documento crudo se cachea en `DocumentSourceCache`; una invalidación tardía podría servir brevemente como abierto un documento recién protegido.
3. Superficies pendientes de auditar: `getAllDocuments` de navigation, búsqueda, `llms.txt`, RSS y endpoints `.md`.
4. `astro check` y `tsc` no están instalados en el repositorio, por lo que el chequeo de tipos nunca se ejecutó sobre este cambio.
