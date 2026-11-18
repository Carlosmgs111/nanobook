# Autorización de `documents` con el módulo `authorization` (iteración 4): plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** que `documents` decida todo acceso a través de `Authorizer`: la protección por contraseña pasa a ser una política (`DocumentPasswordPolicy`) y las mutaciones autorizan con `Authorizer` en lugar del puerto `WriteAccess`. Al terminar, `WriteAccess`, `canWrite`, `AuthorizeDocumentAccess`, `NanobookWriteAccess` y el guard `withNanobookWriteAccess` desaparecen.

**Arquitectura:**
- `DocumentModule.create(eventBus, authorizer, policies)` registra `DocumentPasswordPolicy` en el arreglo de políticas compartido, igual que `nanobooks`.
- La política solo actúa en `read`, **nunca devuelve `allow`** (solo `abstain` o `challenge`) y recibe la cadena de documentos protegidos en `attributes.securedIds`, que construye siempre el helper `documentResource`.
- Las mutaciones llaman a `authorizer.require({ action: "write", resource: { type: "document", ... } })`; decide la política de `nanobooks`, que ya evalúa recursos `document` por `nanobookId`.
- Los controladores traducen `AccessDeniedError` y `AccessCheckFailedError` con `accessErrorResponse`.

**Stack:** TypeScript (Astro strict), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-17-authorization-module-design.md`, «`documents`: protección por contraseña», «Dónde se comprueba» y las etapas 3 a 5.

**Reglas del repo:**
- Antes de cada commit, `npm run build` debe pasar.
- Mensajes con Conventional Commits, en español, terminando con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Nunca `git add -A` ni `git add .`**: rutas explícitas (entrecomilla las que tienen corchetes).
- **Fin de línea:** los archivos del repo son LF. Si tu herramienta los convierte a CRLF, restáuralos antes de commitear (`git diff --numstat` no debe mostrar archivos enteros reescritos). Excepción: `src/documents/server/index.ts` es CRLF en el repo; conserva su fin de línea.
- Tipos: `npx -p typescript tsc --noEmit -p .` (solo importan los errores de los archivos que toques; hay errores previos en otros).
- Suite completa antes de cada commit: `npx vitest run`. Línea base: 148 archivos y 726 tests.
- `src/content/` está en `.gitignore` pero parte de sus archivos está versionada: para añadir un archivo nuevo ahí usa `git add -f <ruta>`.

## Decisiones de diseño

| Tema | Decisión |
| --- | --- |
| Lectura sin enlaces protegidos | No se llama a `authorize`: igual que hoy, quien llama (página vía `resolveNanobookRoute`, agente vía `require`) ya autorizó el acceso al nanobook. Evita una consulta por render. |
| Lectura con enlaces protegidos | `authorize(read, documentResource(...))`: la política de `nanobooks` exige poder leer el nanobook y la de contraseña exige un grant o ser escritor. `allow` → contenido; `challenge` → documento redactado; `deny` → como no encontrado. Un `AccessCheckFailedError` se propaga (500). |
| Listado (`ListReadableDocuments`) | Igual por documento, **solo para los documentos con enlaces protegidos**; el resto se incluye sin consultar. Un `deny` excluye el documento. Si falla la lectura del repositorio devuelve `[]`, como hoy. |
| `ReadDocumentResult.via` | Pasa de `"open" \| "writer" \| "grant"` a `"open" \| "protected"`. Su único consumidor (`index.astro`) solo comprueba `!== "open"`. |
| Reto en agentes | Un agente no puede superar la contraseña: `AgentToolService.getDocument` devuelve `AccessDeniedError` con `deny(forbidden)` (403 en MCP), como el 403 actual. |
| Comportamiento HTTP | Rutas de mutación: ajeno sobre nanobook privado o nanobook inexistente → 404; ajeno sobre público → 403; sin sesión → 401 (lo da el controlador). Los textos pasan a ser los de `accessErrorResponse`. |

---

## Estructura de archivos

| Archivo | Cambio |
| --- | --- |
| `src/documents/server/application/access/documentResource.ts` (+ test) | Nuevo: `securedDocuments` (movido) y `documentResource`. |
| `src/documents/server/application/access/DocumentPasswordPolicy.ts` (+ test) | Nuevo: la política. |
| `src/documents/server/application/ReadDocument.ts`, `ListReadableDocuments.ts` (+ tests) | Usan `Authorizer`. |
| `src/documents/server/application/CreateDocument.ts`, `UpdateDocument.ts`, `DeleteDocument.ts`, `access/SetDocumentPassword.ts`, `access/ClearDocumentPassword.ts`, `access/loadWritableDocument.ts` (+ tests) | Autorizan con `Authorizer`. |
| `src/documents/server/infraestructure/rest/utils.ts`, `DocumentAccessAdminController.ts` (+ tests) | Traducen los errores de acceso. |
| `src/documents/server/index.ts`, `src/nanobooks/server/index.ts` | Nueva firma de `DocumentModule.create`; registro de la política. |
| `src/documents/server/application/test/factories.ts` | Dobles de `Authorizer` en lugar de `allowWrites`/`denyWrites`. |
| `src/agents/...`, `src/pages/n/[nanobookSlug]/[...slug]/index.astro` | Ajustes por `via` y por los errores. |
| `src/pages/api/nanobooks/[nanobookId]/documents/[id].ts`, `document-access/index.ts` | Sin guard. |
| Borrar | `canWrite.ts`, `AuthorizeDocumentAccess.ts` (+ test), `WriteAccess.ts`, `NanobookWriteAccess.ts` (+ test), `withNanobookWriteAccess.ts` (+ test), `WriteAccessDeniedError`, `DocumentAccessDeniedError`. |
| `src/content/nanobook-project/arquitectura/` | Documentar la decisión. |
| `CHANGELOG.md` | Entrada. |

---

### Tarea 1: `documentResource` y `DocumentPasswordPolicy`

**Archivos:**
- Crear: `src/documents/server/application/access/documentResource.ts` y `documentResource.test.ts`
- Crear: `src/documents/server/application/access/DocumentPasswordPolicy.ts` y `DocumentPasswordPolicy.test.ts`
- Modificar: `src/documents/server/application/access/AuthorizeDocumentAccess.ts` (reexporta `securedDocuments` desde el archivo nuevo hasta la tarea 2)

La política y el helper aún no se usan: esta tarea no cambia comportamiento.

- [ ] **Paso 1: escribir los tests**

Antes de escribirlos, abre `src/documents/server/application/access/AuthorizeDocumentAccess.test.ts` y `src/documents/server/application/test/factories.ts`: de ahí salen los constructores de `Document` protegido y abierto y los dobles de `DocumentAccessRepository` y `AccessGrantCodec` que ya usan los tests. **Reutilízalos**; no inventes otros.

`documentResource.test.ts`:
- `documentResource("nb-1", raw)` devuelve `{ type: "document", id: <id de raw>, nanobookId: "nb-1", attributes: { securedIds: [...] } }`.
- Con `raw` abierto y `resolved` protegido (proxy a un destino protegido), `securedIds` contiene el id del destino.
- Con ambos protegidos y distintos, contiene los dos sin repetir; con el mismo documento dos veces, una sola vez.
- Sin ningún protegido, `securedIds` es `[]`.

`DocumentPasswordPolicy.test.ts` (usa `createAuthorizer` con la política **más** una política de prueba que decide `write`, para ejercer el `authorize` interno; por ejemplo `{ appliesTo: ["document"], evaluate: async ({ action, subject }) => action === "write" && (await subject.userId()) === "owner" ? { effect: "allow" } : { effect: "abstain" } }`, más una política `readers` que da `allow` en `read`, porque la de contraseña nunca concede por sí sola):
- `write` → no se pronuncia (con solo esa política el resultado es `deny(forbidden)`, porque nadie concede); y con `securedIds` malformado en `write` tampoco se pronuncia (no es un error: solo `read` los mira).
- Si el `write` interno falla por un error técnico (política auxiliar que lanza), `authorize` propaga `AccessCheckFailedError` y la política no concede ni desafía.
- `securedIds` ausente, no array o con elementos no string → `deny(forbidden)`.
- `securedIds` vacío con `readers` → `allow`.
- Escritor (`owner`) sin grant → `allow`.
- Lector con grant válido → `allow`.
- Sin grant → `challenge`.
- Con grant de otra versión de contraseña, expirado o manipulado (el doble del codec devuelve `false`) → `challenge`.
- Hash ausente (`passwordHash: null`) o registro inexistente → `challenge`.
- Fallo del repositorio de acceso → `challenge` (nunca `allow`).
- Cadena de dos eslabones protegidos con grant solo del primero → `challenge`.

Ejecuta: `npx vitest run src/documents/server/application/access`. Esperado: FAIL (los módulos nuevos no existen).

- [ ] **Paso 2: implementar `documentResource.ts`**

```ts
import type { Resource } from "../../../../authorization/server";
import type { Document } from "../../domain/Document";

