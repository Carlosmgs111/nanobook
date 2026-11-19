# Guardar los cambios de una hoja en el documento

Fecha: 2026-11-19. Reemplaza la versión del 2026-11-16 (que proponía un mecanismo genérico en `rendering` y `documents`).

## Objetivo

Que un lector con permiso de escritura edite celdas de un bloque `spreadsheet` en la página publicada y las guarde en el propio documento con un botón **Guardar cambios**, reescribiendo solo las celdas modificadas dentro del fence YAML.

## Principio

No se crean capacidades nuevas en otros módulos. `spreadsheets` recibe por inyección las capacidades de lectura y escritura que `documents` ya expone, igual que `nanobooks` usa `DocumentModuleRootDocument` y `agents` usa `documentModule`. `documents` y `rendering` no cambian de comportamiento.

## Flujo

1. La hoja se pinta como hoy. Si el visitante puede escribir (`canEdit`) y la hoja es `readOnly: false`, las celdas son editables.
2. Cada edición queda como cambio pendiente en la isla; aparece **Guardar cambios**.
3. Al pulsarlo, la isla envía `PATCH /api/nanobooks/:nanobookId/spreadsheets` con `{ documentPath, original, next }`:
   - `original`: las filas tal como se cargaron.
   - `next`: las filas con los cambios.
4. El servidor comprueba permiso, lee el documento, localiza el fence cuyas filas coinciden con `original`, parchea solo las celdas distintas y guarda con la revisión leída.
5. Si no hay ningún fence que coincida con `original`, el documento cambió: 409 y la isla pide recargar. Si la revisión cambió entre la lectura y el guardado: 409 también.
6. Tras guardar, `next` pasa a ser el nuevo `original` de la isla. `PageRenderer` ya invalida su caché al recibir `DocumentUpdated`; no hace falta nada más.

Quien no puede escribir sigue editando solo en su pantalla (sin botón), como hoy.

## Diseño

### `spreadsheets/server/` (nuevo; tres capas + compositor)

- **domain/**
  - `replaceSheetCells(markdown, original, next)` (pura): usa `unified` + `remark-parse` para ubicar los nodos `code` con lenguaje `spreadsheet` que sean hijos de la raíz (los únicos que `rendering` monta como bloque); elige el primero cuyas filas, ya parseadas, igualen `original`; compara `original` y `next` celda a celda y aplica `parseDocument(fence).setIn(["rows", fila, columna], valor)` solo a las distintas, de modo que comentarios, orden y estilo del autor se conservan. Las celdas más allá del final de una fila se rellenan con `null`. Valida el resultado con el esquema `spreadsheetProps`. Devuelve el Markdown nuevo o un error tipado: `SheetNotFoundError`, `InvalidSheetError`.
  - `ports/SpreadsheetDocuments.ts`: `read(nanobookId, path)` → `{ id, path, title, description, content, revision, … } | null`; `write(nanobookId, document, actorId)`.
- **application/**
  - `SaveSpreadsheet`: recibe `Authorizer` y el puerto. Orden: (1) `authorizer.require({ subject: Subject.of(actorId), action: "write", resource: { type: "document", id: documentPath, nanobookId } })`, igual que `loadWritableDocument`; (2) `read`; (3) `replaceSheetCells`; (4) `write` con `expectedRevision`.
- **infraestructure/**
  - `documents/DocumentModuleSpreadsheetDocuments`: adaptador sobre `documentModule.getDocument.executeRaw` (el documento almacenado, sin proxies resueltos, para no guardar contenido proxificado) y `documentModule.updateDocument.execute`. Es el único archivo de `spreadsheets` que importa `documents`, y solo por su entrada pública.
  - `rest/SaveSpreadsheetController`: valida el cuerpo y la sesión (`locals.currentUserId`, 401); traduce `SheetNotFoundError` y el conflicto de revisión a 409, `InvalidSheetError` a 422, y los errores de acceso con `accessErrorResponse` de `authorization`.
- **index.ts**: `SpreadsheetsServerModule.create(documentModule, authorizer)` expone `saveSpreadsheetController`.

`spreadsheets/browser/index.ts` (registro de bloques, también cargado por el Worker de la vista previa) no cambia.

### Ruta y composición

- `pages/api/nanobooks/[nanobookId]/spreadsheets.ts` (nuevo): `export const PATCH = app.routeProtector.protect(controller.handle)`, como la ruta de documentos.
- `application/server/Application.ts`: `SpreadsheetsServerModule.create(nanobookModule.documentModule, authorizer)`, expuesto como `spreadsheetsServerModule`.
- `documents/server/index.ts`: añade el `export` de `DocumentRevisionConflictError` (y de `DocumentNotFoundError` si hace falta) para que el adaptador distinga conflictos. Solo exportación, ninguna capacidad nueva.

### Isla (`spreadsheets/browser`)

- `SpreadsheetIsland.tsx`: estado `original` y `data`; botón **Guardar cambios** deshabilitado sin cambios; estados guardando, guardado, error y "recarga" (409). Si no recibe `context`, edita solo en local.
- `Spreadsheet.schema.ts`: tipo de la prop opcional `context` (`{ nanobookId, documentPath }`), fuera del esquema estricto de las props del fence.

### Único cruce con `rendering`

La isla necesita `nanobookId` y la ruta del documento. `DocumentPage.astro` ya los conoce y ya calcula `canEdit` con el autorizador. Pasa un `context` a `RenderedDocument`, solo si `canEdit`; `RenderedDocument` y `BlockHost` lo reenvían a cada bloque como una prop opaca (se añade después de validar las props, así no choca con el esquema estricto). `rendering` no interpreta su contenido ni importa otros módulos (`boundary.test.ts` sigue verde).

## Errores

| Caso | Respuesta | Efecto en la isla |
|---|---|---|
| Sin sesión | 401 | Mensaje de error |
| Sin permiso de escritura | 403/404 según `authorization` | Mensaje de error |
| Ningún fence coincide con `original` | 409 | Pide recargar |
| Revisión del documento cambió | 409 | Pide recargar |
| El resultado no valida contra el esquema | 422 | Error; los cambios pendientes se conservan |

## Pruebas

- `replaceSheetCells.test.ts`: conserva comentarios y estilo; solo cambia las celdas distintas; fence no encontrado; dos hojas distintas en el mismo documento; hojas idénticas (cambia la primera); celda fuera del ancho de la fila; resultado inválido; fence anidado en una lista ignorado.
- `SaveSpreadsheet.test.ts`: orden permiso → lectura → escritura; sin permiso no lee; pasa la revisión esperada.
- Prueba del adaptador y del controlador: 200, 401, 409, 422.
- `SpreadsheetsIntegration.test.ts`: con `ventas-por-region.md`, edita una celda y comprueba que el resto del documento queda byte a byte igual.
- `Application.test.ts`: se compone `spreadsheetsServerModule`.

## Fuera de alcance

- Un mecanismo genérico de guardado para otros bloques (se generalizará cuando exista un segundo caso).
- Añadir o quitar filas y columnas desde la hoja.
- Edición desde la vista previa del editor hacia CodeMirror.
- Edición colaborativa y resolución automática de conflictos.
- Retirar el código huérfano de `src/publishing/server/`.
