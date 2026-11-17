# Política de acceso de `nanobooks` (iteración 2): plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** que `nanobooks` registre su política de acceso en el módulo `authorization` y que `UpdateNanobook`, `DeleteNanobook` y `SetNanobookTheme` autoricen a través de `Authorizer` en lugar de `AuthorizeNanobook`.

**Arquitectura:**
- `NanobookAccessPolicy` implementa `Policy` para los tipos `nanobook` y `document`. Carga el nanobook por id desde el repositorio.
- `Application` crea un único `Authorizer` sobre un arreglo de políticas compartido. Cada módulo añade su política a ese arreglo al crearse.
- `createAuthorizer` filtra las políticas en cada llamada, así que registrar una política después de crear el autorizador funciona. Un módulo que no se registre queda fuera de las decisiones, y por el fallo cerrado eso significa denegar.
- Los casos de uso migrados siguen cargando el nanobook (lo necesitan para modificarlo) y llaman a `authorizer.require` para decidir.

**Stack:** TypeScript (Astro strict), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-17-authorization-module-design.md`, secciones «Políticas iniciales → `nanobooks`» y «Dónde se comprueba». Esta iteración cubre la **mitad de la etapa 2 del spec**: la política, su registro y los casos de uso de `nanobooks`. El resto de la etapa 2 queda para la iteración 3.

**Reglas del repo:**
- Antes de cada commit, ejecutar `npm run build` y comprobar que pasa.
- Mensajes con Conventional Commits, en español.
- **Nunca uses `git add -A` ni `git add .`**: añade solo los archivos de la tarea.
- Termina cada mensaje de commit con la línea `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Verificación de tipos: `npx -p typescript tsc --noEmit -p .`. Hay errores previos en otros módulos (`agents`, `profiles`, `theme`, `application/Application.test.ts`); solo importan los de los archivos que toques.
- `AuthorizeNanobook` y `RequireNanobookAccess` **no se borran** en esta iteración: los siguen usando `resolveNanobookRoute`, `AgentToolService`, `withNanobookWriteAccess`, `DocumentPage.astro` y `NanobookWriteAccess`.

## Decisiones de comportamiento (ya validadas en el spec)

| Caso | Antes | Después |
| --- | --- | --- |
| Escritura de un ajeno en un nanobook **privado** | 403 | 404 (`not-found`, no revela que existe) |
| Escritura de un ajeno en un nanobook **público** | 403 | 403 |
| Escritura sin usuario | 401 (por el controlador) | `unauthenticated`, 401 |
| Fallo técnico del repositorio | 500 | 500 |

---

## Estructura de archivos

| Archivo | Responsabilidad |
| --- | --- |
| `src/nanobooks/server/application/NanobookAccessPolicy.ts` | La política: dueño y visibilidad. |
| `src/nanobooks/server/application/NanobookAccessPolicy.test.ts` | Tests de la política. |
| `src/nanobooks/server/application/UpdateNanobook.ts`, `DeleteNanobook.ts`, `SetNanobookTheme.ts` | Reciben `Authorizer` y llaman a `require`. |
| `src/nanobooks/server/application/NanobookLifecycle.test.ts`, `SetNanobookTheme.test.ts`, `src/nanobooks/server/infraestructure/rest/NanobookLifecycleController.test.ts` | Pasan a construir los casos de uso con un autorizador real. |
| `src/nanobooks/server/infraestructure/rest/NanobookLifecycleController.ts` | Traduce `AccessDeniedError` y `AccessCheckFailedError` con `accessErrorResponse`. |
| `src/agents/server/infrastructure/mcp/McpToolResult.ts` | Mapea los nuevos errores de acceso. |
| `src/nanobooks/server/index.ts` | Crea la política, la registra y la inyecta. |
| `src/application/server/Application.ts` | Crea el `Authorizer` y el arreglo de políticas. |
| `src/authorization/server/application/createAuthorizer.test.ts` | Un test más: registrar una política después de crear el autorizador. |
| `CHANGELOG.md` | Entrada en `[Unreleased]`. |

