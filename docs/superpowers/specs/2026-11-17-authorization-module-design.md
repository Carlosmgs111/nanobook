# Módulo `authorization`: punto único de decisión de acceso

Fecha: 2026-11-17
Estado: propuesto (revisión 2)

## Problema

Hoy hay tres decisiones de acceso, cada una en un sitio distinto:

| Dónde | Qué decide |
| --- | --- |
| `nanobooks` (`AuthorizeNanobook`, `RequireNanobookAccess`, `NanobookWriteAccess`) | Quién lee un nanobook (público o dueño) y quién escribe (dueño). Se inyecta en `documents` mediante el puerto `WriteAccess`. |
| `documents` (`AuthorizeDocumentAccess`, `canWrite`) | Si un documento protegido exige contraseña. Para saber si el lector es escritor, reutiliza `WriteAccess`. |
| Rutas, páginas y agentes (`withNanobookWriteAccess`, `protectNanobookWriteMutation`, `resolveNanobookRoute`, `unlock.ts`, `DocumentPage.astro`, `AgentToolService`) | Vuelven a comprobar la lectura o la escritura, cada uno con su propio mapeo de errores. |

Consecuencias:

- Hay comprobaciones duplicadas en las mutaciones.
- Cada regla nueva (roles, colaboradores, agentes) obliga a tocar varios módulos.
- Cada consumidor traduce los errores de acceso a su manera.

## Objetivo

Un módulo pequeño que toma las decisiones de acceso. Cada módulo aporta sus criterios como políticas y recibe una respuesta.

Requisitos:

- Lo puede usar cualquier módulo sin modificar `authorization`.
- Falla cerrado: nunca concede por omisión, por error ni por mala composición.
- Es simple: un contrato, un motor y un registro. No hay DSL de reglas, roles genéricos ni motor de políticas externo.

Fuera de alcance:

- Roles y colaboradores.
- Permisos por documento distintos de la contraseña.
- Identidades de agente separadas del usuario.
- Navegación. `restrictSecuredNavigation` ya redacta los documentos protegidos (título, ruta y candado) de forma intencional. Además, el grafo se cachea por nanobook y no por sujeto. Se mantiene como está.

## Diseño

### Ubicación

`src/authorization/server/`, con dos capas:

- `domain/` contiene los tipos, el contrato de política y los errores.
- `application/` contiene el motor.

El compositor es `index.ts`. El módulo **no importa** `nanobooks` ni `documents`. Las dependencias apuntan hacia `authorization`.

### Contrato

```ts
type Subject = {
  /** Perezoso y memoizado por quien construye el sujeto: solo se resuelve la sesión si una política la necesita. */
  userId(): Promise<string | undefined>;
  /** Credenciales presentadas, p. ej. tokens de desbloqueo por documento. */
  grantFor(resourceId: string): string | undefined;
};

type Action = "read" | "write";

type Resource = {
  type: string;                                   // "nanobook", "document"... lo define cada módulo
  id: string;
  nanobookId?: string;
  attributes?: Readonly<Record<string, unknown>>;
};

type AccessRequest = { subject: Subject; action: Action; resource: Resource };

type Decision =
  | { effect: "allow" }
  | { effect: "abstain" }                         // la política no opina sobre esta petición
  | { effect: "deny"; reason: "unauthenticated" | "forbidden" | "not-found" }
  | { effect: "challenge"; kind: "password" };

type Authorize = (request: AccessRequest) => Promise<Decision>;

interface Policy {
  appliesTo: readonly string[];                   // tipos de recurso
  evaluate(request: AccessRequest, authorize: Authorize): Promise<Decision>;
}
```

Notas:

- `Resource.type` es un `string`, así que un módulo nuevo define sus tipos sin tocar `authorization`.
- `Subject.anonymous()` es un helper que devuelve un sujeto sin usuario y sin grants.

### Motor

```ts
interface Authorizer {
  authorize(request: AccessRequest): Promise<Decision>;
  require(request: AccessRequest): Promise<Result<AccessDeniedError | AccessCheckFailedError, void>>;
}
```

Reglas de `authorize`:

1. Se seleccionan y evalúan todas las políticas cuyo `appliesTo` incluye `resource.type`.
2. Combinación, en este orden:
   - Si alguna da `deny`, gana el primero en orden de registro.
   - Si no, y alguna da `challenge`, el resultado es `challenge`.
   - Si no, y alguna da `allow`, el resultado es `allow`.
   - Si no hay políticas, o todas dan `abstain`, el resultado es `deny("forbidden")`.

   Conceder exige al menos un `allow` explícito. Una política que no se registró, o que no declara un tipo de recurso, nunca abre el acceso.