/** Los eslabones protegidos de una cadena, sin repetir. */
export function securedDocuments(documents: Array<Document | null | undefined>): Document[] {
  const seen = new Set<string>();
  const secured: Document[] = [];
  for (const document of documents) {
    if (!document || document.getMetadata().secured !== true) continue;
    const id = document.getDocumentId().getValue();
    if (seen.has(id)) continue;
    seen.add(id);
    secured.push(document);
  }
  return secured;
}

/**
 * Única forma de construir el recurso de lectura de un documento. Calcula en el servidor la
 * cadena de enlaces protegidos (el documento almacenado y, si difiere, el resuelto), de modo que
 * ningún llamador puede olvidar el destino de un proxy.
 */
export function documentResource(nanobookId: string, raw: Document, resolved: Document = raw): Resource {
  return {
    type: "document",
    id: raw.getDocumentId().getValue(),
    nanobookId,
    attributes: {
      securedIds: securedDocuments([raw, resolved]).map((document) => document.getDocumentId().getValue()),
    },
  };
}
```

Copia `securedDocuments` tal cual está hoy en `AuthorizeDocumentAccess.ts` si difiere en algún detalle. En ese archivo, borra la definición y sustitúyela por `import { securedDocuments } from "./documentResource";` seguido de `export { securedDocuments };`: el import es necesario porque `execute` de `AuthorizeDocumentAccess` la usa localmente (un `export ... from` solo no la trae al ámbito). Así los consumidores actuales (`ReadDocument`, `ListReadableDocuments`, `UnlockDocument`) siguen compilando hasta la tarea 2.

- [ ] **Paso 3: implementar `DocumentPasswordPolicy.ts`**

```ts
import type { AccessRequest, Authorize, Decision, Policy } from "../../../../authorization/server";
import type { AccessGrantCodec, DocumentAccessRepository } from "../../domain/access/ports";