---

### Tarea 1: `NanobookAccessPolicy`

**Archivos:**
- Crear: `src/nanobooks/server/application/NanobookAccessPolicy.test.ts`
- Crear: `src/nanobooks/server/application/NanobookAccessPolicy.ts`

- [ ] **Paso 1: escribir los tests**

```ts
import { describe, expect, it, vi } from "vitest";

import { AccessCheckFailedError } from "../../../authorization/server";
import { createAuthorizer, Subject, type Resource } from "../../../authorization/server";
import { Result } from "../../../shared/domain/Result";
import { Nanobook } from "../domain/Nanobook";
import { NanobookRepositoryError } from "../domain/errors";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import { InMemoryNanobookRepository } from "../infraestructure/repository/InMemoryNanobookRepository";
import { NanobookAccessPolicy } from "./NanobookAccessPolicy";

const book = (id: string, ownerId: string, visibility: "public" | "private") =>
  Nanobook.create({ id, ownerId, slug: id, name: id, visibility }).getValue();

const subjectOf = (userId?: string): Subject => ({
  userId: async () => userId,
  grantFor: () => undefined,
});

function setup() {
  const repository = new InMemoryNanobookRepository([
    book("pub", "owner", "public"),
    book("priv", "owner", "private"),
  ]);
  return createAuthorizer([new NanobookAccessPolicy(repository)]);
}

const nanobook = (id: string): Resource => ({ type: "nanobook", id });
const document = (nanobookId: string): Resource => ({ type: "document", id: "d-1", nanobookId });

describe("NanobookAccessPolicy · lectura", () => {
  it("un nanobook público lo lee cualquiera, también un anónimo", async () => {
    const authorizer = setup();

    expect((await authorizer.authorize({ subject: Subject.anonymous(), action: "read", resource: nanobook("pub") })).effect).toBe("allow");
  });

  it("un nanobook privado solo lo lee su dueño; a los demás les responde not-found", async () => {
    const authorizer = setup();

    expect((await authorizer.authorize({ subject: subjectOf("owner"), action: "read", resource: nanobook("priv") })).effect).toBe("allow");
    expect(await authorizer.authorize({ subject: subjectOf("other"), action: "read", resource: nanobook("priv") })).toEqual({ effect: "deny", reason: "not-found" });
    expect(await authorizer.authorize({ subject: Subject.anonymous(), action: "read", resource: nanobook("priv") })).toEqual({ effect: "deny", reason: "not-found" });
  });

  it("la lectura de un nanobook público no resuelve la sesión", async () => {
    const authorizer = setup();
    const userId = vi.fn(async () => "owner");

    await authorizer.authorize({ subject: { userId, grantFor: () => undefined }, action: "read", resource: nanobook("pub") });

    expect(userId).not.toHaveBeenCalled();
  });
});

describe("NanobookAccessPolicy · escritura", () => {
  it("el dueño escribe, tanto en nanobooks públicos como privados", async () => {
    const authorizer = setup();

    for (const id of ["pub", "priv"]) {
      expect((await authorizer.authorize({ subject: subjectOf("owner"), action: "write", resource: nanobook(id) })).effect).toBe("allow");
    }
  });

  it("un ajeno recibe forbidden en un nanobook público y not-found en uno privado", async () => {
    const authorizer = setup();

    expect(await authorizer.authorize({ subject: subjectOf("other"), action: "write", resource: nanobook("pub") })).toEqual({ effect: "deny", reason: "forbidden" });
    expect(await authorizer.authorize({ subject: subjectOf("other"), action: "write", resource: nanobook("priv") })).toEqual({ effect: "deny", reason: "not-found" });
  });

  it("un anónimo recibe unauthenticated sin consultar el repositorio, exista o no el nanobook", async () => {
    const findById = vi.fn();
    const repository = { findById } as unknown as NanobookRepository;
    const authorizer = createAuthorizer([new NanobookAccessPolicy(repository)]);

    for (const id of ["priv", "no-existe"]) {
      expect(await authorizer.authorize({ subject: Subject.anonymous(), action: "write", resource: nanobook(id) })).toEqual({ effect: "deny", reason: "unauthenticated" });
    }
    expect(findById).not.toHaveBeenCalled();
  });
});

describe("NanobookAccessPolicy · documentos y errores", () => {
  it("evalúa un recurso de tipo document por su nanobookId", async () => {
    const authorizer = setup();

    expect((await authorizer.authorize({ subject: subjectOf("owner"), action: "write", resource: document("priv") })).effect).toBe("allow");
    expect(await authorizer.authorize({ subject: subjectOf("other"), action: "write", resource: document("priv") })).toEqual({ effect: "deny", reason: "not-found" });
  });

  it("un document sin nanobookId se deniega", async () => {
    const authorizer = setup();
    const resource: Resource = { type: "document", id: "d-1" };

    expect(await authorizer.authorize({ subject: subjectOf("owner"), action: "read", resource })).toEqual({ effect: "deny", reason: "forbidden" });
  });

  it("un nanobook inexistente responde not-found", async () => {
    const authorizer = setup();

    expect(await authorizer.authorize({ subject: subjectOf("owner"), action: "read", resource: nanobook("no-existe") })).toEqual({ effect: "deny", reason: "not-found" });
  });

  it("un fallo del repositorio es un error técnico, nunca un deny ni un allow", async () => {
    const repository = {
      findById: async () => Result.fail(new NanobookRepositoryError("db caída")),
    } as unknown as NanobookRepository;
    const authorizer = createAuthorizer([new NanobookAccessPolicy(repository)]);

    await expect(
      authorizer.authorize({ subject: subjectOf("owner"), action: "read", resource: nanobook("pub") }),
    ).rejects.toBeInstanceOf(AccessCheckFailedError);
  });
});
```

