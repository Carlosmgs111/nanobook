# Migración de documentos a SQL y múltiples nanobooks — Implementation Plan

> **Estado (2026-10-30):** las secciones sobre `contentVersion`, `content_outbox` y snapshots persistidos en `document_revision` son históricas y quedaron sustituidas por la decisión [Identidad, ruta, versión y revisión de los documentos](../../../src/content/nanobook-project/arquitectura/identidad-ruta-version-documento.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Implementación secuencial; este plan no autoriza cambios sobre producción.

**Goal:** Persistir documentos en la misma base SQL que usuarios y perfiles, con nanobooks independientes, cada uno con su árbol lógico y configuración propia, sin configuración de almacenamiento por parte del usuario.

**Architecture:** Drizzle/libSQL compartido en infraestructura, repositorios acotados por nanobook, composición por contexto y transacciones de contenido. Migración expansiva con origen congelado, importación idempotente y corte controlado. GitHub queda fuera de la ruta normal de lectura/escritura.

**Tech Stack:** Astro, TypeScript, Drizzle ORM, `@libsql/client`, SQLite/libSQL, Vitest y Markdown; conservar las versiones instaladas salvo incompatibilidad demostrada.

**Spec:** `docs/superpowers/specs/2026-10-12-sql-multinanobook-design.md`. El resumen de la propuesta también se registra en `src/content/nanobook-project/arquitectura/index.md`; los archivos nuevos de `src/content` están ignorados por Git y por eso la especificación completa reside en `docs/`.

## Estado de implementación — 2026-10-13

La implementación de persistencia, aislamiento por nanobook, rutas canónicas, mutaciones transaccionales, creación atómica y navegación por contexto está integrada en la rama principal. El contenido local fue verificado durante el desarrollo, pero no forma parte del despliegue productivo. El puente de aliases previsto inicialmente fue retirado: no hay entidades ni enlaces históricos que deban conservarse en una instalación nueva.

La decisión final es iniciar producción con una base SQL nueva y sin importar documentos locales. Por ello se retiraron los scripts y la lógica de migración de contenido, el interruptor de transición y el fallback de almacenamiento; solo permanecen las migraciones Drizzle de esquema. La operación productiva se limita a aplicar el esquema, crear usuarios/nanobooks y validar el entorno nuevo.

## Global Constraints

- Node.js `>=22.12.0`; Semantic Versioning `0.x.x`; commits `tipo(alcance): descripción`.
- Ejecutar `npm run build` antes de cada commit o tag. No crear tags ni publicar releases como parte automática del plan.
- Mantener `CHANGELOG.md` en `[Unreleased]` y documentar decisiones en `src/content/nanobook-project/`.
- Módulos primero, entorno después; presentación en `browser/ui`; servidor con `domain`, `application`, infraestructura e `index.ts`, sin capas vacías.
- No almacenar credenciales en contenido, clientes, logs ni manifiestos de importación.
- No modificar IDs, autores, propietarios o fechas implícitamente. Toda transformación de rutas, referencias y configuración histórica requiere una entrada verificable en el manifiesto.
- Cada documento/directorio pertenece a un único nanobook. No hay nanobooks anidados ni herencia de configuración entre libros o desde directorios.
- `metadata.nanobook` deja de configurar navegación; solo se lee como dato del origen durante la migración. Una carpeta movida dentro de un libro conserva su ámbito y configuración del libro.
- PATCH y renombrado no permiten cambiar `nanobookId`; la transferencia entre libros será una operación explícita posterior, fuera de este MVP.
- La migración no cambia la autenticación de Better Auth ni reemplaza las tablas existentes de usuarios/perfiles.
- No introducir escrituras dobles, réplicas locales, organizaciones ni colaboración en tiempo real.
- Cada tarea de implementación termina con sus pruebas focalizadas, actualización del changelog cuando corresponda y build. Crear commits pequeños solo cuando esté autorizada la ejecución con commits.

## Estado observado y supuestos

- `src/shared/infrastructure/database/drizzleDatabase.ts` usa `file:./data/nanobook.db`; no configura Turso remoto.
- `ContentRepository` ya abstrae filesystem/GitHub/memoria; `DocumentModule.create()` elige el proveedor globalmente.
- `Application` compone un único documento/grafo/publicador. El editor usa `/api/me/documents/<id>` en el código actual.
- `UpdateDocument` y `DeleteDocument` recorren subárboles con escrituras individuales y exigen coincidencia de `ownerId`.
- `GetAllDocuments.execute()` transforma errores de repositorio en `[]`: corregirlo para que una caída SQL no aparente una colección vacía.
- Hay cachés de contenido, de páginas y de navegador. El grafo se construye con toda la colección.
- Estado actual: `metadata.nanobook` es una frontera visual de navegación, no una identidad persistente. Decisión acordada: reemplazar esa frontera implícita por la entidad nanobook con raíz propia y eliminar la semántica de anidamiento.
- Última verificación registrada: build correcto; 169 pruebas aprobadas, 10 fallidas y una suite que no carga. Medir de nuevo al ejecutar; esos números no son evidencia futura.
- Supuesto de producto: nanobooks nuevos de propietario individual, privados por defecto. La colección importada mantiene lectura pública mediante manifiesto explícito. Equipos y permisos de edición colaborativa son una evolución independiente.
- Despliegue inicial: una instancia Node con disco persistente o conexión remota libSQL. No desplegar un archivo SQLite efímero como base compartida entre funciones/servidores.

## Review Focus

1. Dos nanobooks con la misma ruta, o un ID válido de otra colección: ninguna lectura, mutación, referencia o caché cruza la frontera (tareas 3, 5, 6).
2. Dos pestañas guardan versiones distintas y una renombra un directorio: responder 409 sin sobrescribir ni mover parcialmente (tarea 4).
3. Índices `nanobook: true` anidados, configuraciones heredadas y referencias relativas: clasificar cada frontera, conservar propiedad y comprobar la navegación/configuración resultante contra el manifiesto (tareas 3, 5, 7).
4. Fallo tras commit y antes de invalidar: la operación sigue confirmada, el evento se recupera y la caché antigua no se sirve (tareas 4, 5).
5. Corte con escrituras o importación incompleta: no activar SQL ni revertir perdiendo cambios nuevos o cuentas recién creadas (tareas 7, 9).

## Contratos y datos acordados

Identidad de colección: UUID estable `nanobookId`. Slug global, normalizado y único; no usar nombre de perfil como clave. Documento: UUID global existente y `nanobookId` obligatorio. No agregar `parentNanobookId`: no existe jerarquía entre nanobooks. Los directorios siguen representados por documentos índice; su pertenencia y ruta son internas al libro. Un enlace a otro nanobook no es un nodo hijo de su árbol.

Esquema lógico que las migraciones Drizzle deben materializar:

```sql
CREATE TABLE nanobook (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
  settings_json TEXT NOT NULL DEFAULT '{}',
  content_version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE document (
  id TEXT PRIMARY KEY,
  nanobook_id TEXT NOT NULL REFERENCES nanobook(id) ON DELETE RESTRICT,
  path TEXT NOT NULL,
  public_path TEXT NOT NULL,
  parent_path TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  raw_frontmatter TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL DEFAULT 1,
  content_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE UNIQUE INDEX document_live_path ON document(nanobook_id, path)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX document_live_public_path ON document(nanobook_id, public_path)
  WHERE deleted_at IS NULL;
CREATE INDEX document_children ON document(nanobook_id, parent_path, deleted_at);
CREATE INDEX document_owner ON document(owner_id, nanobook_id);
CREATE TABLE document_revision (
  document_id TEXT NOT NULL REFERENCES document(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
  operation TEXT NOT NULL CHECK (operation IN ('import', 'create', 'update', 'move', 'delete')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(document_id, revision)
);
CREATE TABLE content_outbox (
  id TEXT PRIMARY KEY,
  nanobook_id TEXT NOT NULL REFERENCES nanobook(id) ON DELETE RESTRICT,
  content_version INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  delivered_at INTEGER
);
```

Las columnas son autoritativas para identidad, título, descripción, propiedad y auditoría. `metadata_json` conserva tags, cover, draft, posición y ref; excluye `nanobook`, identidad y los campos autoritativos. El original completo se conserva en el snapshot externo de migración. `raw_frontmatter` preserva extensiones desconocidas salvo `nanobook`, cuya retirada se registra en el reporte; al exportar o editar se sobreponen los valores autoritativos usando el serializador existente. `public_path`/`parent_path` se derivan siempre con `DocumentPath`, dentro de la escritura transaccional. El índice de ruta pública impide colisiones `foo` frente a `foo/index`.

`settings_json` es serialización de un contrato tipado `NanobookSettings`, no un contenedor arbitrario. En la tarea 2 se inventarían los parámetros configurables actuales, se definen sus tipos/defaults y se enumeran los campos permitidos. La visibilidad permanece en su columna, y no se aceptan configuración de proveedor, credenciales ni expresiones ejecutables. No implementar resolución ascendente por directorios.

Las rutas históricas no forman parte del modelo persistente. Las rutas públicas antiguas responden `410` y no se redirigen a un nanobook, porque la instalación productiva comienza sin contenido importado ni referencias que conservar.

No borrar usuarios en cascada junto con contenido: requerir transferencia o archivado explícito. No agregar automáticamente membresías ni elevar privilegios al importar propietarios históricos.

## Task 1: Línea base y configuración de la base compartida

**Files:** modificar `src/shared/infrastructure/database/drizzleDatabase.ts`, `astro.config.mjs`, `drizzle.config.ts`, `package.json`; crear `src/shared/infrastructure/database/createDatabase.ts`, `scripts/database-migrate.ts` y `src/shared/infrastructure/database/createDatabase.test.ts`.

**Interfaces:** `createDatabase(options: { url: string; authToken?: string })` devuelve `{ client, db }` usando los tipos inferidos de libSQL/Drizzle. El módulo de entorno conecta una vez y lo inyecta. `database:migrate` aplica el journal Drizzle; no crear tablas durante un request.

- [ ] Ejecutar build y suite; registrar nombres exactos de fallos preexistentes. Resolver los que bloqueen comprobar esta migración en cambios separados.
- [ ] Escribir prueba de apertura local, cierre, constraints/FK efectivos y error explícito de conexión. Confirmar que falla antes del cambio.
- [ ] Extraer la fábrica; configurar `DATABASE_URL` con valor local por defecto y `DATABASE_AUTH_TOKEN` opcional solo en servidor. Compartir configuración entre runtime y CLI sin importar `astro:env/server` desde scripts `tsx`.
- [ ] Agregar `database:migrate`; usar migrador Drizzle compatible con el cliente instalado y probarlo dos veces sobre una copia desechable. Comprobar que el segundo intento no duplica migraciones.
- [ ] Verificar que Better Auth y perfiles siguen usando la misma base. No imprimir URLs que incluyan secretos.

```ts
const { client } = createDatabase({ url: 'file::memory:' });
expect((await client.execute('SELECT 1 AS ok')).rows[0].ok).toBe(1);
client.close();
```

Validar: `npx vitest run src/shared/infrastructure/database/createDatabase.test.ts` y pruebas actuales de autenticación/perfiles. Commit sugerido: `refactor(database): centralizar conexión y migraciones`.

## Task 2: Entidad nanobook y esquema expansivo

**Files:** crear `src/nanobooks/server/domain/Nanobook.ts`, `src/nanobooks/server/domain/ports/NanobookRepository.ts`, `src/nanobooks/server/infraestructure/database/DrizzleNanobookSchema.ts`, `src/nanobooks/server/infraestructure/repository/DrizzleNanobookRepository.ts`, su `.test.ts` y `src/nanobooks/server/index.ts`; crear `src/documents/server/infraestructure/database/DrizzleDocumentSchema.ts`; modificar `drizzle.config.ts`; generar la siguiente migración bajo `drizzle/` con su journal, sin renombrar las existentes.

**Interfaces:** `Nanobook` contiene los campos del esquema; `NanobookRepository.findById(id)`, `findBySlug(slug)`, `listByOwner(ownerId)` y `create(nanobook)` devuelven `Result`, siguiendo el repositorio de perfiles. Crear `src/nanobooks/server/domain/NanobookSettings.ts` con el contrato tipado y los defaults inventariados. No exponer un repositorio global de documentos al navegador.

- [ ] Escribir pruebas SQL reales de slug duplicado, propietario inexistente, nanobook privado por defecto y rechazo de borrado de usuario referenciado.
- [ ] Implementar esquema y repositorio; probar la migración contra una copia de la base actual y verificar que no cambia filas de usuarios/perfiles.
- [ ] Crear pruebas de rutas activas duplicadas, reutilización tras borrado lógico y colisión pública `foo`/`foo/index`.
- [ ] Inventariar los lectores actuales de configuración y de `metadata.nanobook`; documentar qué se convierte en settings del libro y qué sigue siendo metadato del documento. Probar rechazo de campos desconocidos, `parentNanobookId` y secretos en configuración. No trasladar automáticamente datos de frontmatter a settings.
- [ ] Toda modificación de settings admitida por la aplicación incrementa la versión persistida del libro e invalida su representación. Probar que dos libros con settings diferentes nunca comparten valores y que reordenar directorios no modifica ninguno.

```ts
expect((await repository.findBySlug('manual')).getValue()?.id).toBe(book.id);
expect((await repository.create({ ...book, id: otherId })).isSuccess).toBe(false);
```

Validar: `npx vitest run src/nanobooks/server/infraestructure/repository/DrizzleNanobookRepository.test.ts`. Commit: `feat(nanobooks): agregar identidad y esquema SQL`.

## Task 3: Repositorio SQL acotado y compatibilidad de documentos

**Files:** crear `src/documents/server/infraestructure/repository/DrizzleContentRepository.ts`, su `.test.ts` y `documentRowMapper.ts`; modificar `src/documents/server/domain/Document.ts`, `domain/types.ts`, `domain/ports/ContentRepository.ts`, `infraestructure/repository/index.ts`, `application/GetAllDocuments.ts`, `application/dto/SerializedEntry.ts` y los DTO/mappers HTTP relacionados.

**Interfaces:** `new DrizzleContentRepository(db, nanobookId, parser)` conserva los métodos existentes de `ContentRepository`, siempre delimitados por colección y `deleted_at IS NULL`. Los documentos y DTO incorporan `nanobookId` y `revision`; ambos se asignan/validan en servidor, nunca desde frontmatter editable.

- [ ] Escribir casos de ida/vuelta con cuerpo Markdown, caracteres Unicode, fechas exactas, frontmatter adicional, referencias y marcas de índice.
- [ ] Probar dos libros con `index` y `guide/index`, consulta por ID ajeno, rutas públicas y listado directo de hijos.
- [ ] Implementar consultas específicas por índice; `getById`, `getByPath` y `listChildren` no llaman a `list()`. Mantener `list()` para el grafo inicial, restringido a una colección.
- [ ] Mapear errores SQL al `Result` existente y conflictos de unicidad a errores de dominio. Propagar fallos de `GetAllDocuments` hasta HTTP 503; no convertirlos en éxito vacío.
- [ ] Añadir `sql` al selector temporal `CONTENT_SOURCE`; exigir `nanobookId` al crear el repositorio y aún no cambiar el proveedor de producción.
- [ ] Retirar `nanobook` de `DocumentMetadata`/DTOs activos, validadores, formulario de creación y serialización; conservar su lectura únicamente en el importador histórico. Probar que marcar un índice vía payload no crea un nanobook ni cambia el alcance de navegación.

```ts
expect((await repoA.getById(documentFromB.id)).getValue()).toBeNull();
expect((await repoA.getByPath('guide/index')).getValue()?.getContent()).toBe(markdown);
expect((await repoB.listChildren('guide')).getValue()).toEqual([]);
```

En la última prueba, B tiene índice `guide/index` pero no hijos. `parent_path` usa `getParentPath().getPublicValue()` para conservar el contrato actual; no confundirlo con `getInternalParentPath()`. Validar: `npx vitest run src/documents/server/infraestructure/repository/DrizzleContentRepository.test.ts`. Commit: `feat(documents): persistir documentos con Drizzle`.

## Task 4: Mutaciones atómicas, revisiones y conflictos

**Files:** crear `src/documents/server/domain/ports/DocumentUnitOfWork.ts`, `src/documents/server/infraestructure/database/DrizzleDocumentUnitOfWork.ts` y su `.test.ts`; modificar `CreateDocument.ts`, `UpdateDocument.ts`, `DeleteDocument.ts`, DTOs, controladores REST y pruebas de esos casos de uso; crear `src/documents/server/infraestructure/events/ContentOutboxDispatcher.ts` y su `.test.ts`.

**Interfaces:** `DocumentUnitOfWork.run(work)` recibe una función con `{ repository, appendRevision, enqueueEvent, incrementContentVersion }`, todos ligados a la misma transacción. Devuelve `Result` y revierte también cuando el callback devuelve un fallo. PATCH/DELETE requieren `expectedRevision`; discrepancia devuelve 409. La revisión leída viaja en `SerializedEntry`.

- [ ] Escribir pruebas que fallen para dos actualizaciones con la misma revisión, colisión en un descendiente y excepción a mitad de movimiento/borrado.
- [ ] Mover validación de propiedad, lectura del subárbol, comprobación de revisiones y todas las escrituras a una transacción. Releer dentro de la transacción; no persistir una lista preparada antes de adquirirla.
- [ ] Implementar actualización condicional `WHERE revision = expectedRevision`; un movimiento actualiza cada descendiente y genera sus snapshots. Borrado marca filas y conserva revisiones.
- [ ] Proteger la raíz `index` contra borrado/renombrado independiente; eliminar una colección será un flujo explícito posterior.
- [ ] Rechazar cambios de `nanobookId`, movimientos con padre fuera del libro y operaciones sobre una ruta sin padre índice válido. Probar que mover un subárbol dentro del libro no modifica `settings_json`, visibilidad ni pertenencia de sus documentos. El repositorio ordinario no expone transferencia entre colecciones.
- [ ] Escribir revisiones y outbox en la misma transacción; despachar solo después del commit. Reintentar eventos pendientes al iniciar y mediante `content:dispatch-events`; consumidores idempotentes por ID de evento.
- [ ] Si falla el despacho, conservar respuesta de escritura confirmada y marcar el evento pendiente. Usar `content_version` para impedir que la caché antigua reaparezca.

```ts
const first = await update.execute({ ...delta, expectedRevision: 1 }, actorId);
const second = await update.execute({ ...delta, expectedRevision: 1 }, actorId);
expect(first.isSuccess).toBe(true);
expect(second.isSuccess).toBe(false); // El controlador debe traducirlo a 409.
expect(await revisionCount(documentId)).toBe(2); // creación/importación + cambio
```

`revisionCount` en esa prueba consulta SQL con COUNT por `document_id`. Validar repositorio, unit of work, controladores y casos de uso. Commit: `feat(documents): guardar subárboles y revisiones atómicamente`.

## Task 5: Contexto por nanobook y aislamiento de cachés

**Files:** crear `src/application/server/NanobookContext.ts` y `.test.ts`; modificar `Application.ts`, `documents/server/index.ts`, `navigation/server/index.ts`, `navigation/server/infraestructure/DocumentsGraph.ts`, `publishing/server/index.ts`, `publishing/server/application/PagePublisher.ts`, los adaptadores en `publishing/server/infraestructure/cache/` y eventos en `documents/server/domain/events/`; actualizar componentes SSR consumidores y `documents/server/infraestructure/reference/InternalReferenceResolver.ts`.

**Interfaces:** `Application.forNanobook(nanobookId)` devuelve módulos de documentos, navegación y publicación acotados. Este método compone capacidades, no concede acceso: la capa HTTP autoriza antes de usarlo. Auth y perfiles permanecen globales. Cachés usan `(nanobookId, contentVersion, documentId, contentHash)`.

- [ ] Escribir pruebas con dos contextos concurrentes de igual ruta y eventos intercalados; ningún grafo ni render de B cambia al modificar A.
- [ ] Separar composición global y de colección. No guardar actor/sesión en singletons ni agregar suscripciones nuevas por cada request sin liberarlas.
- [ ] En cada request autorizado consultar la versión persistida de la colección. Reutilizar contexto si coincide; reconstruir solo ese libro cuando cambia. Acotar el caché de contextos y liberar handlers al desalojar.
- [ ] Delimitar referencias internas al libro. Una ruta relativa no puede resolver un documento de otra colección; mantener referencias externas existentes solo bajo configuración explícita.
- [ ] Eliminar en `NavigationService`/`DocumentsGraph` la resolución del nanobook ancestro más cercano. Breadcrumbs y sidebar usan siempre `index` del contexto; un directorio anidado conserva todos sus ancestros internos hasta esa raíz, y nunca muestra una biblioteca o nanobook externo como padre.
- [ ] Agregar pruebas con tres niveles de directorios, incluida una antigua frontera convertida a directorio: debe aparecer en el breadcrumb como directorio normal. Un libro separado no puede aparecer como hijo del grafo anterior. Un enlace explícito entre libros conserva las comprobaciones de acceso.
- [ ] Probar caída de proceso después de commit y antes de invalidación: la siguiente lectura detecta la nueva versión; el dispatcher recupera la outbox.
- [ ] Evitar que el grafo privado se comparta con lectores sin acceso. Filtrar DTOs y respuestas de contenido en servidor, no solo enlaces de UI.

```ts
expect(contextA.documentModule).not.toBe(contextB.documentModule);
expect(await htmlFor(bookA.id, 'index')).not.toContain('Contenido privado B');
```

`htmlFor` en el test realiza una solicitud SSR contra la ruta de la tarea 6 o llama al publicador del contexto autorizado. Validar: `npx vitest run src/application/server/NanobookContext.test.ts src/navigation src/publishing`. Commit: `refactor(application): aislar capacidades por nanobook`.

## Task 6: Rutas, autorización y editor consciente de colección

**Files:** crear `src/pages/n/[nanobookSlug]/[...slug]/index.astro`, `edit.astro`, `new.astro`, `preview.astro`; crear `src/pages/api/nanobooks/[nanobookId]/documents/[id].ts`; crear `src/nanobooks/server/application/AuthorizeNanobook.ts` y su `.test.ts`; modificar rutas actuales en `src/pages/[...slug]/`, `src/pages/api/me/documents/[...slug].ts`, UI de documentos/navegación, `src/documents/browser/index.ts`, `HttpDocumentWriter.ts`, `SessionStorageDocumentStorage.ts` y sus pruebas.

**Interfaces:** resolución HTTP toma colección del parámetro de ruta, sesión de Better Auth y documento del repositorio acotado. Nuevas rutas públicas `/n/<slug>/...`; API `/api/nanobooks/<id>/documents/<id>`. Las rutas públicas antiguas responden `410` y no infieren la colección a partir de un slug documental. La API antigua se retira al actualizar el editor; las solicitudes obsoletas de mutación reciben 410 y no se redirigen a otra colección.

- [ ] Escribir pruebas HTTP: anónimo en privado → 404; anónimo en público → lectura; mutación sin sesión → 401; actor autenticado sin permiso → rechazo; ID de otra colección → 404.
- [ ] Mantener `ownerId` como regla de edición en el MVP. El administrador de un nanobook importado no adquiere automáticamente permiso para editar documentos ajenos. Resolver lecturas históricas mixtas sin mostrar navegación privada de otros propietarios.
- [ ] Actualizar generador de URLs, breadcrumbs, índices, enlaces de edición y respuestas de creación/renombramiento con base de colección. Detectar colisiones con el prefijo reservado `/n` antes de publicar rutas.
- [ ] Mantener las rutas públicas antiguas como respuestas `410`; no crear resolutores ni redirecciones para rutas históricas.
- [ ] Pasar `nanobookId`, base URL y revisión al editor, evitando un `EditionModule` global que cambie de contexto mientras hay operaciones en vuelo. Rechazar respuestas tardías de otro contexto.
- [ ] Almacenar staged/preview/confirmed con prefijo versión + usuario + nanobook + documento; limpiar al salir de sesión. No recuperar automáticamente previews antiguos sin ámbito.
- [ ] Mostrar conflicto 409 conservando texto local y ofreciendo recargar/comparar. No reintentar una sobreescritura automáticamente.

```ts
expect((await requestAs(userA, `/api/nanobooks/${bookA}/documents/${docB}`, 'PATCH')).status).toBe(404);
expect((await anonymousGet(`/n/${privateSlug}/index`)).status).toBe(404);
```

Los helpers HTTP crean una sesión y solicitudes contra handlers reales; no simulan la autorización bajo prueba. Validar rutas, writer, storage y navegación cliente entre dos libros. Commit: `feat(nanobooks): enrutar y autorizar documentos por colección`.

## Task 7: Importación reproducible, inventario y verificación

**Estado:** completada durante el desarrollo local y retirada al decidir que producción comienza con una base vacía. Se conserva el historial de esta tarea en el plan, pero no hay tooling de importación en el runtime actual.

**Interfaces CLI:** `--manifest <archivo> --dry-run` por defecto; `--apply` escribe; `--verify` coteja el destino. Manifiesto incluye `source.type`, snapshot local o repo+commit inmutable, `destinations[]` (ID, raíz de origen, propietario, slug, visibilidad y settings), `boundaries[]` (índice histórico, decisión `independent` o `directory`, destino) y transformaciones aceptadas de referencias/configuración. No contiene tokens.

Ejemplo de clasificación (IDs ilustrativos; generar UUIDs una vez al preparar el manifiesto y conservarlos en los reintentos):

```json
{
  "destinations": [
    { "nanobookId": "libro-general", "sourceRoot": "index", "slug": "general" },
    { "nanobookId": "libro-arquitectura", "sourceRoot": "ingenieria/arquitectura/index", "slug": "arquitectura" }
  ],
  "boundaries": [
    { "sourceIndex": "ingenieria/index", "decision": "directory", "destination": "libro-general" },
    { "sourceIndex": "ingenieria/arquitectura/index", "decision": "independent", "destination": "libro-arquitectura" }
  ]
}
```

El esquema real exige también snapshot, propietarios, visibilidad y settings descritos arriba. Tras validar todas las decisiones, asignar cada documento a la raíz promovida más cercana; la raíz de origen residual cubre los restantes. Una raíz promovida se convierte en `index` y sus descendientes pierden solo ese prefijo. No duplicar el mismo índice en el libro anterior: desaparece de su árbol, salvo un enlace editorial agregado explícitamente. La asignación final debe cubrir cada ID exactamente una vez.

- [ ] Crear fixture con índice, índice anidado marcado nanobook, documento, referencia, metadatos adicionales y varios propietarios existentes.
- [ ] Probar ambas decisiones de cada frontera histórica; bloquear un índice marcado sin clasificación, asignaciones múltiples, documentos huérfanos, libro sin raíz y transformaciones con colisión. Emitir un reporte de rutas antiguas/nuevas, configuración efectiva antigua/nueva y cambios de breadcrumbs antes de escribir.
- [ ] Inventariar IDs y rutas duplicadas, colisiones públicas, usuarios inexistentes, fechas, frontmatter, referencias `github:`/locales, imágenes y enlaces absolutos. Cualquier ambigüedad bloquea `--apply`; no regenerar identidades ni asignar todo al operador.
- [ ] Leer documentos crudos del adaptador/parser, sin pasar por `ProxyParser`, para no reemplazar referencias por contenido renderizado. Copiar los adjuntos al destino administrado cuando dependan del origen; validar sus hashes o conservar temporalmente su disponibilidad.
- [ ] Importar en transacción por nanobook y registrar snapshot de revisión 1. Durante toda la carga no publicar destinos parciales; activar el conjunto solo al verificar todos los destinos del manifiesto. Al repetir, un ID con contenido y asignación idénticos es no-op; diferencias o ID en otra colección abortan. Nunca sobrescribir ediciones nuevas con un reintento.
- [ ] Recalcular enlaces relativos y referencias tras separar raíces. Las referencias de contenido que pasarían a otro libro bloquean la migración salvo transformación explícita aceptada; no ampliar el resolutor a toda la base. Conservar cuerpos originales y registrar hash previo/posterior si se reescriben enlaces o se materializa contenido.
- [ ] Comparar cantidad total, asignación única de IDs, cuerpos, metadatos, frontmatter adicional, padres, referencias y HTML/headings contra las transformaciones aceptadas. Sin transformaciones de cuerpo, exigir igualdad de SHA-256. Verificar navegación/configuración esperadas para promoción y conversión a directorio. Escribir reporte JSON sin secretos y distinguir cambios aprobados de pérdidas inesperadas.
- [ ] Probar exportación de regreso a Markdown/frontmatter con identidad, rutas y metadatos preservados; documentar cómo representar borrados lógicos.

```ts
await importSnapshot(manifest, { apply: true });
await importSnapshot(manifest, { apply: true });
expect(await liveDocumentCount(bookId)).toBe(sourceCount);
expect((await verifySnapshot(manifest)).differences).toEqual([]);
```

La validación de `importSnapshot`/`verifySnapshot` se ejecutó durante el desarrollo local y sus implementaciones fueron retiradas al decidir que producción comienza vacía. No se conserva un comando de importación en la aplicación desplegable.

## Task 8: Crear y administrar nanobooks sin infraestructura visible

**Files:** crear `src/nanobooks/server/application/CreateNanobook.ts`, `ListOwnedNanobooks.ts`, sus pruebas, `src/nanobooks/server/infraestructure/rest/NanobookController.ts`; crear `src/pages/api/nanobooks/index.ts`, `src/pages/nanobooks/index.astro`, `src/pages/nanobooks/new.astro`; crear `src/nanobooks/browser/ui/NanobookList.astro`, `NanobookForm.astro` y `src/nanobooks/browser/HttpNanobookApi.ts`; actualizar navegación global/perfil.

**Interfaces:** `CreateNanobook.execute({ name, slug, visibility }, actorId)` crea libro, settings propios por defecto y documento raíz `index` en una sola transacción. `ListOwnedNanobooks.execute(actorId)` solo lista colecciones propias. El cliente nunca manda `ownerId`, parentNanobookId ni credenciales.

- [ ] Escribir pruebas: crear libro+índice, rollback cuando falla el índice, slug duplicado, sesión ausente e intento de cambiar propietario por payload.
- [ ] Implementar selección de nombre, slug y visibilidad con privado por defecto. Después de crear, abrir el editor del índice del nuevo libro.
- [ ] Ofrecer listado propio y acceso a los libros importados para sus usuarios autorizados. No exponer selección de SQL/GitHub/Turso ni configuración de almacenamiento.
- [ ] Distinguir las acciones «Crear nanobook» (listado de libros) y «Crear directorio» (editor dentro del libro). Retirar el selector que marca un índice como nanobook. No ofrecer crear un libro dentro de otro ni transferencias encubiertas mediante renombrado.
- [ ] Probar manualmente crear dos nanobooks, escribir la misma ruta en ambos, navegar, guardar, reiniciar servidor y verificar persistencia.

```ts
const result = await createNanobook.execute({ name: 'Notas', slug: 'notas', visibility: 'private' }, actorId);
expect(result.isSuccess).toBe(true);
expect(await rootOwner(result.getValue().id)).toBe(actorId);
```

`rootOwner` consulta la fila raíz de la colección creada. Validar pruebas de casos de uso/HTTP y flujo Astro. Commit: `feat(nanobooks): crear colecciones desde la interfaz`.

## Task 9: Corte, recuperación y comparación de latencia

**Files:** crear `docs/operations/content-sql-deployment.md`; modificar `src/documents/server/infraestructure/repository/index.ts`, `src/application/server/Application.ts`, `astro.config.mjs`, `package.json`, `CHANGELOG.md` y la especificación arquitectónica. El benchmark comparativo se retiró porque producción ya no usa GitHub como fuente de contenido.

- [ ] En entorno de ensayo ejecutar una copia consistente de migraciones, simulación, importación, verificación y exportación. No copiar un SQLite activo ignorando su WAL: usar backup consistente o detener escrituras.
- [ ] Verificar disco persistente si es local; si es remoto, probar conexión libSQL, TLS, migraciones, transacciones y recuperación con las credenciales de ensayo. No asumir que cambiar URL garantiza compatibilidad completa con otro motor.
- [ ] Medir desde el mismo servidor 1.000 lecturas por ID y 1.000 listados de hijos, concurrencia 1 y 10, en corpus idéntico. Reportar p50/p95/p99, errores, bytes, llamadas de red y arranque; separar caché fría/caliente y tiempo de renderizado. Elegir mejora de p95 frente a GitHub sin caché como criterio, sin prometer cifras absolutas.
- [ ] Antes del corte real: backup verificable, congelar mutaciones, detener webhook/importadores antiguos, fijar commit SHA o snapshot final y repetir importación/verificación. El operador autoriza el cambio de producción con reportes concretos.
- [ ] Activar SQL y comprobar login, perfil, rutas canónicas, crear/editar/renombrar/borrar, referencias, cachés y permisos antes de reabrir escrituras. Definir `/` como listado de nanobooks públicos accesibles. Fallar explícitamente si SQL no está disponible; nunca caer silenciosamente al filesystem.
- [ ] Antes de reabrir escrituras, rollback = volver al proveedor congelado. Después, rollback = bloquear escrituras, exportar cambios SQL y reconciliar altas/cambios/borrados en el origen o restaurar un backup SQL más replay. No restaurar toda la base antigua: también contiene cuentas y sesiones que pudieron cambiar.
- [ ] Ensayar un restore de backup, una caída después de commit, 409 concurrente y recuperación de outbox. Conservar snapshot y exportaciones hasta aceptar formalmente el corte.

```powershell
npm run database:migrate
npm run database:migrate
npm run build
```

No ejecutar estos comandos hasta que existan las tareas anteriores y se hayan seleccionado explícitamente origen y destino. Commit: `feat(storage): activar SQL como persistencia principal`.

## Task 10: Retirada del proveedor global y cierre

**Estado:** el webhook de contenido, el fallback de composición, los comandos de migración y el benchmark GitHub fueron retirados. `GitHubRepository`, `FileSystemRepository` y los resolutores `github:` se conservan solo como adaptadores explícitos para pruebas o referencias externas; no participan en la persistencia de nanobooks de producción.

- [ ] Quitar GitHub de la composición normal y retirar el webhook de sincronización del proveedor antiguo después de aceptar el corte. Conservar importadores/exportadores explícitos; no eliminar archivos fuente ni historial por defecto.
- [ ] No borrar GitHub OAuth de autenticación al retirar almacenamiento. Separar sus variables de los tokens de contenido. Revisar referencias externas `github:` antes de eliminar su resolutor o credencial.
- [ ] Buscar lectores/escritores activos de `metadata.nanobook` y resolución ascendente de configuración: no deben quedar fuera de fixtures históricas/importadores. Exportar cada nanobook a una carpeta independiente con sus settings en un manifiesto de exportación; no reintroducir marcas anidadas en el frontmatter.
- [ ] Corregir o retirar comandos existentes `content:status`/`content:render` que apuntan a `scripts/content.ts` inexistente; reemplazarlos por herramientas realmente implementadas y probadas.
- [ ] Confirmar con búsqueda y prueba de lectura que servir/editar documentos SQL no llama a GitHub. Las referencias externas permitidas se reportan como excepción explícita, no como dependencia oculta.
- [ ] Ejecutar pruebas nuevas y suite completa; registrar fallos preexistentes por nombre y exigir cero regresiones. Build obligatorio. Actualizar estado de la especificación de propuesta a implementada solo al completar todos los criterios.

```powershell
npm test
npm run build
git diff --check
```

Commit: `refactor(storage): retirar dependencia de GitHub para contenido`.

## Criterios de aceptación del conjunto

- Crear y editar nanobooks sin conectar un proveedor ni introducir credenciales.
- Usuarios, perfiles, libros y documentos persisten en la misma base administrada por la instancia.
- Cada nanobook tiene árbol y configuración propios; no se pueden anidar ni cambiar de pertenencia mediante PATCH. Los movimientos internos conservan el ámbito del libro.
- Todos los índices históricos marcados están clasificados explícitamente; los IDs y propietarios se conservan, y rutas, referencias, cuerpos y configuración corresponden al manifiesto aceptado. Las URLs históricas siguen resolviendo bajo autorización vigente.
- Breadcrumbs y sidebar se detienen en la raíz explícita del libro; los directorios normales ya no crean fronteras de configuración/navegación.
- Colecciones privadas y documentos ajenos no se filtran por API, navegación, caché, preview ni referencias.
- Renombrado y borrado de subárbol son atómicos; dos ediciones no sobrescriben silenciosamente; las revisiones sobreviven al borrado lógico.
- Una caída de base produce un error explícito. Una caída tras commit no pierde escrituras ni deja caché obsoleta visible.
- Importación repetible y reporte sin diferencias; backup y recuperación ensayados; rollback posterior a escrituras preserva esos cambios.
- Build aprobado y cero fallos nuevos respecto de la línea base documentada.

## Secuencia y puntos de decisión

Ejecutar 1–4 para persistencia; 5–6 para aislamiento; 7 para migración; 8 para experiencia de usuario; 9–10 para corte y limpieza. No activar funcionalidades parciales que permitan mezclar colecciones. Antes de producción, confirmar el despliegue, la clasificación de cada nanobook anidado histórico, configuración/visibilidad de destinos y transformaciones de referencias. Son datos necesarios para migrar contenido real; el desarrollo local usa fixtures explícitas y puede avanzar sin esas decisiones particulares.

Revisión del plan realizada: cada requisito de la especificación tiene tarea; las cinco condiciones de Review Focus tienen pruebas asignadas; los identificadores de rutas/API coinciden con los observados y los propuestos se distinguen de los existentes. Los ejemplos de pruebas son guías para fixtures reales, no sustituyen las pruebas transaccionales y HTTP indicadas.
