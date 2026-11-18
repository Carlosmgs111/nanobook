# Migración de los consumidores de acceso de `nanobooks` (iteración 3): plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** que todo el acceso a nanobooks pase por el módulo `authorization`, y borrar `AuthorizeNanobook`, `RequireNanobookAccess` y `NanobookAccessDeniedError`, que dejan de tener consumidores. Al terminar, la regla de dueño y visibilidad existe una sola vez: `NanobookAccessPolicy`.

**Arquitectura:**
- `Application` expone el `Authorizer` y `AgentModule` lo recibe.
- `NanobookWriteAccess` (el adaptador del puerto `WriteAccess` de `documents`) se reimplementa sobre `Authorizer`. `documents` no cambia en esta iteración.
- `resolveNanobookRoute`, `DocumentPage.astro`, `AgentToolService`, `withNanobookWriteAccess` y `unlock.ts` pasan a `Authorizer`.
- Un helper `Subject.of` construye sujetos con sesión memoizada.

**Stack:** TypeScript (Astro strict), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-17-authorization-module-design.md`, tabla «Dónde se comprueba» y etapa 2. Esta iteración cierra la **etapa 2** y la parte de `nanobooks` de la etapa 5. La política de `documents` (etapa 3), la retirada del guard HTTP (etapa 4) y la documentación quedan para la iteración 4.

**Reglas del repo:**
- Antes de cada commit, ejecutar `npm run build` y comprobar que pasa.
- Mensajes con Conventional Commits, en español, terminando con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Nunca `git add -A` ni `git add .`**: añade solo rutas explícitas.
- **Fin de línea:** los archivos del repo son LF. No conviertas ningún archivo a CRLF; si tu herramienta lo hace, restáuralo antes de commitear (`git diff --numstat` no debe mostrar archivos enteros reescritos).
- Tipos: `npx -p typescript tsc --noEmit -p .`. Hay errores previos en otros archivos; solo importan los de los archivos que toques.
- Suite completa antes de cada commit con cambios de comportamiento: `npx vitest run`. Línea base: 148 archivos y 714 tests.

## Decisiones de comportamiento

| Caso | Antes | Después |
| --- | --- | --- |
| Página de edición (`resolveNanobookRoute`, write) de un ajeno sobre un nanobook **privado** | 403 | 404 |
| Rutas de mutación de documentos y de contraseña (guard), ajeno sobre nanobook **privado** | 403 | 404 |
| Mismas rutas, nanobook **inexistente** | 404 | 404 |
| Mismas rutas, usuario sin sesión | 401 | 401 |
| `unlock`, nanobook privado | 404 | 404 |

Todo lo demás se mantiene.

---

## Estructura de archivos

| Archivo | Cambio |
| --- | --- |
| `src/authorization/server/domain/types.ts` | `Subject.of(userId, grantFor?)`: sujeto con sesión memoizada. |
| `src/authorization/server/domain/types.test.ts` | Tests de `Subject.of`. |
| `src/application/server/Application.ts` | Expone `authorizer`; pasa el autorizador a `AgentModule`. |
| `src/nanobooks/server/infraestructure/documents/NanobookWriteAccess.ts` (+ test) | Se apoya en `Authorizer`. |
| `src/nanobooks/server/application/GetNanobookById.ts` (+ test) | Caso de uso nuevo. |
| `src/agents/server/index.ts`, `application/AgentToolService.ts` | `require` y `getNanobook` con `Authorizer` y `GetNanobookById`. |
| `src/application/server/resolveNanobookRoute.ts` (+ test) | Autoriza con `Authorizer`. |
| `src/documents/browser/ui/pages/DocumentPage.astro` | `canEdit` con `Authorizer`. |
| `src/nanobooks/server/infraestructure/rest/withNanobookWriteAccess.ts` (+ test) | Se apoya en `Authorizer`. |
| `src/pages/api/nanobooks/[nanobookId]/documents/[id].ts`, `document-access/index.ts`, `document-access/unlock.ts` | Pasan el `Authorizer`. |
| `src/nanobooks/server/index.ts` | Deja de crear y exponer `RequireNanobookAccess` y `AuthorizeNanobook`. |
| Borrar | `AuthorizeNanobook.ts` y su test, `RequireNanobookAccess.ts` y su test, y el error `NanobookAccessDeniedError`. |
| `CHANGELOG.md` | Entrada en `[Unreleased]`. |

---

### Tarea 1: `Subject.of`, el helper de sujetos

**Archivos:**
- Modificar: `src/authorization/server/domain/types.ts`
- Crear: `src/authorization/server/domain/types.test.ts`

Hoy cada consumidor arma el sujeto a mano (`{ userId: async () => id, grantFor: () => undefined }`). El spec pide que la sesión sea perezosa y memoizada. Este helper evita repetirlo y garantiza que la sesión se resuelve una sola vez.

- [ ] **Paso 1: escribir los tests**

```ts
import { describe, expect, it, vi } from "vitest";