- [ ] **Paso 2: ejecutar los tests y verificar que fallan**

Ejecuta: `npx vitest run src/nanobooks/server/application/NanobookAccessPolicy.test.ts`
Esperado: FAIL, porque no se puede resolver `./NanobookAccessPolicy`.

- [ ] **Paso 3: implementar la política**

```ts
import type { AccessRequest, Decision, Policy } from "../../../authorization/server";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";

/**
 * Dueño y visibilidad. El dueño y la visibilidad se leen siempre del repositorio:
 * nunca de `attributes`, que no es una fuente confiable para estos hechos.
 */
export class NanobookAccessPolicy implements Policy {
  readonly appliesTo = ["nanobook", "document"] as const;

  constructor(private readonly repository: NanobookRepository) {}

  async evaluate({ subject, action, resource }: AccessRequest): Promise<Decision> {
    const nanobookId = resource.type === "nanobook" ? resource.id : resource.nanobookId;
    if (!nanobookId) return { effect: "deny", reason: "forbidden" };

    // En escritura la sesión se resuelve una sola vez; en lectura pública no se resuelve.
    const userId = action === "write" ? await subject.userId() : undefined;

    // Un anónimo no puede escribir: se decide antes de consultar si el nanobook existe,
    // para que no pueda distinguir un nanobook privado de uno inexistente.
    if (action === "write" && !userId) {
      return { effect: "deny", reason: "unauthenticated" };
    }

    const found = await this.repository.findById(nanobookId);
    if (!found.isSuccess) throw found.getError();
    const nanobook = found.getValue();
    if (!nanobook) return { effect: "deny", reason: "not-found" };

    if (action === "read" && nanobook.getVisibility() === "public") return { effect: "allow" };

    const requester = action === "write" ? userId : await subject.userId();
    if (requester !== undefined && requester === nanobook.getOwnerId()) return { effect: "allow" };

    // Quien no puede ver un nanobook privado no debe poder detectar que existe.
    return nanobook.getVisibility() === "private"
      ? { effect: "deny", reason: "not-found" }
      : { effect: "deny", reason: "forbidden" };
  }
}
```

