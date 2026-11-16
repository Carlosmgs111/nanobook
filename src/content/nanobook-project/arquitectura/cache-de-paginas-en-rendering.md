# Caché de páginas en rendering

**Decisión:** la caché del HTML renderizado de cada página pertenece a `rendering`, no a `publishing`.
`PublishingModule` sigue en el repositorio pero ya no se compone ni se usa en ningún flujo. La única implementación
de la caché es la de Vercel.

## Qué hace cada pieza

- `RenderingModule.create(eventBus)` (`rendering/server/index.ts`) instancia la caché (`VercelRenderedPageCache` por
  defecto; un segundo parámetro opcional permite inyectar otra, p. ej. en pruebas), crea el `PageRenderer` y suscribe
  la invalidación.
- `rendering/server/application/PageRenderer.ts`: `render({ id, contentHash, content })` busca en la caché con la clave
  `fingerprint-del-motor:contentHash` y, si falla, renderiza con el motor y guarda. `invalidate(ids)` borra.
- `rendering/server/application/invalidatePagesOnDocumentChanges.ts`: se suscribe al bus por nombre
  (`document.created`, `document.updated`, `document.deleted`) porque `rendering` no puede importar las clases de
  `documents`; el evento trae el `documentId`. Ese contrato por nombre es la única dependencia con `documents`.
- `rendering/server/domain/RenderedPageCache.ts`: el puerto (`get`, `set`, `invalidate`) y `PageCacheError`.
- `rendering/server/infraestructure/cache/VercelRenderedPageCache.ts`: el adaptador.
- `PageRenderer.renderDocument(document)`: recibe cualquier objeto con la forma `PageDocument` (el `Document` de `documents` la
  cumple sin que `rendering` lo importe) y devuelve `{ rendered, headings, contentHash }`. Las cuatro páginas (`DocumentPage`,
  `EditPage`, `NewPage`, `PreviewPage`) llaman a `renderingModule.pageRenderer.renderDocument(document)`.

## Adaptador de Vercel

Usa `getCache` de `@vercel/functions` con el espacio de nombres `rendered-page:v1`. Cada entrada se guarda bajo
`pageId:contentHash` y se etiqueta con `page:<pageId>`; invalidar una página es `expireTag`, así caducan juntas todas sus
versiones sin conocer sus hashes. Fuera de Vercel, `getCache` usa su propia caché en memoria (también con etiquetas), así
que desarrollo y pruebas no necesitan otro backend. Los fallos de lectura y escritura cuentan como fallo de caché (se
renderiza igual); los de invalidación se devuelven como `PageCacheError`. Las páginas de 2 MB o más no se cachean.

Se eliminaron los backends de sistema de archivos, memoria y Redis, y `CACHE_BACKEND` ya no influye en las páginas.

## Frontera

`rendering` puede importar `src/shared` (Result, errores, bus de eventos), que es infraestructura transversal y no un módulo
de negocio; `boundary.test.ts` lo permite explícitamente y sigue prohibiendo importar cualquier otro módulo.
