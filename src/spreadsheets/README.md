# Spreadsheets

> Extensión de Markdown que añade los bloques `spreadsheet` (hoja ordenable y editable) y `spreadsheet-totals` (totales calculados en servidor), con guardado opcional de las celdas editadas en el propio documento.

**Nivel:** Opcional  ·  **Entornos:** browser / server / shared

## Qué hace
- Registra dos bloques de componente en el `BlockRegistry` de `rendering`: `spreadsheet` y `spreadsheet-totals`.
- `spreadsheet`: tabla interactiva (isla React sobre TanStack Table) con orden por columna y, con `readOnly: false`, edición de celdas en el navegador.
- `spreadsheet-totals`: componente `.astro` solo de servidor que calcula `sum`, `average`, `min`, `max`, `count` por columna sin JavaScript en cliente.
- Guarda en el documento las celdas editadas: `PATCH /api/nanobooks/:nanobookId/spreadsheets` localiza la fence por su contenido y reescribe solo las celdas cambiadas, conservando comentarios y estilo del YAML.
- Decide en el cliente si mostrar el botón de guardar (`canSaveSpreadsheet`); el servidor siempre exige permiso de escritura.
- NO añade ni quita filas; NO guarda hojas de páginas con `ref` (proxy); NO es dueño del documento: lee y escribe solo a través de `documents`.

## Cómo está construido
```text
spreadsheets/
  shared/sheet.ts            # esquemas de celda/filas/columnas y utilidades puras (modelo de hoja)
  browser/
    index.ts                 # SpreadsheetsModule.create(blocks)
    blocks.ts                # spreadsheetBlocks: {name, component, props}
    components/Spreadsheet/          # .astro + SpreadsheetIsland.tsx + .schema.ts
    components/SpreadsheetTotals/    # .astro (servidor) + .schema.ts
    saveSpreadsheet.ts       # cliente HTTP del guardado (nunca lanza)
    canSaveSpreadsheet.ts    # ¿puede ver el botón guardar el visitante?
    ui/styles/spreadsheets.css
  server/
    index.ts                 # SpreadsheetsServerModule (compositor)
    domain/
      errors.ts, ports/SpreadsheetDocuments.ts, replaceSheetCells.ts
    application/SaveSpreadsheet.ts
    infraestructure/documents/DocumentModuleSpreadsheetDocuments.ts
    infraestructure/rest/SaveSpreadsheetController.ts
```
- **Modelo de hoja (`shared/sheet.ts`).** `Cell` = texto (máx. 500), número finito o `null` (las fechas son texto). `sheetColumns`: 1-26 etiquetas no vacías (≤60); `sheetRows`: 1-200 filas de 1-26 celdas. Utilidades: `columnLabel` (A, B, … AA), `compareCells` (números, texto, vacías al final), `sheetWidth`, `columnTotal` y `parseCellInput` (texto tecleado a valor: vacío es `null`, decimal simple es número, el resto texto). `totalFunctions` = `sum|average|min|max|count`.
- **Domain.** `replaceSheetCells(markdown, original, next)` parsea con `remark-parse`, toma solo los fences `spreadsheet` hijos directos de la raíz (los únicos que `rendering` monta como bloque), busca el primero cuyas filas coinciden con `original` (ignorando `null` finales) y modifica con el Document API de `yaml` solo las celdas distintas. Errores: `SheetNotFoundError` (409), `InvalidSheetError` (422), `SheetDocumentNotFoundError` (404), `SheetRevisionConflictError` (409), `SheetWriteError` (500). Contiene un `TODO` para que `rendering` exponga una capacidad que capture fences.
- **Puerto:** `SpreadsheetDocuments` (`read` del documento almacenado sin proxies, `write` con revisión esperada). **Adaptador:** `DocumentModuleSpreadsheetDocuments` sobre `getDocument.executeRaw` y `updateDocument.execute` de `documents`; conserva el `ref` tal cual y traduce `DocumentRevisionConflictError` a `SheetRevisionConflictError`.
- **Application.** `SaveSpreadsheet.execute({nanobookId, documentPath, original, next, actorId})`: `authorizer.require` (`write` sobre `document`), lee, aplica `replaceSheetCells`, y si el contenido no cambia no escribe (evita subir la revisión y emitir `DocumentUpdated`).
- **Infraestructura REST.** `SaveSpreadsheetController.handle` (APIRoute): 401 sin `locals.currentUserId`, 400 cuerpo inválido, delega y mapea errores; los de acceso usan `accessErrorResponse`.
- Eventos propios: ninguno (la escritura produce los eventos de `documents`). Persistencia: ninguna propia. Dependencias: `@tanstack/react-table`, `react`, `yaml`, `zod`, `unified`/`remark-parse`.

## Cómo se usa
Sintaxis (fixtures reales en `shared/test/fixtures/ventas-por-region.md` y `hojas-casos.md`):

````markdown
```spreadsheet
title: Ventas por región (millones de COP)
columns: [Región, Enero, Febrero, Marzo]
readOnly: false
rows:
  - [Norte, 120, 135, 128]
  - [Este, 76, 80, null]
```