Los tests de la tarea 2 de `authorization` importan `Subject`, `createAuthorizer` y `Resource` desde `index.ts`. Comprueba que `index.ts` exporta `Subject` como valor además de como tipo (ya lo hace: `export { Subject, ... }`).

- [ ] **Paso 4: ejecutar los tests y verificar que pasan**

Ejecuta: `npx vitest run src/nanobooks/server/application/NanobookAccessPolicy.test.ts`
Esperado: PASS (10 tests).

- [ ] **Paso 5: verificar tipos, build y commit**

Ejecuta: `npx -p typescript tsc --noEmit -p .` (sin errores en los archivos nuevos) y `npm run build` (`Complete!`).

```bash
git add src/nanobooks/server/application/NanobookAccessPolicy.ts src/nanobooks/server/application/NanobookAccessPolicy.test.ts
git commit -m "feat(nanobooks): añade la política de acceso por dueño y visibilidad" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Tarea 2: el registro de políticas admite altas posteriores

**Archivos:**
- Modificar: `src/authorization/server/application/createAuthorizer.test.ts`
- Modificar: `src/authorization/server/application/createAuthorizer.ts` (solo el comentario de documentación)

`Application` creará el `Authorizer` antes de que existan los módulos y añadirá las políticas a medida que se crean. Esto ya funciona porque el motor filtra `policies` en cada llamada. Este paso lo deja fijado con un test y documentado.

- [ ] **Paso 1: escribir el test**

Añade este test dentro del primer `describe("createAuthorizer · authorize", ...)`, junto a los demás:

```ts
  it("considera las políticas registradas después de crear el autorizador", async () => {
    const policies: Policy[] = [];
    const authorizer = createAuthorizer(policies);

    expect(await authorizer.authorize(request())).toEqual(deny("forbidden"));

    policies.push(policy(allow));

    expect(await authorizer.authorize(request())).toEqual(allow);
  });
```

- [ ] **Paso 2: ejecutar el test**

Ejecuta: `npx vitest run src/authorization/server/application/createAuthorizer.test.ts`
Esperado: PASS (el comportamiento ya existe; el test lo fija).

- [ ] **Paso 3: documentar el contrato**

En `createAuthorizer.ts`, sustituye el comentario de la función por:

```ts
/**
 * Motor de decisión. Conceder exige al menos un `allow` explícito y ningún `deny` ni `challenge`.
 *
 * El arreglo de políticas se consulta en cada llamada, así que se pueden registrar políticas
 * después de crear el autorizador (cada módulo añade la suya al componerse). Hasta que una
 * política se registra no concede nada: falla cerrado.
 */
```

- [ ] **Paso 4: build y commit**

Ejecuta: `npx vitest run src/authorization` (esperado: PASS, con un test más que antes de este paso) y `npm run build`.

```bash
git add src/authorization/server/application/createAuthorizer.ts src/authorization/server/application/createAuthorizer.test.ts
git commit -m "test(authorization): fija que las políticas pueden registrarse después de crear el motor" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Tarea 3: cableado en `Application` y `NanobookModule`

**Archivos:**
- Modificar: `src/application/server/Application.ts`
- Modificar: `src/nanobooks/server/index.ts`

No hay test nuevo: son pruebas de composición, cubiertas por el build y por la suite completa.

- [ ] **Paso 1: `Application.ts`**

Añade las importaciones:

```ts
import { createAuthorizer, type Policy } from "../../authorization/server";
```

Dentro de `Application.create`, justo después de `const eventBus = new InMemoryEventBus();`:

```ts
    // Las políticas las registra cada módulo al crearse; el autorizador las consulta en cada petición.
    const policies: Policy[] = [];
    const authorizer = createAuthorizer(policies);
```

