---
id: "d13b4a9f-9b98-48a6-9acd-2b34f4dddbf5"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Caché de lectura SSR en Runtime Cache"
description: "Decisión para evitar consultas LibSQL repetidas en lecturas SSR mediante snapshots de nanobooks y documentos fuente."
date: 2026-11-01
author: "Nanobook Team"
tags:
  - arquitectura
  - cache
  - vercel
  - rendimiento
draft: false
---

# Caché de lectura SSR en Runtime Cache

## Contexto

La lectura SSR de una página consultaba Turso una vez para resolver el
nanobook por slug y otra para leer el documento. Ambas consultas remotas se
ejecutaban en serie y dominaban el tiempo de aplicación. La navegación, la
sesión, Redis de páginas publicadas y el renderizado no eran el cuello de
botella medido.

## Decisión

Se guardan snapshots reconstruibles, no entidades ni HTML:

- `nanobook:v1:slug:{slug}` contiene identidad, propietario, visibilidad,
  tema/configuración, estado y fechas.
- `document:v1:{nanobookId}:{version}:{ruta}` contiene el documento fuente;
  cada nanobook mantiene un token de versión compartido.

Producción usa Vercel Runtime Cache y desarrollo/pruebas usan memoria. Las
entradas tienen TTL de cinco minutos como límite de recuperación. Los
snapshots documentales de 2 MB o más no se persisten y vuelven al repositorio
SQL.

## Coherencia

Los casos de uso de nanobook actualizan el snapshot tras una alta, edición o
cambio de tema y eliminan el slug anterior durante un renombrado o borrado.
`DocumentCreated`, `DocumentUpdated` y `DocumentDeleted` sustituyen el token
de versión del nanobook; por ello cualquier ruta documental anterior deja de
ser alcanzable sin que los eventos necesiten transportar rutas antiguas.

La caché está en `GetDocument.executeRaw`, tras normalizar la ruta. La
resolución de proxies sucede después del hit de la fuente y continúa leyendo
su destino actual, evitando almacenar contenido proxy obsoleto.

Sesiones, autorización y respuestas HTML no se cachean aquí. Redis mantiene
su responsabilidad existente sobre páginas publicadas.

## Observabilidad y operación

El middleware añade `app-total` a `Server-Timing`, que mide el trabajo entre
`next()` y la respuesta SSR. Comparar esa métrica con el tiempo del navegador
permite cuantificar la parte restante atribuible a plataforma o red.

En el despliegue se valida una ruta fría y otra caliente, y después se repiten
lecturas tras crear, editar, mover y borrar documentos, así como tras cambiar
slug, visibilidad o tema de un nanobook. Un snapshot malformado o un fallo de
lectura de caché se trata como miss y vuelve a LibSQL; un fallo al invalidar
después de una mutación se propaga por el bus de eventos para no ocultar una
posible incoherencia.