import { Subject } from "./types";

describe("Subject.of", () => {
  it("acepta un id directo", async () => {
    expect(await Subject.of("u-1").userId()).toBe("u-1");
    expect(await Subject.of(undefined).userId()).toBeUndefined();
  });

  it("resuelve la sesión una sola vez, y solo cuando se pide", async () => {
    const resolve = vi.fn(async () => "u-1");
    const subject = Subject.of(resolve);

    expect(resolve).not.toHaveBeenCalled();
    await Promise.all([subject.userId(), subject.userId()]);
    await subject.userId();

    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("entrega la credencial presentada por recurso, o ninguna", () => {
    const subject = Subject.of("u-1", (id) => (id === "doc-1" ? "tok" : undefined));

    expect(subject.grantFor("doc-1")).toBe("tok");
    expect(subject.grantFor("doc-2")).toBeUndefined();
    expect(Subject.of("u-1").grantFor("doc-1")).toBeUndefined();
  });
});
```

- [ ] **Paso 2: ejecutar y verificar que falla**

Ejecuta: `npx vitest run src/authorization/server/domain/types.test.ts`
Esperado: FAIL (`Subject.of is not a function`).

- [ ] **Paso 3: implementar**

En `types.ts`, dentro del objeto `export const Subject = { ... }`, junto a `anonymous()`:

```ts
  /** Sujeto con el usuario ya conocido o con una resolución perezosa que se ejecuta una sola vez. */
  of(
    userId: string | undefined | (() => Promise<string | undefined>),
    grantFor: (resourceId: string) => string | undefined = () => undefined,
  ): Subject {
    let pending: Promise<string | undefined> | undefined;
    return {
      userId: () =>
        (pending ??= typeof userId === "function" ? userId() : Promise.resolve(userId)),
      grantFor,
    };
  },
```

- [ ] **Paso 4: verificar y commit**

Ejecuta: `npx vitest run src/authorization` (PASS) y `npm run build`.

```bash
git add src/authorization/server/domain/types.ts src/authorization/server/domain/types.test.ts
git commit -m "feat(authorization): añade Subject.of con sesión perezosa y memoizada" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Tarea 2: `Application` expone el autorizador y `NanobookWriteAccess` se apoya en él

**Archivos:**
- Modificar: `src/application/server/Application.ts`
- Modificar: `src/nanobooks/server/index.ts`
- Modificar: `src/nanobooks/server/infraestructure/documents/NanobookWriteAccess.ts` y `NanobookWriteAccess.test.ts`

`documents` conserva su puerto `WriteAccess`. Solo cambia quien lo implementa.

- [ ] **Paso 1: reescribir el test de `NanobookWriteAccess`**

Sustituye el test por uno que use un autorizador real con `NanobookAccessPolicy` y un `InMemoryNanobookRepository`, y comprueba:
- el dueño: `require("book-a", "owner")` es `ok`;
- un ajeno sobre un nanobook público o privado: `getError()` es `WriteAccessDeniedError`;
- un nanobook inexistente: `WriteAccessDeniedError`;
- un fallo del repositorio: `DocumentRepositoryError` (usa un repositorio cuyo `findById` devuelve `Result.fail(new NanobookRepositoryError("db caída"))`).

Mantén los `vi.mock` de `drizzleDatabase` y `astro:env/server` que ya tiene el archivo. Ejecuta: `npx vitest run src/nanobooks/server/infraestructure/documents/NanobookWriteAccess.test.ts`. Esperado: FAIL (el constructor aún espera `NanobookAccessRequirement`).

- [ ] **Paso 2: reimplementar el adaptador**

```ts
import {
  AccessCheckFailedError,
  AccessDeniedError,
  Subject,
  type Authorizer,
} from "../../../../authorization/server";
import {
  DocumentRepositoryError,
  WriteAccessDeniedError,
  type WriteAccess,
} from "../../../../documents/server";
import { Result } from "../../../../shared/domain/Result";

/** Puerto de escritura de `documents` respaldado por la política de acceso de nanobooks. */
export class NanobookWriteAccess implements WriteAccess {
  constructor(private readonly authorizer: Authorizer) {}

  async require(
    nanobookId: string,
    actorId: string,
  ): Promise<Result<WriteAccessDeniedError | DocumentRepositoryError, void>> {
    const result = await this.authorizer.require({
      subject: Subject.of(actorId),
      action: "write",
      resource: { type: "nanobook", id: nanobookId },
    });
    if (result.isSuccess) return Result.ok();

    const error = result.getError();
    if (error instanceof AccessDeniedError) return Result.fail(new WriteAccessDeniedError(nanobookId));
    return Result.fail(
      new DocumentRepositoryError("No fue posible comprobar el permiso sobre el nanobook", {
        cause: (error as AccessCheckFailedError).cause,
      }),
    );
  }
}
```

- [ ] **Paso 3: cableado**

En `Application.ts`: añade `public readonly authorizer: Authorizer` al constructor privado y pásalo en `new Application(...)` (importa el tipo `Authorizer` de `../../authorization/server`).

En `nanobooks/server/index.ts`, cambia `new NanobookWriteAccess(requireNanobookAccess)` por `new NanobookWriteAccess(authorizer)`.

- [ ] **Paso 4: verificar y commit**

Ejecuta: `npx vitest run src/nanobooks src/documents src/application` y `npm run build`.

```bash
git add src/application/server/Application.ts src/nanobooks/server/index.ts src/nanobooks/server/infraestructure/documents/NanobookWriteAccess.ts src/nanobooks/server/infraestructure/documents/NanobookWriteAccess.test.ts
git commit -m "refactor(nanobooks): NanobookWriteAccess se apoya en el módulo authorization" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Tarea 3: `GetNanobookById` y `AgentToolService`

**Archivos:**
- Crear: `src/nanobooks/server/application/GetNanobookById.ts` y `GetNanobookById.test.ts`
- Modificar: `src/nanobooks/server/index.ts` (expone `getNanobookById`)
- Modificar: `src/agents/server/index.ts` y `src/agents/server/application/AgentToolService.ts`
- Modificar: `src/application/server/Application.ts` (pasa `authorizer` a `AgentModule.create`)
- Modificar: los tests de agentes que construyan `AgentToolService` o `AgentModule` (busca con grep)

- [ ] **Paso 1: test de `GetNanobookById`**

```ts
import { describe, expect, it } from "vitest";

import { Nanobook } from "../domain/Nanobook";
import { InMemoryNanobookRepository } from "../infraestructure/repository/InMemoryNanobookRepository";
import { GetNanobookById } from "./GetNanobookById";
import { NanobookNotFoundError } from "./errors";

describe("GetNanobookById", () => {
  const book = Nanobook.create({ id: "one", ownerId: "owner", slug: "one", name: "One" }).getValue();

  it("devuelve el nanobook", async () => {
    const result = await new GetNanobookById(new InMemoryNanobookRepository([book])).execute("one");

    expect(result.getValue()).toBe(book);
  });

  it("falla con NanobookNotFoundError si no existe", async () => {
    const result = await new GetNanobookById(new InMemoryNanobookRepository([book])).execute("zzz");

    expect(result.getError()).toBeInstanceOf(NanobookNotFoundError);
  });
});
```

Ejecuta: `npx vitest run src/nanobooks/server/application/GetNanobookById.test.ts`. Esperado: FAIL (no se resuelve `./GetNanobookById`).

- [ ] **Paso 2: implementar**

```ts
import { Result } from "../../../shared/domain/Result";
import type { Nanobook } from "../domain/Nanobook";
import type { NanobookRepository, NanobookRepositoryFailure } from "../domain/ports/NanobookRepository";
import { NanobookNotFoundError } from "./errors";

/**
 * Carga un nanobook por id sin comprobar acceso: quien llama debe haber autorizado antes.
 * Va directo al repositorio (no a la caché de lectura) porque esa caché está indexada por slug
 * y esta consulta, usada solo por la herramienta MCP `get_nanobook`, es por id.
 */
export class GetNanobookById {
  constructor(private readonly repository: NanobookRepository) {}

  async execute(id: string): Promise<Result<NanobookRepositoryFailure | NanobookNotFoundError, Nanobook>> {
    const found = await this.repository.findById(id);
    if (!found.isSuccess) return Result.fail(found.getError());
    const nanobook = found.getValue();
    return nanobook ? Result.ok(nanobook) : Result.fail(new NanobookNotFoundError(id));
  }
}
```

Añádelo a `NanobookModule` (campo público `getNanobookById`, creado con `new GetNanobookById(repository)`).

- [ ] **Paso 3: migrar `AgentToolService`**

- El constructor recibe `authorizer: Authorizer` como cuarto parámetro; `AgentModule.create(nanobooks, blocks, authorizer)` lo pasa, y `Application.ts` lo suministra.
- `getNanobook(actor, nanobookId)`: tras comprobar el scope, llama a `this.access(actor, nanobookId, "read")` y, si es correcto, devuelve `this.nanobooks.getNanobookById.execute(nanobookId)`.
- `require(actor, nanobookId, permission)`: tras el scope, devuelve `this.access(actor, nanobookId, permission)`.
- Nuevo método privado:

```ts
  private access(actor: AgentActor, nanobookId: string, action: "read" | "write") {
    return this.authorizer.require({
      subject: Subject.of(actor.actorId),
      action,
      resource: { type: "nanobook", id: nanobookId },
    });
  }
```

`toMcpError` ya mapea `AccessDeniedError` y `AccessCheckFailedError` con mensajes fijos (iteración 2). Quita de él, **en la tarea 6**, las ramas viejas.

Ajusta los cuatro archivos de test que construyen `AgentToolService`, y la construcción de `AgentModule` en `Application.ts`:

- `src/agents/server/application/AgentToolService.test.ts`: solo necesita el cuarto argumento para que compile.
- `AgentToolService.read.test.ts`, `AgentToolService.write.test.ts` y `src/agents/server/infrastructure/mcp/createNanobookMcpServer.test.ts`: sus mocks son `as unknown as NanobookModule`, así que vitest no avisa del tipo y fallarían en tiempo de ejecución con un `TypeError` si el autorizador falta. Sustituye `requireNanobookAccess: { execute }` por un doble de autorizador, `{ require: vi.fn().mockResolvedValue(Result.ok()) } as unknown as Authorizer`, pasado como cuarto argumento, y añade `getNanobookById: { execute: vi.fn().mockResolvedValue(Result.ok(nanobook)) }` al mock del módulo donde se pruebe `getNanobook`.

Casos clave a conservar: un agente sobre un nanobook propio (ok), sobre uno privado ajeno (`require` devuelve `Result.fail(new AccessDeniedError({ effect: "deny", reason: "not-found" }))` y MCP responde 404 con mensaje fijo) y sin el scope (`AgentScopeDeniedError`).

- [ ] **Paso 4: verificar y commit**

Ejecuta: `npx vitest run src/nanobooks src/agents` y `npm run build`.

```bash
git add src/nanobooks/server/application/GetNanobookById.ts src/nanobooks/server/application/GetNanobookById.test.ts src/nanobooks/server/index.ts src/agents/server/index.ts src/agents/server/application/AgentToolService.ts src/application/server/Application.ts
git add src/agents/server/application/AgentToolService.test.ts src/agents/server/application/AgentToolService.read.test.ts src/agents/server/application/AgentToolService.write.test.ts src/agents/server/infrastructure/mcp/createNanobookMcpServer.test.ts
git commit -m "refactor(agents): AgentToolService autoriza con el módulo authorization" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Tarea 4: `resolveNanobookRoute` y `DocumentPage.astro`

**Archivos:**
- Modificar: `src/application/server/resolveNanobookRoute.ts` y `resolveNanobookRoute.test.ts`
- Modificar: `src/documents/browser/ui/pages/DocumentPage.astro`

- [ ] **Paso 1: actualizar el test de `resolveNanobookRoute`**

El `app` simulado del test debe incluir un `authorizer` real: `createAuthorizer([new NanobookAccessPolicy(new InMemoryNanobookRepository([nanobook]))])`. Casos que debe cubrir:
- lectura de un nanobook público sin sesión: devuelve `{ nanobook, user: null }` y **no** llama a `getSession`;
- lectura del dueño de un privado: devuelve nanobook y usuario;
- lectura de un ajeno en un privado: `Response` 404;
- escritura del dueño: ok;
- escritura sin sesión: 401;
- escritura de un ajeno sobre un nanobook **público**: 403;
- escritura de un ajeno sobre uno **privado**: 404 (cambio respecto a antes).

Ejecuta: `npx vitest run src/application/server/resolveNanobookRoute.test.ts`. Esperado: FAIL.

- [ ] **Paso 2: migrar `resolveNanobookRoute`**

Quita la importación de `AuthorizeNanobook` y sustituye el bloque desde `const authorization = new AuthorizeNanobook();` hasta el `return new Response(...)` final por:

```ts
  const decision = await app.authorizer.authorize({
    subject: Subject.of(user?.id),
    action: permission,
    resource: { type: "nanobook", id: nanobook.getId() },
  });
  if (decision.effect === "allow") return { nanobook, user };

  const status =
    permission === "read" || decision.effect !== "deny"
      ? 404
      : { unauthenticated: 401, forbidden: 403, "not-found": 404 }[decision.reason];
  const body = { 401: "Autenticación requerida", 403: "No tienes permiso de edición sobre el nanobook", 404: "Nanobook not found" }[status];
  return new Response(body, { status });
```

(importa `Subject` de `../../authorization/server`). La sesión ya está resuelta en `user`, así que `Subject.of(user?.id)` no vuelve a resolverla. En lectura un nanobook visible solo para su dueño sigue respondiendo 404.

- [ ] **Paso 3: migrar `DocumentPage.astro`**

Sustituye `import { AuthorizeNanobook } from "../../../../nanobooks/server";` por `import { Subject } from "../../../../authorization/server";` y la línea de `canEdit` por:

```ts
const canEdit =
  (await app.authorizer.authorize({
    subject: Subject.of(user?.id),
    action: "write",
    resource: { type: "nanobook", id: nanobookId },
  })).effect === "allow";
```

Los `.astro` no los ejecuta Vitest: lo verifica el build.

**`src/layouts/components/Header.test.ts` debe cambiar.** La línea 34 hace `expect(page).toContain("new AuthorizeNanobook().canWrite(nanobook, user?.id)")` sobre el texto de `DocumentPage.astro` y fallaría. Sustituye esa expectativa por dos: `expect(page).toContain("app.authorizer.authorize")` y `expect(page).toContain('action: "write"')`. Comprueba además que ese test no siga esperando el import de `AuthorizeNanobook`.

**Decisión consciente sobre el coste.** `canEdit` pasa de un cálculo en memoria a una consulta `findById` por render para los usuarios con sesión (el anónimo no consulta). Además, un fallo de la base de datos ahora produce un 500 en la página de lectura (`AccessCheckFailedError`), en lugar de ocultar el botón de edición. Se acepta en esta iteración: la ruta ya consultó el nanobook por slug y el coste es una lectura indexada. Si resulta medible, la iteración 4 puede reutilizar el nanobook ya cargado, sin cambiar el contrato.

- [ ] **Paso 4: verificar y commit**

Ejecuta: `npx vitest run src/application src/documents src/layouts` y `npm run build`.

```bash
git add src/application/server/resolveNanobookRoute.ts src/application/server/resolveNanobookRoute.test.ts src/documents/browser/ui/pages/DocumentPage.astro src/layouts/components/Header.test.ts
git commit -m "refactor(application): resolveNanobookRoute y DocumentPage autorizan con el módulo authorization" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Tarea 5: el guard HTTP y `unlock.ts`

**Archivos:**
- Modificar: `src/nanobooks/server/infraestructure/rest/withNanobookWriteAccess.ts` y `.test.ts`
- Modificar: `src/pages/api/nanobooks/[nanobookId]/documents/[id].ts`
- Modificar: `src/pages/api/nanobooks/[nanobookId]/document-access/index.ts`
- Modificar: `src/pages/api/nanobooks/[nanobookId]/document-access/unlock.ts`

El guard se mantiene como pieza transitoria: `documents` todavía usa su puerto `WriteAccess` y el guard es lo que hoy responde 404 a un ajeno sobre un nanobook privado. Se retirará en la iteración 4, cuando `documents` migre.

- [ ] **Paso 1: actualizar el test del guard**

El test debe usar un autorizador real (`createAuthorizer([new NanobookAccessPolicy(repo)])`) en lugar de un `NanobookAccessRequirement` simulado. Casos: sin sesión → 401 sin llamar al handler; dueño → llama al handler; ajeno sobre público → 403; ajeno sobre privado → 404; nanobook inexistente → 404; fallo del repositorio → 500; sin `nanobookId` en los parámetros → 404. Ejecuta el test: FAIL.

- [ ] **Paso 2: reimplementar el guard**

```ts
import type { APIRoute } from "astro";

import {
  Subject,
  accessErrorResponse,
  type Authorizer,
} from "../../../../authorization/server";
import type { RouteProtector } from "../../../../shared/server/capabilities/RouteProtector";

export function withNanobookWriteAccess(authorizer: Authorizer, handler: APIRoute): APIRoute {
  return async (context) => {
    const userId = context.locals.currentUserId;
    if (!userId) return Response.json({ error: "Autenticación requerida" }, { status: 401 });

    const nanobookId = context.params.nanobookId;
    if (!nanobookId) return Response.json({ error: "Nanobook no encontrado" }, { status: 404 });

    const result = await authorizer.require({
      subject: Subject.of(userId),
      action: "write",
      resource: { type: "nanobook", id: nanobookId },
    });
    if (!result.isSuccess) return accessErrorResponse(result.getError());

    return handler(context);
  };
}

export function protectNanobookWriteMutation(
  routeProtector: RouteProtector,
  authorizer: Authorizer,
  handler: APIRoute,
): APIRoute {
  return routeProtector.protect(withNanobookWriteAccess(authorizer, handler));
}
```

- [ ] **Paso 3: rutas**

En `documents/[id].ts` y `document-access/index.ts`, sustituye `app.nanobookModule.requireNanobookAccess` por `app.authorizer`.

En `unlock.ts`, sustituye el bloque de `requireNanobookAccess` por:

```ts
  const decision = await app.authorizer.authorize({
    subject: Subject.anonymous(),
    action: "read",
    resource: { type: "nanobook", id: nanobookId },
  });
  if (decision.effect !== "allow") {
    return new Response(JSON.stringify({ error: "Documento no encontrado" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
```

(importa `Subject` de `../../../../../authorization/server`). Un fallo técnico lanza `AccessCheckFailedError` y Astro responde 500: es el comportamiento correcto.

- [ ] **Paso 4: verificar y commit**

Ejecuta: `npx vitest run src/nanobooks src/pages` y `npm run build`.

```bash
git add src/nanobooks/server/infraestructure/rest/withNanobookWriteAccess.ts src/nanobooks/server/infraestructure/rest/withNanobookWriteAccess.test.ts "src/pages/api/nanobooks/[nanobookId]/documents/[id].ts" "src/pages/api/nanobooks/[nanobookId]/document-access/index.ts" "src/pages/api/nanobooks/[nanobookId]/document-access/unlock.ts"
git commit -m "refactor(nanobooks): el guard de escritura y unlock autorizan con el módulo authorization" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Tarea 6: borrar el código viejo

**Archivos:**
- Borrar: `src/nanobooks/server/application/AuthorizeNanobook.ts` y `.test.ts`, `RequireNanobookAccess.ts` y `.test.ts`
- Modificar: `src/nanobooks/server/index.ts`, `McpToolResult.ts` y su test, `NanobookLifecycleController.ts`, y cualquier otro archivo que el grep devuelva

- [ ] **Paso 1: comprobar que ya no hay consumidores**

Ejecuta: `rg -n "AuthorizeNanobook|RequireNanobookAccess|NanobookAccessRequirement|NanobookAccessDeniedError|NanobookPermission|requireNanobookAccess" src --glob '!src/**/*.test.ts'`

Esperado: solo aparecen sus definiciones, `nanobooks/server/index.ts` (exportaciones y campo del módulo), `McpToolResult.ts` y `NanobookLifecycleController.ts` (mapeos por nombre de error). Si aparece cualquier otro consumidor, **detente** e infórmalo: significa que una tarea anterior dejó algo sin migrar.

- [ ] **Paso 2: borrar y limpiar**

- Borra los cuatro archivos.
- En `nanobooks/server/index.ts`: quita las importaciones, las exportaciones (`AuthorizeNanobook`, `NanobookAccessDeniedError`, `NanobookPermission`, `RequireNanobookAccess`), la creación de `authorizeNanobook` y de `requireNanobookAccess`, y el campo público `requireNanobookAccess` del módulo y de su constructor.
- En `McpToolResult.ts`, quita `NanobookAccessDeniedError` de la rama 403 (queda `AgentScopeDeniedError`, `DocumentAccessDeniedError`); `NanobookNotFoundError` se mantiene (lo sigue lanzando `GetNanobookById` y las carreras de borrado).
- En `NanobookLifecycleController.ts`, quita la clave `NanobookAccessDeniedError: 403` del mapa.
- Elimina de los tests las referencias a esos símbolos (por ejemplo, casos de `McpToolResult.test.ts` que construyan `NanobookAccessDeniedError`; sustitúyelos por `AccessDeniedError`).

- [ ] **Paso 3: verificar**

Ejecuta de nuevo el `rg` del paso 1 (incluyendo tests): esperado, sin resultados. Ejecuta `npx vitest run` (todo en verde), `npx -p typescript tsc --noEmit -p .` (sin errores nuevos en los archivos tocados) y `npm run build`.

- [ ] **Paso 4: commit**

```bash
git rm src/nanobooks/server/application/AuthorizeNanobook.ts src/nanobooks/server/application/AuthorizeNanobook.test.ts src/nanobooks/server/application/RequireNanobookAccess.ts src/nanobooks/server/application/RequireNanobookAccess.test.ts
git add src/nanobooks/server/index.ts src/agents/server/infrastructure/mcp/McpToolResult.ts src/agents/server/infrastructure/mcp/McpToolResult.test.ts src/nanobooks/server/infraestructure/rest/NanobookLifecycleController.ts
git add <cualquier otro archivo de test o fuente que hayas ajustado, por ruta>
git commit -m "refactor(nanobooks): elimina AuthorizeNanobook, RequireNanobookAccess y NanobookAccessDeniedError" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Tarea 7: changelog

- [ ] **Paso 1:** revisa `git diff CHANGELOG.md` (debe estar vacío) e inserta justo debajo de `## [Unreleased]`, seguida de una línea en blanco:

```markdown
- **Changed:** el acceso a nanobooks pasa por completo por el módulo `authorization`: `resolveNanobookRoute`, la página de documento, las herramientas MCP, las rutas de mutación y el adaptador `NanobookWriteAccess` usan `Authorizer`. Se eliminan `AuthorizeNanobook`, `RequireNanobookAccess` y `NanobookAccessDeniedError`. Un usuario ajeno que intenta editar o mutar contenido de un nanobook privado recibe 404 en lugar de 403, igual que si no existiera. Los textos de error de las rutas de mutación cambian ("No tienes permiso sobre este recurso", "Recurso no encontrado"). `canEdit` de la página de documento consulta ahora el nanobook por render para los usuarios con sesión.
```

- [ ] **Paso 2:** `npm run build` y commit:

```bash
git add CHANGELOG.md
git commit -m "docs(nanobooks): registra la migración del acceso a authorization en el changelog" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Fuera de esta iteración

Quedan para la iteración 4:

- `DocumentPasswordPolicy`, `documentResource` y la migración de los casos de uso de `documents` a `Authorizer`.
- La retirada del puerto `WriteAccess`, `NanobookWriteAccess`, `canWrite`, `AuthorizeDocumentAccess` y del guard `withNanobookWriteAccess`.
- El manejo de `DocumentAccessDeniedError` y `WriteAccessDeniedError` en los controladores de `documents`.
- La documentación de la decisión en `src/content/nanobook-project/`.