Y cambia la creación del módulo:

```ts
    const nanobookModule = await NanobookModule.create(eventBus, authorizer, policies);
```

- [ ] **Paso 2: `nanobooks/server/index.ts`**

Añade las importaciones:

```ts
import type { Authorizer, Policy } from "../../authorization/server";
import { NanobookAccessPolicy } from "./application/NanobookAccessPolicy";
```

Cambia la firma y el principio de `create`:

```ts
  static async create(
    eventBus: EventBus,
    authorizer: Authorizer,
    policies: Policy[],
  ): Promise<NanobookModule> {
    const repository = new DrizzleNanobookRepository(db);
    policies.push(new NanobookAccessPolicy(repository));
```

Y pasa el autorizador a los tres casos de uso:

```ts
    const updateNanobook = new UpdateNanobook(repository, readCache, authorizer);
    const deleteNanobook = new DeleteNanobook(repository, readCache, authorizer);
```

y, en el `return new NanobookModule(...)`:

```ts
      new SetNanobookTheme(repository, readCache, authorizer),
```

Los tres constructores se actualizan en la tarea 4; hasta entonces el build fallará. **Haz esta tarea y la 4 sin commit intermedio**: el commit es el de la tarea 4.

---

### Tarea 4: `Update`, `Delete` y `SetNanobookTheme` autorizan con `Authorizer`

**Archivos:**
- Modificar: `src/nanobooks/server/application/UpdateNanobook.ts`, `DeleteNanobook.ts`, `SetNanobookTheme.ts`
- Modificar: `src/nanobooks/server/application/NanobookLifecycle.test.ts`, `SetNanobookTheme.test.ts`, `src/nanobooks/server/infraestructure/rest/NanobookLifecycleController.test.ts`
- Modificar: `src/nanobooks/server/infraestructure/rest/NanobookLifecycleController.ts`
- Modificar: `src/agents/server/infrastructure/mcp/McpToolResult.ts` y `McpToolResult.test.ts`
- Modificar: `src/theme/server/infraestructure/rest/AssignNanobookThemeController.ts` (y su test)

- [ ] **Paso 1: actualizar los tests (deben fallar)**

En los tres archivos de test, crea el caso de uso con un autorizador real:

```ts
import { createAuthorizer } from "../../../authorization/server";
import { NanobookAccessPolicy } from "./NanobookAccessPolicy";
// ...
const authorizer = createAuthorizer([new NanobookAccessPolicy(repository)]);
new UpdateNanobook(repository, cache, authorizer);
new DeleteNanobook(repository, cache, authorizer);
new SetNanobookTheme(repository, cache(), authorizer);
```

(En `NanobookLifecycleController.test.ts` la ruta de importación es `../../../../authorization/server` y `../../application/NanobookAccessPolicy`.)

Ajusta las expectativas que cambian:

- En `NanobookLifecycle.test.ts`, el test «allows only the owner to mutate even a public nanobook» espera ahora `AccessDeniedError` (el nanobook es público, así que sigue siendo `forbidden`). Añade un caso sobre un nanobook **privado**: un ajeno recibe `AccessDeniedError` con `decision` `{ effect: "deny", reason: "not-found" }`. Sustituye `.getError().name).toBe("NanobookAccessDeniedError")` por `.getError()).toBeInstanceOf(AccessDeniedError)`, importando `AccessDeniedError` de `../../../authorization/server`.
- En `SetNanobookTheme.test.ts`, el caso `owner-2` sigue siendo un fallo (`isSuccess` falso): no cambia.
- En `NanobookLifecycleController.test.ts`, el test que llama a `controller.update(context('{"name":"New"}', "stranger"))` espera 403 sobre un nanobook privado (la visibilidad por defecto es `private`): cambia esa expectativa a **404** (es obligatorio) y añade uno que compruebe 403 sobre un nanobook público. El 401 de `context('{}', '')` no cambia: lo da el controlador. Si hay tests que simulan errores con `NanobookAccessDeniedError`, déjalos solo si el controlador conserva ese mapeo (ver paso 3).
- Busca con grep otros tests que dependan del 403 o de `NanobookAccessDeniedError` para estos casos de uso (`src/theme`, `src/agents`) y ajústalos igual.