```spreadsheet-totals
title: Resumen por mes
columns: [Región, Enero, Febrero, Marzo]
functions: [sum, average, max, count]
rows:
  - [Norte, 120, 135, 128]
  - [Este, 76, 80, null]
```
````
- `spreadsheet`: `title?`, `columns?` (sin ellas, etiquetas A, B, …), `rows`, `readOnly` (por defecto `true`); esquema `strict`.
- `spreadsheet-totals`: `title?`, `columns` (obligatorias), `rows`, `functions` (1 a 5, por defecto `[sum]`); una columna sin números no tiene resultado (`count` da 0).
- **Composición.** `src/application/server/Application.ts`: `SpreadsheetsModule.create(renderingModule.blocks)` y `SpreadsheetsServerModule.create(nanobookModule.documentModule, authorizer)`, expuesto como `app.spreadsheetsServerModule`. El Worker de vista previa (`worker-entry.ts`) llama `SpreadsheetsModule.create(blocks)`. Estilos: `global.css` importa `spreadsheets/browser/ui/styles/spreadsheets.css`.
- **Endpoint:** `PATCH /api/nanobooks/[nanobookId]/spreadsheets` (`src/pages/api/nanobooks/[nanobookId]/spreadsheets.ts`, `prerender = false`, protegido con `app.routeProtector.protect`). Cuerpo: `{ documentPath, original, next }` (filas validadas con `sheetRows`). Respuestas: 200 `{ok:true}`, 400, 401, 403 (acceso), 404, 409 (hoja ya no coincide o conflicto de revisión), 422, 500.
- **Flujo del botón guardar.** `DocumentPage.astro` pasa a `RenderedDocument` un `context` `{ nanobookId, documentPath, ownerId? }` cuando `canEdit` o el nanobook es público sin sesión conocida (y la entrada no tiene `ref`); `rendering` lo reenvía opaco (`BlockHost`) a la isla. Sin `ownerId` la barra se muestra directamente; con `ownerId`, `canSaveSpreadsheet` consulta `/api/auth/get-session` y solo la muestra si el id coincide. `saveSpreadsheet` envía las filas originales y las nuevas y devuelve `"saved" | "stale" | "error"`. Sin `context`, lo editado queda solo en la pantalla del lector.

**Cómo quitarla.** (1) Eliminar `SpreadsheetsModule.create(...)` y `SpreadsheetsServerModule.create(...)` (y el campo `spreadsheetsServerModule` del constructor de `Application`) en `application/server/Application.ts`; (2) quitar `SpreadsheetsModule.create(blocks)` de `worker-entry.ts`; (3) borrar la ruta `src/pages/api/nanobooks/[nanobookId]/spreadsheets.ts`; (4) quitar el `@import` de `global.css`; (5) borrar `src/spreadsheets/` y revisar las pruebas que lo importan (`Application.test.ts`, `SpreadsheetsIntegration.test.ts`); (6) opcional: retirar `@tanstack/react-table` de `package.json`. `rendering` y `documents` no dependen del módulo; el `context` que `DocumentPage` entrega a los bloques es genérico y puede quedarse. Los documentos con estas fences se publicarían como código normal.

## Dependencias
- **Depende de:** `rendering/shared` (registro de bloques), `documents/server` (leer/escribir el documento por el puerto), `authorization/server` (`Authorizer`, `Subject`, errores de acceso). En el cliente evita importar `auth`: hace su propio `fetch` a `/api/auth/get-session`.
- **Lo usan:** `application` (composición servidor y Worker), `pages/api/.../spreadsheets.ts` (adaptador HTTP) y `documents/browser` (`DocumentPage` entrega el `context`; no importa el módulo, solo pasa datos).
- **Acoplamiento a vigilar:** `SheetRef` deriva su tipo de `DocumentModule["updateDocument"]` (dependencia estructural de `documents/server`); `browser/blocks.ts` hardcodea `/src/spreadsheets/browser/components`; las pruebas de integración importan `Application` y el renderer del Worker.

## Seguridad y autorización
- El módulo no define política propia: `SaveSpreadsheet` solo consume `Authorizer` y `Subject` (`action: "write"`, `resource: { type: "document", id: documentPath, nanobookId }`). Las políticas que deciden (p. ej. `NanobookAccessPolicy`, `DocumentPasswordPolicy`) las registran los compositores de `nanobooks` y `documents`.
- Se lee el documento almacenado (`executeRaw`), no el resuelto con proxies, para no persistir contenido ajeno; `expectedRevision` evita pisar cambios concurrentes.
- Ocultar el botón (`canSaveSpreadsheet`) es solo conveniencia de UI; la autoridad es el servidor.

## Pruebas
Junto al código: `shared/sheet.test.ts`, `browser/*.test.ts`, `SpreadsheetTotals.astro.test.ts`, `server/domain/replaceSheetCells.test.ts`, `server/application/SaveSpreadsheet.test.ts` (con `createAuthorizer` y una `Policy` falsa), el adaptador y el controlador, e integración en `shared/test/SpreadsheetsIntegration.test.ts`.
`npx vitest run src/spreadsheets` y `npx vitest run --config vitest.astro.config.ts src/spreadsheets` (componentes Astro).

## Decisiones y límites conocidos
- Límites conocidos: hojas idénticas en un documento (se edita la primera); fence con sangría o sin cerrar responde 409; páginas con `ref` no guardan; un escritor no propietario en nanobooks públicos no ve el botón.
