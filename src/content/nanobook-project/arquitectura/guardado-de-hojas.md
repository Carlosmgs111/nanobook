---
id: "guardado-de-hojas-2026-11-19"
ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"
title: "Guardado de las ediciones de una hoja"
description: "Cómo un escritor guarda en el documento las celdas editadas de un bloque spreadsheet: puerto sobre documents, localización del fence por su contenido y reescritura mínima del YAML."
date: 2026-11-19
author: "Nanobook"
tags: ["nanobook", "arquitectura", "spreadsheets"]
draft: false
---

# Guardado de las ediciones de una hoja

El bloque `spreadsheet` con `readOnly: false` permite editar celdas en la página publicada. Si el visitante
puede escribir en el documento, un botón **Guardar cambios** persiste las celdas modificadas en el fence.

- **Capacidades de otros módulos, sin crear nuevas.** `spreadsheets/server` recibe `documentModule` y
  `Authorizer` por inyección (`SpreadsheetsServerModule.create`). Un puerto (`SpreadsheetDocuments`) y su adaptador
  (`DocumentModuleSpreadsheetDocuments`) usan `getDocument.executeRaw` y `updateDocument.execute`, igual que
  `DocumentModuleRootDocument` en `nanobooks`. El adaptador deja intacto el `ref` del documento: lo lee de los
  metadatos.
- **Cómo se localiza el fence.** La isla envía las filas originales y las nuevas; el servidor reemplaza el primer
  fence `spreadsheet` de raíz cuyas filas coinciden con las originales (ignorando `null` finales). Sin coincidencia
  responde 409: el documento cambió. No hay índice ni huella en el marcador.
- **Cómo se reescribe.** `replaceSheetCells` usa el Document API de `yaml` y solo cambia las celdas distintas:
  los comentarios y el estilo se conservan (los comentarios quedan con un espacio antes de `#`). No se añaden ni
  quitan filas.
- **Permisos y concurrencia.** `SaveSpreadsheet` pide permiso de escritura a `Authorizer` antes de leer, y guarda
  con la revisión leída (`expectedRevision`): un conflicto de revisión también responde 409. Si el contenido no
  cambia, no escribe.
- **Quién ve el botón.** `DocumentPage` pasa a `RenderedDocument` un `context` (`nanobookId`, `documentPath`) solo
  si `canEdit`; `rendering` lo reenvía opaco a los bloques. Quien no escribe sigue editando solo en su pantalla.
- **Límites conocidos.** Una hoja idéntica a otra en el mismo documento: se edita la primera. Un fence con sangría
  no se reescribe, y uno que nunca se cierra tampoco coincide: ambos responden 409.
- **Páginas con `ref`.** No ofrecen guardar: la hoja mostrada pertenece al documento destino (`ProxyParser` sustituye
  el cuerpo pero conserva `ref`, y `entry.ref` lo expone), no al cuerpo almacenado del proxy. Se edita en el destino.
- **Valores de celda.** La isla conserva el texto tecleado hasta que la celda pierde el foco y solo los decimales
  simples pasan a número ("007", "1e3" y "0x1F" siguen siendo texto); una celda vacía pasa a `null`.