3. **Errores técnicos.** Si una política lanza una excepción o rechaza la promesa, `authorize` **lanza** `AccessCheckFailedError` con la causa original. Nunca la convierte en `allow`, y tampoco en un `deny` silencioso: una caída de la base de datos es un 500, no un 403.
   - `require` captura esa excepción y la devuelve como `Result.fail`.
   - Los consumidores que usan `authorize` directamente la dejan propagar. La traducen a 500 en el borde: el `catch` del controlador, la página o la herramienta MCP.
4. **Consultas entre políticas.** Cada política recibe `authorize` para consultar otra acción sobre el mismo recurso. Por ejemplo, la de contraseña pregunta si el sujeto puede escribir. Una política solo puede consultar acciones que no la lleven de vuelta a sí misma. Hoy la única consulta es la de `read` a `write`, y la política de contraseña se abstiene en `write`.

`require` devuelve:

- `ok` cuando la decisión es `allow`.
- `fail(AccessDeniedError)` cuando la decisión es `deny` o `challenge`. El error conserva la decisión.
- `fail(AccessCheckFailedError)` cuando hubo un error técnico.

### Traducción HTTP y MCP

Hay un único helper, `accessErrorResponse(error)`, en `authorization/server/infrastructure/http.ts`:

| Error | Respuesta |
| --- | --- |
| `deny("unauthenticated")` | 401 |
| `deny("forbidden")` | 403 |
| `deny("not-found")` | 404 |
| `challenge` | 401 con `{ challenge: "password" }` |
| `AccessCheckFailedError` | 500 |

`McpToolResult` mapea los mismos errores a resultados de herramienta. Las páginas SSR reutilizan los códigos, y en el caso de `challenge` muestran el formulario de desbloqueo.

### Registro

`createAuthorizer(policies: Policy[])` devuelve el `Authorizer`. Se compone en `src/application/server/` y se inyecta en los módulos que lo usan.

## Políticas iniciales

### `nanobooks`: dueño y visibilidad

Archivo: `src/nanobooks/server/application/NanobookAccessPolicy.ts`. Sustituye a `AuthorizeNanobook`, `RequireNanobookAccess`, `NanobookWriteAccess` y `withNanobookWriteAccess`.

- `appliesTo: ["nanobook", "document"]`. Para `document` usa `resource.nanobookId`. Si falta, la decisión es `deny("forbidden")`.
- Carga el nanobook por id a través de la caché de lectura existente. El dueño y la visibilidad nunca se leen de `attributes`.
- Solo llama a `subject.userId()` cuando la decisión depende del usuario. La lectura de un nanobook público no resuelve la sesión.

Orden de evaluación:

1. En `write`, si no hay usuario, la decisión es `deny("unauthenticated")`. Se comprueba **antes** de cargar el nanobook, así un anónimo no puede distinguir un nanobook privado de uno inexistente.
2. Después se carga el nanobook.
3. Por último se aplica la tabla.

| Caso | Decisión |
| --- | --- |
| El nanobook no existe | `deny("not-found")` |
| `read`, nanobook público | `allow` |
| `read`, el sujeto es el dueño | `allow` |
| `read`, otro sujeto | `deny("not-found")`, para no revelar que existe |
| `write`, el sujeto es el dueño | `allow` |
| `write`, nanobook privado y el sujeto no es el dueño | `deny("not-found")`, para no permitir enumerar nanobooks privados |
| `write`, nanobook público y el sujeto no es el dueño | `deny("forbidden")` |

### `documents`: protección por contraseña

Archivo: `src/documents/server/application/access/DocumentPasswordPolicy.ts`. Sustituye a `AuthorizeDocumentAccess`, `canWrite` y el puerto `WriteAccess`.

- `appliesTo: ["document"]`.
- En `write` devuelve `abstain`.
- En `read` lee `attributes.securedIds`, que contiene los eslabones protegidos de la cadena de proxies.

**`securedIds` solo lo construye un helper.** `documentResource(nanobookId, raw, resolved)` vive en `documents` y es la única forma de crear un `Resource` de tipo `document` para lectura. Calcula `securedIds` con `securedDocuments([raw, resolved])` y no se exporta fuera del módulo. Si `securedIds` falta o no es un array, la política devuelve `deny("forbidden")`.