Ejecuta: `npx vitest run src/nanobooks`
Esperado: FAIL (los constructores todavía no aceptan el autorizador).

- [ ] **Paso 2: migrar los casos de uso**

En `UpdateNanobook.ts`:

```ts
import type { Authorizer } from "../../../authorization/server";
// quita AuthorizeNanobook y NanobookAccessDeniedError de los imports

  constructor(
    private readonly repository: NanobookRepository,
    private readonly cache: NanobookReadCache,
    private readonly authorizer: Authorizer,
  ) {}

  async execute(userId: string, id: string, input: unknown): Promise<Result<Error, Nanobook>> {
    // Primero se autoriza y después se carga: así un nanobook inexistente y uno privado ajeno
    // responden igual (deny not-found) y no se puede sondear su existencia.
    const access = await this.authorizer.require({
      subject: { userId: async () => userId, grantFor: () => undefined },
      action: "write",
      resource: { type: "nanobook", id },
    });
    if (!access.isSuccess) return Result.fail(access.getError());

    const found = await this.repository.findById(id);
    if (!found.isSuccess) return Result.fail(found.getError());
    const book = found.getValue();
    // Solo por una carrera: borrado entre la autorización y la carga.
    if (!book) return Result.fail(new NanobookNotFoundError(id));
    // ... el resto sin cambios
```

En `DeleteNanobook.ts` y `SetNanobookTheme.ts`, aplica el mismo cambio: inyecta `authorizer` como tercer parámetro del constructor, mueve la comprobación de acceso **antes** de `findById` (en `SetNanobookTheme` va tras la validación de `reference`, que no depende del nanobook), sustituye el `if (!new AuthorizeNanobook().canWrite(...))` por la llamada a `require` anterior y quita los imports de `AuthorizeNanobook` y `NanobookAccessDeniedError`.

Los tests que esperaban `NanobookNotFoundError` para un nanobook inexistente pasan a esperar `AccessDeniedError` con `decision` `{ effect: "deny", reason: "not-found" }`. Añade un test por caso de uso que fije que un nanobook inexistente y uno privado ajeno producen la misma decisión.

- [ ] **Paso 3: traducir los errores en el controlador y en MCP**

En `NanobookLifecycleController.ts`, importa `AccessCheckFailedError`, `AccessDeniedError` y `accessErrorResponse` desde `../../../../authorization/server`, y al principio de `failure(error)` añade:

```ts
  if (error instanceof AccessDeniedError || error instanceof AccessCheckFailedError) {
    return accessErrorResponse(error);
  }
```

El mapeo por nombre (`NanobookAccessDeniedError`, `NanobookNotFoundError`, etc.) se queda: `NanobookNotFoundError` sigue saliendo cuando el nanobook no existe.

Un tercer consumidor mapea por nombre y debe cambiar: `src/theme/server/infraestructure/rest/AssignNanobookThemeController.ts` (usa `SetNanobookTheme` y hoy responde 403 con `error.name.includes("AccessDenied")`). Importa `AccessCheckFailedError`, `AccessDeniedError` y `accessErrorResponse` desde `../../../../authorization/server` y, justo después de `const error = result.getError();`, añade:

```ts
      if (error instanceof AccessDeniedError || error instanceof AccessCheckFailedError) {
        return accessErrorResponse(error);
      }
```

Añade un test (en el archivo de tests de ese controlador, o créalo si no existe) que compruebe 404 para un ajeno sobre un nanobook privado y 403 sobre uno público.

