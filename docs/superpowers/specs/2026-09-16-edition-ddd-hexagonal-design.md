# Diseño DDD y hexagonal para `edition`

**Estado:** propuesto para revisión

## Objetivo

Reorganizar el módulo `edition` para separar reglas de edición, casos de uso y dependencias del navegador, sin cambiar las rutas existentes, el contrato HTTP ni el formato de los borradores ya almacenados en `sessionStorage`.

No se introduce una nueva capacidad de producto. En particular, la vista previa actual, CodeMirror, el guardado de documentos y la creación de documentos conservan su comportamiento.

## Contexto y límites actuales

Los componentes Astro de edición importan directamente funciones que combinan:

- reconstrucción de un documento desde Markdown y frontmatter;
- estado transitorio del borrador y del resultado renderizado;
- `sessionStorage`, `BroadcastChannel` y el worker de publicación;
- peticiones `POST` y `PATCH` a la API;
- gestión de navegación dentro del flujo `view → edit → preview`.

Esa mezcla dificulta probar reglas de negocio sin APIs de navegador y hace que la interfaz sea responsable de coordinación de aplicación.

La responsabilidad del módulo termina en la experiencia local de edición. El módulo `document` sigue siendo dueño de las reglas de persistencia del contenido y `publishing` sigue siendo dueño del renderizado y la invalidación de páginas publicadas.

## Arquitectura objetivo

```text
Astro UI / controladores de navegador
       │
       ▼
edition/application (casos de uso)
       │
       ├── edition/domain (reglas y puertos)
       │
       ▼
edition/infraestructure (adaptadores de navegador)
       │
       ├── sessionStorage / BroadcastChannel
       ├── fetch a la API de documentos
       ├── worker de publicación
       └── CodeMirror y parser YAML
```

La dirección de dependencias siempre apunta hacia dentro. `domain` no importa Astro, DOM, `fetch`, `sessionStorage`, CodeMirror, el worker ni clases concretas de `document` o `publishing`.

## Modelo de dominio

`EditionDraft` representa la revisión local de un `SerializedEntry` junto con el Markdown fuente. Expone operaciones puras para:

- reemplazar la fuente y producir el documento serializado con frontmatter;
- comparar revisiones para decidir si un render sigue siendo vigente;
- decidir si una URL pertenece al flujo del mismo documento.

El dominio conserva el formato actual de `SerializedEntry`. No duplica la entidad `Document` ni replica las validaciones autoritativas de `document`; esas se ejecutan en la API al crear o guardar.

## Puertos

```ts
interface DraftStore {
  load(): SerializedEntry | null;
  save(document: SerializedEntry): void;
  clear(): void;
  markSaved(): void;
  clearSavedMark(): void;
  savedAt(): number | null;
}

interface EditionRenderer {
  render(document: SerializedEntry): Promise<RenderedDocument | null>;
  rendered(): RenderedDocument | null;
  renderedSource(): SerializedEntry | null;
  clear(): void;
}

interface DocumentWriter {
  create(request: CreateDocumentRequest): Promise<SerializedEntry>;
  update(id: string, document: SerializedEntry): Promise<void>;
}

interface PageWarmer {
  warm(href: string): Promise<void>;
}
```

Los puertos se declaran en `edition/domain/ports`. Cada uno expresa una necesidad de aplicación; ninguno revela una API de plataforma.

## Casos de uso

- `PrepareEdition`: obtiene o inicializa el borrador correcto para un documento abierto y descarta uno que pertenece a otro documento.
- `UpdateDraft`: reconstruye el borrador desde Markdown, lo guarda localmente, elimina su marca de guardado y solicita el render.
- `SaveEdition`: reconstruye el borrador, lo persiste por `DocumentWriter`, lo marca como guardado, precalienta la página opcionalmente y solicita el render actualizado.
- `RenderEdition`: coordina render en curso, cache local y descarte de resultados que no correspondan al borrador vigente.
- `CreateEditionDocument`: construye el identificador de documento o índice desde el formulario y delega su creación a `DocumentWriter`.
- `LeaveEdition`: determina cuándo limpiar el borrador y los resultados renderizados al salir del flujo del documento.