Decisiones en `read`:

| Caso | Decisión |
| --- | --- |
| `securedIds` vacío | `abstain`. Decide la política de `nanobooks`. |
| `authorize({ ...request, action: "write" })` da `allow` | `abstain`, porque el escritor no necesita contraseña |
| Algún eslabón sin grant válido (`subject.grantFor(id)`) | `challenge("password")` |
| Todos los eslabones con grant válido | `abstain` |

Un grant es válido si está firmado, no ha expirado, corresponde al documento y coincide con la versión de contraseña actual. Un fallo del repositorio o un hash ausente lo invalidan. Es la misma lógica que tiene hoy `hasValidGrant`.

Como la política nunca devuelve `allow`, no puede conceder acceso por sí sola. Solo restringe lo que concede la política de `nanobooks`.

Se quedan en `documents`, porque son datos y escritura, no decisiones: `UnlockDocument`, `SetDocumentPassword`, `ClearDocumentPassword`, `ScryptPasswordHasher`, `HmacAccessGrantCodec`, el limitador de intentos y el repositorio de acceso.

## Dónde se comprueba

La comprobación ocurre **una sola vez, en los casos de uso**. Así HTTP, páginas SSR y herramientas MCP quedan bajo la misma regla.

| Consumidor | Llamada |
| --- | --- |
| `CreateDocument`, `UpdateDocument`, `DeleteDocument` | `require(write, { type: "document", id, nanobookId })` |
| `SetDocumentPassword`, `ClearDocumentPassword` | `require(write, documento)` |
| `ReadDocument` | `authorize(read, documentResource(...))`. `allow` devuelve el documento. `challenge` devuelve la variante redactada actual. `deny` se trata como documento no encontrado, con la misma variante de resultado que un path inexistente. Un `AccessCheckFailedError` se propaga. |
| `ListReadableDocuments` | `authorize(read, documentResource(...))` por documento. `allow` incluye el documento. `challenge` produce el documento redactado (`raw.redacted()`). `deny` lo excluye. Un `AccessCheckFailedError` se propaga y deja de producir `[]`. |
| `UnlockDocument` | `require(read, { type: "nanobook", id })` con `Subject.anonymous()`. Así un nanobook privado responde 404 y no sirve para probar contraseñas, como hoy en `unlock.ts`. |
| `UpdateNanobook`, `DeleteNanobook`, `SetNanobookTheme` | `require(write, { type: "nanobook", id })` |
| `AgentToolService` (MCP) | `require(read \| write, { type: "nanobook", id })`. Después carga el nanobook con un nuevo caso de uso, `GetNanobookById`, que se apoya en la caché de lectura existente y se crea en la etapa 2. |
| `resolveNanobookRoute` | Carga por slug y luego `authorize(read \| write, nanobook)` con sujeto perezoso. La política vuelve a cargar el nanobook por id, lo que es un acierto de caché. Las respuestas salen de `accessErrorResponse`. |
| `DocumentPage.astro` (mostrar u ocultar la edición) | `authorize(write, nanobook)` en lugar de `new AuthorizeNanobook().canWrite` |

Capa HTTP y páginas:

- Construyen el `Subject` a partir de la sesión (perezosa) y de las cookies de grant.
- Traducen los errores con `accessErrorResponse`.
- No vuelven a evaluar permisos. `RouteProtector` (CSRF y origen) se mantiene, porque no es una decisión de acceso.

## Migración por etapas

Cada etapa deja `npm run build` y `npx vitest run` en verde. El código viejo **solo se borra en la etapa 5**, cuando ya no tiene consumidores.

**Iteraciones:**

- **Iteración 1 (alcance actual): solo la etapa 1.** Se crea el módulo `authorization` con su contrato, el motor, los errores, `accessErrorResponse` y los tests del motor. No se registra ninguna política ni se modifica ningún otro módulo.
- **Iteraciones siguientes: etapas 2 a 5.** Comprenden las políticas, el cableado, la migración de consumidores y la limpieza. Cada iteración tendrá su propio plan.

1. **Módulo `authorization`:** tipos, `createAuthorizer`, errores, `accessErrorResponse` y los tests del motor. No tiene consumidores todavía.
2. **Política de `nanobooks`:**
   - Crear `NanobookAccessPolicy` y `GetNanobookById`. Registrar la política e inyectar `Authorizer`.
   - Migrar `UpdateNanobook`, `DeleteNanobook`, `SetNanobookTheme`, `AgentToolService`, `McpToolResult`, `resolveNanobookRoute` y `DocumentPage.astro`.
   - `RequireNanobookAccess` y `AuthorizeNanobook` siguen existiendo para quienes aún no han migrado.