En `McpToolResult.ts`, importa `AccessCheckFailedError` y `AccessDeniedError` desde `../../../../authorization/server`, y en `toMcpError` añade (con mensajes fijos, sin usar `error.message`, para que un `not-found` no se distinga de un nanobook inexistente):

```ts
  if (error instanceof AccessDeniedError) {
    const decision = error.decision;
    if (decision.effect === "challenge") return { code: 401, error: "Este recurso requiere contraseña" };
    switch (decision.reason) {
      case "unauthenticated":
        return { code: 401, error: "Autenticación requerida" };
      case "not-found":
        return { code: 404, error: "Recurso no encontrado" };
      default:
        return { code: 403, error: "No tienes permiso sobre este recurso" };
    }
  }
  if (error instanceof AccessCheckFailedError) {
    return { code: 500, error: "La operación no pudo completarse" };
  }
```

Añade en el test de `McpToolResult` (busca `McpToolResult.test.ts`; si no existe, créalo) un caso por cada rama: `deny(forbidden)` → 403, `deny(not-found)` → 404, `AccessCheckFailedError` → 500.

- [ ] **Paso 4: ejecutar los tests**

Ejecuta: `npx vitest run src/nanobooks src/agents src/authorization`
Esperado: PASS.

- [ ] **Paso 5: suite completa, tipos, build y commit**

Ejecuta: `npx vitest run` (esperado: sin fallos nuevos; la línea base es 146 archivos y 694 tests, más los de esta iteración), `npx -p typescript tsc --noEmit -p .` (sin errores en los archivos tocados) y `npm run build`.

```bash
git add src/application/server/Application.ts src/nanobooks/server/index.ts src/nanobooks/server/application/UpdateNanobook.ts src/nanobooks/server/application/DeleteNanobook.ts src/nanobooks/server/application/SetNanobookTheme.ts src/nanobooks/server/application/NanobookLifecycle.test.ts src/nanobooks/server/application/SetNanobookTheme.test.ts src/nanobooks/server/infraestructure/rest/NanobookLifecycleController.ts src/nanobooks/server/infraestructure/rest/NanobookLifecycleController.test.ts src/agents/server/infrastructure/mcp/McpToolResult.ts
git add src/agents/server/infrastructure/mcp/McpToolResult.test.ts src/theme/server/infraestructure/rest/AssignNanobookThemeController.ts
git add <los tests nuevos o modificados del controlador de tema, si los hay>
# Además, añade cualquier otro test que hayas ajustado por el cambio 403→404, siempre por ruta explícita.
git commit -m "refactor(nanobooks): autoriza Update, Delete y SetTheme con el módulo authorization" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Tarea 5: changelog

**Archivos:**
- Modificar: `CHANGELOG.md`

- [ ] **Paso 1: añadir la entrada**

Revisa `git diff CHANGELOG.md` (debe estar vacío). Inserta justo debajo de `## [Unreleased]`, seguida de una línea en blanco:

```markdown
- **Changed:** `nanobooks` registra su política de acceso (dueño y visibilidad) en el módulo `authorization` y `UpdateNanobook`, `DeleteNanobook` y `SetNanobookTheme` autorizan a través de `Authorizer`. Un usuario ajeno que intenta modificar un nanobook privado recibe 404 en lugar de 403, para no revelar que existe; sobre uno público sigue recibiendo 403.
```

- [ ] **Paso 2: build y commit**

Ejecuta: `npm run build` (`Complete!`).

```bash
git add CHANGELOG.md
git commit -m "docs(nanobooks): registra la política de acceso en el changelog" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Fuera de esta iteración

Quedan para la iteración 3:

- `GetNanobookById` y la migración de `AgentToolService`, `resolveNanobookRoute`, `DocumentPage.astro` y `NanobookWriteAccess`.
- `unlock.ts` y las rutas con `withNanobookWriteAccess`.
- La política de `documents` y sus casos de uso.
- El borrado del código viejo (`AuthorizeNanobook`, `RequireNanobookAccess`, `withNanobookWriteAccess`).
