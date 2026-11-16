# Persistencia de ediciones de bloques en el fence

Fecha: 2026-11-16. Rama: `preview` (worktree `nanobook-framework-blocks`).

## Objetivo

Que un valor capturado por un componente de bloque en la página de lectura (p. ej. una celda del `spreadsheet`) se guarde en el propio documento, reescribiendo solo el valor afectado dentro del fence YAML.

## Decisiones

- **Superficie:** página de lectura, guardado directo, sin pasar por CodeMirror. El editor y la vista previa no cambian.
- **Dirección del fence:** índice del bloque de raíz + huella (hash) del texto original del fence. Si la huella no coincide con el fuente actual, se rechaza (409).
- **Reescritura:** parche con el Document API de `yaml` (`parseDocument(...).setIn`), que conserva comentarios, orden y estilo. El resto del documento queda byte a byte igual.
- **Alcance:** cualquier bloque que lo declare. `ComponentBlockDefinition` gana `editable?: readonly string[]` (campos de primer nivel de las props). `spreadsheet` declara `["rows"]`.
- **Permisos:** solo quien puede escribir en el documento persiste. Los demás editan en local, como hoy. Con `readOnly: false`, un escritor persiste y un lector edita en su pantalla.

## Diseño

### 1. Marcador (rendering/shared)

- `blockMarker.ts`: `nb:block-start NOMBRE INDEX HASH PROPS_B64`. `blockStartComment` y `decodeBlockHeader` llevan `index` y `hash`.
- `createComponentBlocksExtension.ts`: contador local de bloques de raíz válidos en `transform`; hash SHA-256 truncado de `fence.source`. `COMPONENT_BLOCKS_VERSION` pasa a `"3"` (invalida la caché de páginas).
- `splitComponentBlocks.ts`: el segmento `block` incluye `index` y `hash`.
- `ComponentBlockDefinition.ts`: campo `editable`.
- `rendering/server/application/DocumentPieceResolver.ts`: la pieza `island` gana `index`, `hash` y `editable`.

### 2. Mostrar (rendering/browser + documents/browser)

- `DocumentPage.astro` (ya conoce `canEdit`, `nanobookId` y el id del documento) pasa a `RenderedDocument` `editing = canEdit ? { endpoint: /api/nanobooks/{nanobookId}/documents/{id}/blocks } : undefined`, junto a `html`.
- `RenderedDocument.astro` reenvía `editing` a `BlockHost` con `index`, `hash` y `editable` de la pieza.
- `BlockHost.astro`: si hay `editing` y el bloque declara `editable`, añade la prop `edit = { endpoint, name, index, hash, editable }` después de validar las props (el esquema estricto no la ve).
- Un visitante sin permiso no recibe `edit`.

### 3. Editar (cliente)

- `rendering/browser/ui/saveBlockEdit.ts` (nuevo): `saveBlockEdit(edit, path, value)` hace `PATCH` con `{name, index, hash, path, value}`; devuelve `ok`, `stale` (409) o `error`. Tras `ok`, actualiza el `hash` local con el que devuelve el servidor para encadenar ediciones.
- `Spreadsheet.schema.ts`: exporta el tipo de la prop `edit`.
- `SpreadsheetIsland.tsx`: en `onBlur` de cada celda llama a `saveBlockEdit(edit, ["rows", row.index, columnIndex], value)` y muestra el estado (guardando, guardado, error, recargar). Sin `edit`, solo edita en local. `row.index` de TanStack es la fila original, así que ordenar no altera la dirección.
- `spreadsheets/browser/blocks.ts`: `spreadsheet` declara `editable: ["rows"]`.

### 4. Guardar (servidor)

- `rendering/shared/componentBlocks/applyBlockEdit.ts` (nuevo, puro): localiza el fence con `unified` + `remark-parse` (nodos `code` hijos de la raíz, con posición); comprueba ordinal y hash; comprueba que `path[0]` esté en `editable`; aplica `setIn`; valida con el esquema del bloque; devuelve el Markdown con solo ese fence cambiado y el hash nuevo. Errores tipados: `stale`, `not-editable`, `invalid`, `not-found`. Se exporta desde `rendering/shared/index.ts`.
- `RenderingModule` expone `blockEditor = { apply(markdown, edit) }`.
- `documents/server/domain/ports/BlockEditor.ts` (nuevo): puerto; `documents` no importa `rendering`.
- `documents/server/application/EditDocumentBlock.ts` (nuevo): `contentRepository.getById` → `blockEditor.apply` → `UpdateDocument.execute` con `expectedRevision`. Reutiliza comprobación de propietario y evento `DocumentUpdated`; `PageRenderer` ya invalida su caché al recibirlo.
- `EditDocumentBlockController.ts` (nuevo): valida el cuerpo; `stale` y conflicto de revisión → 409, `invalid` y `not-editable` → 422.
- Ruta `pages/api/nanobooks/[nanobookId]/documents/[id]/blocks.ts`: `PATCH` envuelto en `protectNanobookWriteMutation`.

### Cableado

`DocumentModule` lo crea `NanobookModule.create(eventBus)`, así que `blockEditor` se pasa por `NanobookModule.create` hasta `DocumentModule.create`. En `Application.ts`, `RenderingModule.create(eventBus)` pasa a crearse **antes** que `NanobookModule` (solo necesita el `eventBus`; los bloques se registran después y el registro se lee al usarlo).

## Flujo de error

| Caso | Respuesta | Efecto en la isla |
|---|---|---|
| Huella distinta o fence ya no existe | 409 | Pide recargar la página |
| Revisión del documento cambió | 409 | Pide recargar la página |
| Campo fuera de `editable` | 422 | Error; el valor local se conserva |
| El resultado no valida contra el esquema | 422 | Error; el valor local se conserva |
| Sin permiso de escritura | 401/403 (ruta protegida) | La isla no recibió `edit` |

## Pruebas

- `applyBlockEdit.test.ts`: conserva comentarios y estilo, hash obsoleto, campo no editable, esquema violado, varios fences del mismo lenguaje, fence anidado ignorado.
- `blockMarker.test.ts`, `splitComponentBlocks.test.ts`, `createComponentBlocksExtension.test.ts`, `DocumentPieceResolver.test.ts`: ida y vuelta de `index`, `hash` y `editable`.
- `EditDocumentBlock.test.ts` y del controlador: 200, 409, 422, sin permiso.
- `SpreadsheetsIntegration.test.ts`: edita una celda y comprueba que el resto del documento queda byte a byte igual.
- `MarkdownRendererParity.test.ts` sigue vigilando que el Worker de la vista previa produzca el mismo HTML con los marcadores nuevos.
- `boundary.test.ts` sigue verde: `documents` solo toca el puerto.

## Fuera de alcance

- Edición desde la vista previa del editor hacia CodeMirror.
- Edición colaborativa en tiempo real y resolución automática de conflictos.
- Rutas anidadas (`path` con campos fuera de `editable`) y bloques anidados en listas o citas (no llevan marcador).
- Retirar el código huérfano de `src/publishing/server/`.