3. **Política de `documents`:**
   - Crear `DocumentPasswordPolicy` y `documentResource`, y registrarlos.
   - Migrar `CreateDocument`, `UpdateDocument`, `DeleteDocument`, `ReadDocument`, `ListReadableDocuments`, `SetDocumentPassword`, `ClearDocumentPassword` y `UnlockDocument`.
   - Migrar los controladores de `documents` a `accessErrorResponse`, en la misma etapa, para que una denegación nunca caiga en la rama genérica de error. Son `infraestructure/rest/utils.ts` (`handleServiceError`), `DocumentAccessAdminController` y `UnlockDocumentController`. Sus tests (`Create/Update/DeleteDocumentController.test.ts` y `DocumentAccessControllers.test.ts`) pasan a usar `AccessDeniedError`.
   - El puerto `WriteAccess` deja de usarse.
4. **Rutas:** quitar `withNanobookWriteAccess` y `protectNanobookWriteMutation` de `pages/api/nanobooks/[nanobookId]/documents/[id].ts` y `document-access/index.ts`. Quitar el chequeo propio de `document-access/unlock.ts`. Todas usan `accessErrorResponse`.
5. **Limpieza y documentación:**
   - Borrar `AuthorizeNanobook`, `RequireNanobookAccess`, `NanobookWriteAccess`, `withNanobookWriteAccess`, `WriteAccess`, `WriteAccessDeniedError`, `canWrite`, `AuthorizeDocumentAccess` y `loadWritableDocument` si queda vacío.
   - Documentar la decisión en `src/content/nanobook-project/arquitectura/` y actualizar o retirar `autenticacion-servidor-decorador-capacidades.md`.

## Pruebas

La batería es reducida, con un archivo `X.test.ts` junto a cada pieza.

**Motor** (`authorization/server/application/Authorizer.test.ts`):
- `deny` gana sobre `challenge`, y `challenge` gana sobre `allow`.
- Sin políticas, o con todas en `abstain`, el resultado es `deny`.
- Una política que lanza da `AccessCheckFailedError` y nunca `allow`.
- `require` conserva la decisión en el error.

**`NanobookAccessPolicy`:**
- Dueño frente a ajeno en `write`, tanto en un nanobook público (`forbidden`) como en uno privado (`not-found`).
- Anónimo en `write` da `unauthenticated`, sea el nanobook privado o inexistente.
- Público frente a privado en `read`.
- La lectura de un nanobook público no llama a `userId()`.

**`DocumentPasswordPolicy`:**
- Sin eslabones protegidos da `abstain`.
- El escritor pasa sin grant.
- Un grant válido da `abstain`.
- Sin grant, con grant de otra versión o con grant expirado da `challenge`.
- Si faltan `securedIds`, el resultado es `deny`.
- `documentResource` con un proxy público a un destino protegido produce un `challenge`.

**Por flujo**, con `Authorizer` real y repositorios en memoria:
- Un autor ajeno no puede crear, actualizar ni borrar un documento.
- Un lector anónimo de un documento protegido recibe la versión redactada, tanto en lectura como en listado.
- El desbloqueo en un nanobook privado responde `not-found`.
- Una herramienta MCP de escritura con un usuario ajeno es rechazada.
- Un fallo del repositorio de nanobooks produce un 500 y no un 403.

## Riesgos y límites aceptados

- **Evaluación elemento a elemento.** Los listados se evalúan uno a uno. La política de `nanobooks` se apoya en la caché de lectura, así que el coste por elemento es bajo. Si hiciera falta, la política puede precargar por lote sin cambiar el contrato.
- **Cambios de respuesta HTTP.** Al centralizar la traducción, algunos códigos cambian. El caso principal es el `write` de un ajeno sobre un nanobook privado, que pasa de 403 a 404. Los tests por flujo fijan los códigos esperados.
- **Recursión entre políticas.** Se evita por la regla de diseño de la sección del motor. No se añade un guardián en el motor.
- **Confianza en `documentResource`.** `securedIds` depende de que el recurso se construya con `documentResource`. Mitigación: es la única vía de creación, está cubierto por tests de flujo y no se exporta fuera de `documents`.
