# Authorization

> Motor único y genérico que decide si un sujeto puede leer o escribir un recurso, combinando políticas que registra cada módulo dueño del recurso.

**Nivel:** Núcleo  ·  **Entornos:** server

## Qué hace
- Decide todo el acceso de la aplicación: `Authorizer.authorize` (devuelve la decisión) y `Authorizer.require` (devuelve `Result`, solo `ok` si la decisión es `allow`).
- Combina las decisiones de todas las políticas aplicables a un tipo de recurso (`Policy.appliesTo`) con regla de falla cerrada.
- Define el contrato (`Subject`, `Resource`, `Action`, `Decision`, `Policy`) y los errores (`AccessDeniedError`, `AccessCheckFailedError`).
- Traduce cualquier error de acceso a una respuesta HTTP única (`accessErrorResponse`).
- Resuelve la sesión del `Subject` de forma perezosa: solo si una política la necesita.

No hace: no conoce reglas de negocio (dueño, visibilidad, contraseñas viven en políticas de otros módulos), no autentica (eso es `auth`), no importa módulos de negocio (solo `shared/domain/Result`).

## Cómo está construido
```text
authorization/server/
  index.ts                         # API pública del módulo
  domain/
    types.ts                       # Subject, Resource, Action, Decision, Policy, Authorize, AccessRequest
    errors.ts                      # AccessDeniedError, AccessCheckFailedError
  application/
    createAuthorizer.ts            # motor: Authorizer, Authorization, createAuthorizer, combine()
  infrastructure/
    http.ts                        # accessErrorResponse
```
- **domain:** `Subject` (`userId()` perezoso, ejecutado una sola vez; `grantFor(resourceId)` para credenciales como el token de desbloqueo de un documento) con fábricas `Subject.anonymous()` y `Subject.of(userId | () => Promise, grantFor?)`. `Decision` = `allow | abstain | deny(reason) | challenge(kind: "password")`; `DenyReason` = `unauthenticated | forbidden | not-found`. `ResolvedDecision` excluye `abstain`.
- **application:** `createAuthorizer(initialPolicies = [])` devuelve `Authorization` (= `Authorizer` + `register(policy)`). Reglas de `combine`: cualquier `deny` gana; sin `deny`, `challenge` gana sobre `allow`; conceder exige al menos un `allow`; sin políticas aplicables o todas en `abstain` es `deny(forbidden)`; decisión malformada, `reason` desconocido o `kind` distinto de `password` se normalizan a `deny(forbidden)`. Un fallo técnico de una política lanza `AccessCheckFailedError` (nunca concede).
- **infrastructure:** `accessErrorResponse` (401/403/404, 401 con `challenge: "password"`, 500 sin exponer la causa).
- **Puertos:** el puerto de extensión es `Policy` (`appliesTo`, `evaluate(request, authorize)`); `authorize` permite consultar otra acción sobre el mismo recurso (una política no debe llevar de vuelta a sí misma).
- **Eventos / persistencia / servicios externos / librerías:** no aplica (estado solo en memoria: la lista de políticas).

## Cómo se usa
- Punto de entrada `authorization/server/index.ts`; exporta `createAuthorizer`, tipos `Authorization`/`Authorizer`, `Subject`, tipos del contrato, los dos errores y `accessErrorResponse`.
- Composición: `Application.create()` (`src/application/server/Application.ts`) crea `const authorization = createAuthorizer()`, la pasa completa solo a los compositores que registran políticas (`NanobookModule.create(eventBus, authorization)`) y expone `authorizer: Authorizer` (sin `register`) a `SpreadsheetsServerModule` y `AgentModule`.
- Registrar una política (compositor del módulo dueño):
  ```ts
  authorization.register(new NanobookAccessPolicy(repository)); // nanobooks/server/index.ts
  authorization.register(new DocumentPasswordPolicy(accessRepository, grantCodec)); // documents/server/index.ts
  ```
- Consumir desde un caso de uso (recibe `Authorizer`):
  ```ts
  const allowed = await this.authorizer.require({
    subject: Subject.of(actorId),
    action: "write",
    resource: { type: "document", id, nanobookId },
  });
  ```
  Ejemplos reales: `CreateDocument`, `UpdateDocument`, `DeleteDocument`, `ReadDocument` (usa `Subject.of(viewer.userId, viewer.grantFor)`), `ListReadableDocuments`, `SaveSpreadsheet`, `LifeCycle` / `writableNanobook`, `AgentToolService` (`Subject.of(actor.actorId)`).
- Borde HTTP: los controladores traducen con `accessErrorResponse(error)` (p. ej. `SaveSpreadsheetController`, `DocumentAccessAdminController`, `NanobookLifecycleController`); el desbloqueo usa `Subject.anonymous()` (`pages/api/nanobooks/[nanobookId]/document-access/unlock.ts`). En páginas SSR: `resolveNanobookRoute` y `DocumentPage.astro` usan `Subject.of(user?.id)`.
- No expone rutas propias.

### Políticas registradas hoy
| Política | Módulo / ruta | `appliesTo` | Rol |
| --- | --- | --- | --- |
| `NanobookAccessPolicy` | `nanobooks/server/infraestructure/access/` | `nanobook`, `document` | Dueño y visibilidad, leídos siempre del repositorio (nunca de `attributes`). Única que concede (`allow`). Anónimo que escribe: `deny(unauthenticated)` antes de comprobar existencia; ajeno sobre privado/inexistente: `deny(not-found)`; sobre público: `deny(forbidden)`. |
| `DocumentPasswordPolicy` | `documents/server/infraestructure/access/` | `document` | Solo restringe lecturas: nunca devuelve `allow`; `abstain` o `challenge(password)` si algún eslabón protegido (`attributes.securedIds`) no tiene grant válido. El escritor del nanobook no necesita contraseña (consulta `authorize` con `write`). |

## Dependencias
- **Depende de:** `shared/domain/Result` (tipo `Result` para `require`). Nada más.
- **Lo usan:** `application` (composición), `nanobooks` (política y casos de uso), `documents` (política, casos de uso y controladores), `spreadsheets`, `agents` (herramientas MCP, `McpToolResult`), `theme` (`AssignNanobookThemeController`), `pages/api/nanobooks/.../document-access/unlock.ts`.
- Acoplamiento a vigilar: ninguna violación de AGENTS.md detectada en el propio módulo. Las políticas viven en `infraestructure/access/` de cada módulo y solo los compositores reciben `Authorization`; vigilar que ningún caso de uso reciba `Authorization` en lugar de `Authorizer`.

## Seguridad y autorización
Este módulo es el mecanismo. Principios: falla cerrado (sin política registrada no se concede nada), `deny` > `challenge` > `allow`, los `attributes` del `Resource` los calcula solo código de servidor del módulo dueño (nunca el cliente), un fallo técnico nunca equivale a conceder y `accessErrorResponse` nunca filtra la causa. Los `deny(not-found)` de nanobooks privados evitan revelar su existencia.

## Pruebas
Junto al código que verifican: `server/domain/types.test.ts`, `server/application/createAuthorizer.test.ts`, `server/infrastructure/http.test.ts`. Ejecutar: `npx vitest run src/authorization`. Cubren las fábricas de `Subject`, la combinación de decisiones (fail-closed, normalización), el registro de políticas y las respuestas HTTP. Las políticas concretas se prueban en sus módulos.

## Decisiones y límites conocidos
- Límite conocido: el único tipo de `challenge` soportado es `password`; añadir otro exige ampliar `Decision`, `combine` y `accessErrorResponse`.
