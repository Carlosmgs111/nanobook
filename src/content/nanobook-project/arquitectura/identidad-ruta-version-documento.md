---
id: "8d1d0ceb-2515-4942-a6f3-e653ac79fdb1"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Identidad, ruta y revisión de los documentos"
description: "Separación entre identidad estable, ubicación mutable y revisión de concurrencia."
date: 2026-09-25
author: "Nanobook"
tags: ["document", "identity", "path", "revision", "concurrency"]
draft: false
---

# Identidad, ruta y revisión de los documentos

Un documento tiene tres propiedades distintas:

- `documentId`: identidad estable de la entidad.
- `path`: ubicación mutable dentro del árbol y URL pública.
- `revision`: token monotónico usado para concurrencia optimista.

El path no debe usarse como clave primaria de una futura base de datos. Mover o renombrar un documento debe actualizar su path, no eliminar y recrear la entidad.

La revisión aumenta ante cualquier mutación persistida, incluidos movimientos y borrados. Una escritura solo se acepta cuando su revisión esperada coincide con la actual. No describe semánticamente el contenido: solo ordena las escrituras de una entidad y permite rechazar una actualización basada en un estado antiguo.

El repositorio persiste un `contentHash` como checksum técnico del cuerpo. No forma parte de una API de versión de dominio ni representa por sí solo todo el estado del documento. Las capacidades `hashDocument` y `getDocumentVersion` se retiraron porque no tenían consumidores de producción.

## Sin revisión global del nanobook

El modelo SQL mantuvo temporalmente un contador `contentVersion` en cada nanobook y un `content_outbox`. Ningún caso de uso comparaba ese contador, ningún caché lo consumía y el dispatcher del outbox no estaba compuesto en la aplicación. Su actualización obligaba además al repositorio de `documents` a importar el esquema SQL de `nanobooks`.

Se retiraron ambos mecanismos. Las mutaciones documentales ya no modifican `nanobook.updatedAt`. Los eventos en memoria continúan notificando a navegación y publicación después de persistir, sin prometer entrega durable.

Si un caso de uso futuro necesita identificar el estado compuesto de una colección, podrá derivar un fingerprint de un manifiesto canónico de identidades y revisiones. Si necesita entrega durable, orden global o recuperación tras una caída, deberá diseñarse un outbox desde ese requisito concreto en lugar de mantener una versión global anticipada.

## Sin historial persistido

La tabla `document_revision` almacenaba un snapshot por mutación, pero ningún caso de uso consultaba, comparaba o restauraba esos estados. Se retiraron la tabla y sus escrituras. La revisión actual permanece en `document.revision` porque basta para rechazar una actualización basada en un estado antiguo.

Crear un documento requiere una única sentencia atómica y no abre una transacción explícita. Actualizar y borrar pasan siempre por operaciones de conjunto: incluso cuando reciben un solo documento conservan la misma transacción que protege movimientos y borrados de subárboles, de modo que el caso de uso no cambia de garantías según la cantidad de elementos afectados.

Los documentos persisten su `documentId` en el frontmatter. El dominio exige esa identidad y no convierte rutas heredadas en identidades implícitas.