/**
 * Protección por contraseña: solo restringe lecturas. Nunca devuelve `allow`; la lectura la concede
 * la política del módulo dueño del nanobook y esta puede exigir un desafío.
 */
export class DocumentPasswordPolicy implements Policy {
  readonly appliesTo = ["document"] as const;

  constructor(
    private readonly accessRepository: DocumentAccessRepository,
    private readonly codec: AccessGrantCodec,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async evaluate(request: AccessRequest, authorize: Authorize): Promise<Decision> {
    if (request.action !== "read") return { effect: "abstain" };

    const securedIds = request.resource.attributes?.securedIds;
    if (!Array.isArray(securedIds) || !securedIds.every((id): id is string => typeof id === "string")) {
      return { effect: "deny", reason: "forbidden" };
    }
    if (securedIds.length === 0) return { effect: "abstain" };

    // El escritor del nanobook no necesita contraseña.
    if ((await authorize({ ...request, action: "write" })).effect === "allow") return { effect: "abstain" };

    // Cada eslabón protegido de la cadena exige su propio grant válido.
    for (const documentId of securedIds) {
      if (!(await this.hasValidGrant(documentId, request.subject.grantFor(documentId)))) {
        return { effect: "challenge", kind: "password" };
      }
    }
    return { effect: "abstain" };
  }

  private async hasValidGrant(documentId: string, token: string | undefined): Promise<boolean> {
    if (!token) return false;

    const record = await this.accessRepository.get(documentId);
    // Un fallo de lectura o un hash ausente nunca concede acceso.
    if (!record.isSuccess) return false;
    const value = record.getValue();
    if (!value || value.passwordHash === null) return false;

    return this.codec.verify(token, {
      documentId,
      passwordVersion: value.passwordVersion,
      now: this.clock(),
    });
  }
}
```

- [ ] **Paso 4: verificar y commit**

Ejecuta: `npx vitest run src/documents` (PASS), `npx -p typescript tsc --noEmit -p .` (sin errores en los archivos nuevos) y `npm run build`.

```bash
git add src/documents/server/application/access/documentResource.ts src/documents/server/application/access/documentResource.test.ts src/documents/server/application/access/DocumentPasswordPolicy.ts src/documents/server/application/access/DocumentPasswordPolicy.test.ts src/documents/server/application/access/AuthorizeDocumentAccess.ts
git commit -m "feat(documents): añade DocumentPasswordPolicy y documentResource" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Tarea 2: la lectura autoriza con `Authorizer`

**Archivos:**
- Modificar: `src/documents/server/application/ReadDocument.ts` y `ReadDocument.test.ts`
- Modificar: `src/documents/server/application/ListReadableDocuments.ts` y su test
- Modificar: `src/documents/server/index.ts` y `src/nanobooks/server/index.ts`
- Modificar: `src/agents/server/application/AgentToolService.ts` y sus tests, `src/pages/n/[nanobookSlug]/[...slug]/index.astro`
- Borrar: `src/documents/server/application/canWrite.ts` y `access/AuthorizeDocumentAccess.ts` (+ su test)
- Modificar: `src/documents/server/application/test/factories.ts`

En esta tarea los casos de uso de **escritura** siguen usando `WriteAccess`; por eso `DocumentModule.create` recibe temporalmente los dos: `create(eventBus, writeAccess, authorizer, policies)`.

- [ ] **Paso 1: actualizar los tests (deben fallar)**

- `ReadDocument.test.ts`: construye `new ReadDocument(getDocument, authorizer)` con un autorizador real (`createAuthorizer`) cuyas políticas sean `DocumentPasswordPolicy` (con los dobles de repositorio y codec que ya usa el test) y una política de prueba que permita `read` y decida `write` por `userId`. Casos: sin protegidos → `allowed` `via: "open"` **sin** invocar al autorizador; protegido y escritor → `allowed` `via: "protected"`; protegido con grant válido → `allowed`; protegido sin grant → `challenge` con `raw.redacted()`; proxy abierto a destino protegido → `challenge`; el autorizador devuelve `deny` (p. ej. nanobook privado ajeno) → `{ kind: "not-found" }`; el autorizador lanza `AccessCheckFailedError` → `execute` rechaza con ese error; cadena inexistente → `not-found`.
- `ListReadableDocuments.test.ts`: `new ListReadableDocuments(repository, proxyParser, authorizer)`. Casos: documentos abiertos se incluyen sin invocar al autorizador; protegido y escritor → incluido completo; protegido sin grant (sin escritor) → redactado; `deny` → excluido; proxy abierto a destino protegido para un no escritor → redactado; fallo del repositorio → `[]`.
- En `factories.ts`, sustituye los dobles `allowWrites`/`denyWrites` por dobles de `Authorizer` que sigan usándose en los tests de escritura **todavía no migrados**: déjalos hasta la tarea 3 (esta tarea solo añade `allowAllAuthorizer()` y `denyAllAuthorizer()` sobre `createAuthorizer`, que se usarán en la tarea 3).

Ejecuta: `npx vitest run src/documents src/agents`. Esperado: FAIL.

- [ ] **Paso 2: migrar `ReadDocument`**

```ts
import { Subject, type Authorizer } from "../../../authorization/server";
import type { Document } from "../domain/Document";
import { documentResource, securedDocuments } from "./access/documentResource";
import type { DocumentTimingObserver, GetDocument } from "./GetDocument";

// DocumentViewer y ReadDocumentInput se mantienen.

export type ReadDocumentResult =
  | { kind: "not-found" }
  /** `via` indica si el documento estaba abierto o protegido (y el lector superó la protección). */
  | { kind: "allowed"; document: Document; via: "open" | "protected" }
  /** `document` va redactado: sin cuerpo ni descripción. */
  | { kind: "challenge"; method: "password"; document: Document };

export class ReadDocument {
  constructor(
    private readonly getDocument: Pick<GetDocument, "executeChain">,
    private readonly authorizer: Authorizer,
  ) {}

  async execute({ nanobookId, path, viewer, observeTiming }: ReadDocumentInput): Promise<ReadDocumentResult> {
    const chain = await this.getDocument.executeChain(nanobookId, path, observeTiming);
    if (!chain) return { kind: "not-found" };

    // Sin enlaces protegidos no hay nada que decidir aquí: quien llama ya autorizó el acceso al nanobook.
    if (securedDocuments([chain.raw, chain.resolved]).length === 0) {
      return { kind: "allowed", document: chain.resolved, via: "open" };
    }

    const decision = await this.authorizer.authorize({
      subject: Subject.of(viewer.userId, viewer.grantFor),
      action: "read",
      resource: documentResource(nanobookId, chain.raw, chain.resolved),
    });
    if (decision.effect === "allow") return { kind: "allowed", document: chain.resolved, via: "protected" };
    if (decision.effect === "challenge") {
      return { kind: "challenge", method: decision.kind, document: chain.raw.redacted() };
    }
    return { kind: "not-found" };
  }
}
```

`viewer.userId` ya es perezoso; `Subject.of` lo memoiza.

- [ ] **Paso 3: migrar `ListReadableDocuments`**

```ts
import { Subject, type Authorizer } from "../../../authorization/server";
import type { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import { documentResource, securedDocuments } from "./access/documentResource";
import type { ProxyParser } from "./ProxyParser";

/** Lista los documentos para un lector sin desafío posible (un agente): los protegidos salen redactados salvo para escritores. */
export class ListReadableDocuments {
  constructor(
    private readonly repository: ContentRepository,
    private readonly proxyParser: ProxyParser,
    private readonly authorizer: Authorizer,
  ) {}

  async execute(nanobookId: string, { userId }: { userId: string | undefined }): Promise<Document[]> {
    const listed = await this.repository.list(nanobookId);
    if (!listed.isSuccess) return [];

    const raw = listed.getValue();
    const resolved = await this.proxyParser.parseProxies(nanobookId, raw);
    const subject = Subject.of(userId);

    const readable = await Promise.all(
      resolved.map(async (document, index): Promise<Document | null> => {
        if (securedDocuments([raw[index], document]).length === 0) return document;
        const decision = await this.authorizer.authorize({
          subject,
          action: "read",
          resource: documentResource(nanobookId, raw[index], document),
        });
        if (decision.effect === "allow") return document;
        return decision.effect === "challenge" ? raw[index].redacted() : null;
      }),
    );
    return readable.filter((document): document is Document => document !== null);
  }
}
```

- [ ] **Paso 4: cableado, consumidores y borrado**

- `src/documents/server/index.ts` (CRLF; conserva su fin de línea): importa `createAuthorizer`-tipos `Authorizer` y `Policy` de `../../authorization/server`; cambia la firma a `create(eventBus: EventBus, writeAccess: WriteAccess, authorizer: Authorizer, policies: Policy[])`; tras crear `accessRepository` y `grantCodec`, añade `policies.push(new DocumentPasswordPolicy(accessRepository, grantCodec));`; elimina `authorizeDocumentAccess`; construye `new ReadDocument(getDocument, authorizer)` y `new ListReadableDocuments(contentRepository, proxyParser, authorizer)`.
- `src/nanobooks/server/index.ts`: pasa `authorizer` y `policies` a `DocumentModule.create(eventBus, new NanobookWriteAccess(authorizer), authorizer, policies)`. **El orden importa:** `policies.push(new NanobookAccessPolicy(...))` ya se hace antes; ambas políticas quedan registradas antes de la primera petición.
- `AgentToolService.getDocument` (línea ~124): sustituye `new DocumentAccessDeniedError(...)` ante un `challenge` por `new AccessDeniedError({ effect: "deny", reason: "forbidden" })` (importado de `../../../authorization/server`).
- `AgentToolService.getDocument` y `listDocuments`: `readDocument.execute` y `listReadableDocuments.execute` ahora pueden **lanzar** `AccessCheckFailedError` (antes `canWrite` lo tragaba). Envuelve cada llamada en `try/catch` y, si el error es un `AccessCheckFailedError`, devuelve `Result.fail(error)` (relanza cualquier otro), para que `toMcpError` responda 500 con mensaje fijo. Añade un test por método.
- `AgentToolService.read.test.ts`: el mock usa `via: "writer"` (línea ~53) → `"protected"`, y `DocumentAccessDeniedError` (líneas ~5 y ~41) → `AccessDeniedError` con `deny(forbidden)`. Ajusta también los demás tests de agentes que construyan `ReadDocument`/`ListReadableDocuments` o dependan de esos errores.
- `index.astro` (`[...slug]`): la comprobación `read.via !== "open"` sigue valiendo; verifica que no use `"writer"` ni `"grant"` (grep).
- `src/documents/server/application/access/UnlockDocument.ts` (línea ~16) importa `securedDocuments` de `./AuthorizeDocumentAccess`: apunta el import a `./documentResource`.
- Borra `application/canWrite.ts`, `application/access/AuthorizeDocumentAccess.ts` y su test. Elimina el `import`+`export` transitorio de `securedDocuments` de la tarea 1 con ese borrado.
- Mueve a `DocumentPasswordPolicy.test.ts` cualquier caso del test borrado que no estuviera cubierto.
- **Contrato de seguridad que debe quedar escrito en el docblock de `ReadDocument` y de `ListReadableDocuments`:** estos casos de uso **no** autorizan el acceso al nanobook para los documentos abiertos; quien los llama debe haber autorizado la lectura del nanobook antes (`resolveNanobookRoute` en las páginas, `authorizer.require` en `AgentToolService`).

- [ ] **Paso 5: verificar y commit**

Ejecuta: `npx vitest run` completo (sin fallos), `npx -p typescript tsc --noEmit -p .` (sin errores en los archivos tocados) y `npm run build`.

```bash
git add src/documents/server/application/ReadDocument.ts src/documents/server/application/ReadDocument.test.ts src/documents/server/application/ListReadableDocuments.ts src/documents/server/application/ListReadableDocuments.test.ts src/documents/server/index.ts src/nanobooks/server/index.ts src/agents/server/application/AgentToolService.ts src/agents/server/application/AgentToolService.read.test.ts src/documents/server/application/test/factories.ts src/documents/server/application/access/UnlockDocument.ts "src/pages/n/[nanobookSlug]/[...slug]/index.astro"
git add src/documents/server/application/canWrite.ts src/documents/server/application/access/AuthorizeDocumentAccess.ts src/documents/server/application/access/AuthorizeDocumentAccess.test.ts src/documents/server/application/access/DocumentPasswordPolicy.test.ts src/documents/server/application/access/UnlockDocument.test.ts
# Añade además, por ruta explícita, cualquier otro test que hayas ajustado (p. ej. AgentToolService.test.ts, AgentToolService.write.test.ts, createNanobookMcpServer.test.ts): que `git status` quede limpio tras el commit.
git commit -m "refactor(documents): la lectura protegida decide con el módulo authorization" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

(Los `git add` de archivos borrados registran el borrado.)

---

### Tarea 3: las mutaciones autorizan con `Authorizer` y desaparece `WriteAccess`

**Archivos:**
- Modificar: `CreateDocument.ts`, `UpdateDocument.ts`, `DeleteDocument.ts`, `access/SetDocumentPassword.ts`, `access/ClearDocumentPassword.ts`, `access/loadWritableDocument.ts` (en `src/documents/server/application/`) y sus tests
- Modificar: `src/documents/server/infraestructure/rest/utils.ts`, `DocumentAccessAdminController.ts` y sus tests
- Modificar: `src/documents/server/domain/errors.ts`, `src/documents/server/index.ts`, `src/nanobooks/server/index.ts`
- Modificar: `src/agents/server/infrastructure/mcp/McpToolResult.ts` y su test
- Modificar: `src/documents/server/application/test/factories.ts`
- Borrar: `src/documents/server/domain/ports/WriteAccess.ts`, `src/nanobooks/server/infraestructure/documents/NanobookWriteAccess.ts` y su test

- [ ] **Paso 1: actualizar los tests (deben fallar)**

- En los tests de casos de uso de escritura (`CreateDocument`, `UpdateDocument`, `DeleteDocument`, `DocumentPasswordAdmin`), sustituye `allowWrites()`/`denyWrites()` por `allowAllAuthorizer()`/`denyAllAuthorizer()` de `factories.ts` (el segundo hace que `require` devuelva `AccessDeniedError` con `deny(forbidden)`). Casos que deben seguir cubiertos: acceso denegado → el caso de uso devuelve `AccessDeniedError` **sin efectos** (nada escrito ni publicado); fallo técnico del autorizador → `AccessCheckFailedError`; el `require` se invoca con `action: "write"`, `resource.type: "document"` y el `nanobookId` correcto, y con el `actorId` como sujeto.
- En los tests de controladores (`Create/Update/DeleteDocumentController.test.ts`, `DocumentAccessControllers.test.ts`): un `AccessDeniedError` con `deny(forbidden)` → 403, `deny(not-found)` → 404, `deny(unauthenticated)` → 401, y `AccessCheckFailedError` → 500 sin exponer la causa; los errores propios de `documents` mantienen sus códigos.
- Test del contrato entre módulos: **no** lo pongas en `documents` (importaría `nanobooks`, y `nanobooks` ya depende de `documents`). Añádelo a `src/nanobooks/server/application/NanobookAccessPolicy.test.ts`: un recurso `{ type: "document", id, nanobookId }` con `write` de un ajeno recibe `deny(not-found)` sobre un nanobook privado y `deny(forbidden)` sobre uno público (si ya existe un caso equivalente de `document`, no lo dupliques). En `documents`, los tests de casos de uso usan los dobles `allowAllAuthorizer`/`denyAllAuthorizer`.
- `SetDocumentPassword`: hoy valida la longitud de la contraseña **antes** de `loadWritableDocument`. Sin guard, un ajeno recibiría un 400 antes de la comprobación de acceso. Mueve la validación para que ocurra **después** de `loadWritableDocument` (autorizar primero), y añade el test: acceso denegado + contraseña inválida → `AccessDeniedError`, no `InvalidDocumentPasswordError`.

Ejecuta: `npx vitest run src/documents src/agents src/nanobooks`. Esperado: FAIL.

- [ ] **Paso 2: migrar los casos de uso**

En cada caso de uso, sustituye el parámetro `writeAccess: WriteAccess` por `authorizer: Authorizer` (importa de `../../../authorization/server`, o `../../../../authorization/server` en `access/`) y la comprobación inicial por:

```ts
    const writable = await this.authorizer.require({
      subject: Subject.of(actorId),
      action: "write",
      resource: { type: "document", id: <ver abajo>, nanobookId },
    });
    if (!writable.isSuccess) return Result.fail(writable.getError());
```

`id` por caso de uso: `CreateDocument` → `input.path`; `UpdateDocument` y `DeleteDocument` → el `documentId` recibido; `SetDocumentPassword`, `ClearDocumentPassword` y `loadWritableDocument` → el `documentPath`. `loadWritableDocument(authorizer, contentRepository, nanobookId, documentPath, actorId)` sigue haciendo la comprobación **antes** de cargar el documento.

Añade `AccessDeniedError | AccessCheckFailedError` a los tipos de error de cada caso de uso (`CreateDocumentError`, `UpdateDocumentError`, `DeleteDocumentError`, `LoadWritableDocumentError`) y quita `WriteAccessDeniedError` de ellos. El constructor de cada caso de uso mantiene el orden de los demás parámetros; el autorizador ocupa la posición que tenía `writeAccess`.

- [ ] **Paso 3: controladores y errores**

En `utils.ts` y en `toResponse` de `DocumentAccessAdminController.ts`, importa `AccessCheckFailedError`, `AccessDeniedError` y `accessErrorResponse` desde `../../../../authorization/server`, añade esos dos tipos al parámetro y, antes del resto de ramas:

```ts
  if (error instanceof AccessDeniedError || error instanceof AccessCheckFailedError) {
    return accessErrorResponse(error);
  }
```

Elimina la rama de `DocumentAccessDeniedError` de ambos.

- [ ] **Paso 4: cableado y borrado**

- `src/documents/server/index.ts` (CRLF): la firma pasa a `create(eventBus, authorizer, policies)`; quita el import de `WriteAccess` y su exportación; pasa `authorizer` donde antes se pasaba `writeAccess`; quita de las exportaciones `WriteAccessDeniedError` (conserva `DocumentRepositoryError` si algún módulo lo sigue importando; si no, quítala también).
- `src/nanobooks/server/index.ts`: `DocumentModule.create(eventBus, authorizer, policies)`; quita el import y la creación de `NanobookWriteAccess`.
- Borra `domain/ports/WriteAccess.ts`, `NanobookWriteAccess.ts` y su test.
- En `domain/errors.ts`, borra `WriteAccessDeniedError` y `DocumentAccessDeniedError`, y quita `DocumentAccessDeniedError` de `DocumentServiceError`, **tras comprobar con grep** que no queda ningún productor ni consumidor (`McpToolResult.ts` y `AgentToolService.ts` ya no deben referenciarlos; limpia `McpToolResult.ts` y su test).
- En `factories.ts`, elimina `allowWrites` y `denyWrites` y cualquier import del puerto.

- [ ] **Paso 5: verificar y commit**

Ejecuta: `rg -n "WriteAccess\b|WriteAccessDeniedError|DocumentAccessDeniedError|canWrite|AuthorizeDocumentAccess" src` (esperado: solo `withNanobookWriteAccess` y `protectNanobookWriteMutation`, que son otros símbolos y se retiran en la tarea 4), `npx vitest run` completo, `npx -p typescript tsc --noEmit -p .` y `npm run build`.

```bash
git add src/documents/server/application/CreateDocument.ts src/documents/server/application/UpdateDocument.ts src/documents/server/application/DeleteDocument.ts src/documents/server/application/access/SetDocumentPassword.ts src/documents/server/application/access/ClearDocumentPassword.ts src/documents/server/application/access/loadWritableDocument.ts src/documents/server/infraestructure/rest/utils.ts src/documents/server/infraestructure/rest/DocumentAccessAdminController.ts src/documents/server/domain/errors.ts src/documents/server/index.ts src/nanobooks/server/index.ts src/agents/server/infrastructure/mcp/McpToolResult.ts src/documents/server/application/test/factories.ts src/documents/server/domain/ports/WriteAccess.ts src/nanobooks/server/infraestructure/documents/NanobookWriteAccess.ts src/nanobooks/server/infraestructure/documents/NanobookWriteAccess.test.ts
git add src/documents/server/application/CreateDocument.test.ts src/documents/server/application/UpdateDocument.test.ts src/documents/server/application/DeleteDocument.test.ts src/documents/server/application/access/DocumentPasswordAdmin.test.ts src/documents/server/infraestructure/rest/CreateDocumentController.test.ts src/documents/server/infraestructure/rest/UpdateDocumentController.test.ts src/documents/server/infraestructure/rest/DeleteDocumentController.test.ts src/documents/server/infraestructure/rest/DocumentAccessControllers.test.ts src/agents/server/infrastructure/mcp/McpToolResult.test.ts src/nanobooks/server/application/NanobookAccessPolicy.test.ts
# Añade además, por ruta explícita, cualquier otro test que hayas ajustado: `git status` debe quedar limpio tras el commit.
git commit -m "refactor(documents): las mutaciones autorizan con el módulo authorization y se elimina WriteAccess" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Tarea 4: retirar el guard HTTP transitorio

**Archivos:**
- Modificar: `src/pages/api/nanobooks/[nanobookId]/documents/[id].ts` y `document-access/index.ts`
- Borrar: `src/nanobooks/server/infraestructure/rest/withNanobookWriteAccess.ts` y su test

Los casos de uso ya deciden el acceso y los controladores traducen sus errores, así que el guard sobra.

- [ ] **Paso 1: rutas**

En `documents/[id].ts`:

```ts
import type { APIRoute } from "astro";
import { getApp } from "../../../../../application/server/Application";

export const prerender = false;

const app = await getApp();

const documentMutations = {
  POST: app.nanobookModule.documentModule.createDocumentController.handle,
  PATCH: app.nanobookModule.documentModule.updateDocumentController.handle,
  DELETE: app.nanobookModule.documentModule.deleteDocumentController.handle,
};

function dispatch(method: keyof typeof documentMutations): APIRoute {
  return app.routeProtector.protect(documentMutations[method]);
}

export const POST = dispatch("POST");
export const PATCH = dispatch("PATCH");
export const DELETE = dispatch("DELETE");
```

En `document-access/index.ts`, `dispatch` pasa a ser `app.routeProtector.protect(handler)` y se quita el import de `protectNanobookWriteMutation`.

Los controladores ya devuelven 401 sin sesión y 400 sin `nanobookId`. Comprueba con un test de rutas o de controlador (el que mejor encaje) que, **sin guard**: sin sesión → 401; ajeno sobre un nanobook privado → 404 y el mismo cuerpo que un nanobook inexistente; ajeno sobre uno público → 403. Si ya existe en los tests de la tarea 3, no los dupliques.

- [ ] **Paso 2: borrar y verificar**

Borra `withNanobookWriteAccess.ts` y su test. Ejecuta `rg -n "withNanobookWriteAccess|protectNanobookWriteMutation" src` (esperado: sin resultados), `npx vitest run`, `npx -p typescript tsc --noEmit -p .` y `npm run build`.

- [ ] **Paso 3: commit**

```bash
git add "src/pages/api/nanobooks/[nanobookId]/documents/[id].ts" "src/pages/api/nanobooks/[nanobookId]/document-access/index.ts" src/nanobooks/server/infraestructure/rest/withNanobookWriteAccess.ts src/nanobooks/server/infraestructure/rest/withNanobookWriteAccess.test.ts
git commit -m "refactor(nanobooks): retira el guard HTTP de escritura, la decisión vive en los casos de uso" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Tarea 5: documentación y changelog

**Archivos:**
- Crear: `src/content/nanobook-project/arquitectura/modulo-authorization.md`
- Modificar: `src/content/nanobook-project/arquitectura/proteccion-lectura-escritura-documentos.md`, `autenticacion-servidor-decorador-capacidades.md` y `index.md` si lista los documentos de arquitectura
- Modificar: `CHANGELOG.md`

- [ ] **Paso 1: documentar la decisión**

Lee antes `proteccion-lectura-escritura-documentos.md`, `autenticacion-servidor-decorador-capacidades.md` e `index.md` para seguir su formato (frontmatter incluido) y no duplicar contenido.

- `modulo-authorization.md` (nuevo): qué es el módulo y por qué existe (una sola decisión de acceso); el contrato (`Subject`, `Resource`, `Decision` con `abstain`, `Policy`); las reglas del motor (deny > challenge > allow, conceder exige un `allow` explícito, un fallo técnico lanza `AccessCheckFailedError` y nunca concede); las dos políticas (`NanobookAccessPolicy` y `DocumentPasswordPolicy`, esta nunca concede); cómo añadir una política nueva (registrarla en el arreglo compartido); `accessErrorResponse` y la tabla de códigos HTTP; la regla de que la comprobación vive en los casos de uso; y las decisiones de rendimiento (lectura sin enlaces protegidos no consulta). Enlaza con `[[proteccion-lectura-escritura-documentos]]` si el índice usa ese estilo de enlaces.
- `proteccion-lectura-escritura-documentos.md`: actualiza los pasajes que describen `WriteAccess`, `canWrite`, `AuthorizeDocumentAccess` o el guard HTTP para que describan el estado actual (política de contraseña en `authorization`, escritura decidida por `NanobookAccessPolicy`).
- `autenticacion-servidor-decorador-capacidades.md`: si menciona `withNanobookWriteAccess` o `protectNanobookWriteMutation`, corrige solo esos pasajes (el decorador `RouteProtector` se mantiene).
- `index.md`: añade la entrada del documento nuevo si el índice lista los demás.

`src/content/` está en `.gitignore`, así que `rg` lo omite por defecto: verifica **siempre con `--no-ignore`**: `rg --no-ignore -n "WriteAccess|canWrite|AuthorizeDocumentAccess|withNanobookWriteAccess|RequireNanobookAccess|AuthorizeNanobook|NanobookAccessDeniedError" src/content`. Hay coincidencias reales hoy en `index.md` y `proteccion-lectura-escritura-documentos.md` (además de la ya corregida): corrige **todas**, no solo añadir una entrada nueva al índice. Esperado al terminar: sin resultados (salvo que describan explícitamente la historia, en cuyo caso redáctalo en pasado).

- [ ] **Paso 2: changelog**

Revisa `git diff CHANGELOG.md` (debe estar vacío) e inserta justo debajo de `## [Unreleased]`, seguida de una línea en blanco:

```markdown
- **Changed:** `documents` decide todo acceso a través del módulo `authorization`: la protección por contraseña es la política `DocumentPasswordPolicy` (solo restringe lecturas) y las mutaciones y la administración de contraseñas autorizan con `Authorizer`. Se eliminan el puerto `WriteAccess`, `NanobookWriteAccess`, `canWrite`, `AuthorizeDocumentAccess`, `withNanobookWriteAccess` y los errores `WriteAccessDeniedError` y `DocumentAccessDeniedError`. Las rutas de mutación de documentos y de contraseña responden con los códigos de `accessErrorResponse`: un ajeno sobre un nanobook privado, o uno inexistente, recibe 404 idéntico; sobre uno público, 403. `ReadDocumentResult.via` pasa a `"open" | "protected"`.
```

- [ ] **Paso 3: build y commit**

Ejecuta `npm run build`.

```bash
git add -f src/content/nanobook-project/arquitectura/modulo-authorization.md
git add src/content/nanobook-project/arquitectura/proteccion-lectura-escritura-documentos.md src/content/nanobook-project/arquitectura/autenticacion-servidor-decorador-capacidades.md src/content/nanobook-project/arquitectura/index.md CHANGELOG.md
git commit -m "docs(authorization): documenta el módulo y registra la migración de documents en el changelog" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

(Si `autenticacion-servidor-decorador-capacidades.md` o `index.md` no cambiaron, quítalos del `git add`.)

---

## Verificación final de la iteración

- `rg --no-ignore -n "WriteAccess\b|canWrite|AuthorizeDocumentAccess|withNanobookWriteAccess|protectNanobookWriteMutation|RequireNanobookAccess|AuthorizeNanobook|NanobookAccessDeniedError" src` → sin resultados.
- `npx vitest run` completo en verde; `npm run build` en verde.
- `git status` limpio y `git diff --numstat` sin archivos enteros reescritos por fin de línea.