Los casos de uso reciben sus dependencias por constructor o argumento. Los errores de HTTP o render se propagan como errores de aplicación para que la UI los presente; el calentamiento de página permanece deliberadamente no bloqueante.

## Adaptadores e interfaz

```text
src/edition/
  domain/
    EditionDraft.ts
    EditionFlow.ts
    ports/
      DraftStore.ts
      EditionRenderer.ts
      DocumentWriter.ts
      PageWarmer.ts
  application/
    PrepareEdition.ts
    UpdateDraft.ts
    SaveEdition.ts
    RenderEdition.ts
    CreateEditionDocument.ts
    LeaveEdition.ts
  infraestructure/
    storage/SessionStorageDraftStore.ts
    render/WorkerEditionRenderer.ts
    api/HttpDocumentWriter.ts
    navigation/BrowserPageWarmer.ts
    parse/YamlDraftParser.ts
    editor/CodeMirrorEditor.ts
  ui/
    components/
    pages/
  index.ts
```

`index.ts` actúa como composition root de navegador: ensambla los adaptadores y expone una fachada de edición para los scripts Astro. Los componentes quedan limitados a obtener datos del DOM, escuchar eventos, aplicar debounce, navegar y mostrar estados.

Se mantendrán módulos de compatibilidad durante la migración cuando reduzcan el riesgo para los scripts existentes, y se eliminarán solo después de mover todos sus consumidores. Las claves `stagedDocument`, `stagedDocumentSavedAt`, `renderedStagedDocument`, `renderedStagedDocumentSource` y `renderPendingDocument` se preservan inicialmente para no descartar una sesión ya abierta.

## Flujo de datos

1. La UI obtiene una fachada compuesta en `edition/index.ts`.
2. Al editar, llama a `UpdateDraft`; este genera el documento desde la fuente, persiste el borrador y renderiza mediante los puertos.
3. Al guardar, llama a `SaveEdition`; la escritura HTTP confirma el documento y solo entonces se marca el borrador como guardado.
4. La página pública solo aplica HTML en memoria cuando la fuente renderizada coincide exactamente con la revisión guardada.
5. Al navegar fuera del flujo del documento, `LeaveEdition` limpia los datos de edición.

## Pruebas y aceptación

Antes de cada extracción se añadirá una prueba unitaria que falle contra el contrato deseado. La suite debe cubrir:

- reconstrucción de frontmatter y preservación de campos no editados;
- aislamiento de borradores por identificador de documento;
- eliminación de la marca de guardado al cambiar contenido;
- guardado solo después de que `DocumentWriter` confirme;
- rechazo de HTML de una revisión distinta;
- determinación de salidas del flujo de edición;
- mapeo de requests de los adaptadores HTTP.

La verificación final ejecutará `npm test` y `npm run build`.

## Decisiones y trade-offs

- Se conserva `SerializedEntry` como DTO de borde para evitar duplicar el agregado `Document`; introducir una segunda entidad autoritativa en `edition` sería una fuente de divergencia.
- El parseo YAML se encapsula como adaptador para que el modelo no dependa de una biblioteca ni de detalles de serialización.
- CodeMirror queda como adaptador de UI porque es una dependencia de navegador intercambiable, no una regla de edición.
- No se modifica todavía el motor de renderizado ni se añade preview lateral; esas decisiones pertenecen al diseño ya existente de preview en vivo y exceden este refactor.

## Fuera de alcance

- Cambiar las rutas, endpoints o payloads actuales.
- Modificar el dominio `document` o `publishing`.
- Reemplazar CodeMirror, agregar colaboración, bloques visuales o plugins.
- Cambiar las claves existentes de almacenamiento de navegador.
