# Módulo `authorization` (iteración 1): plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** crear el módulo `src/authorization/server/`. Incluye el contrato de acceso, el motor `createAuthorizer`, los errores y la traducción HTTP `accessErrorResponse`, todo cubierto por tests. Ningún otro módulo lo usa todavía.

**Arquitectura:**
- El motor recibe una lista de políticas y evalúa las que aplican al tipo de recurso.
- Combina sus decisiones así: `deny` gana sobre `challenge`, `challenge` sobre `allow`, y si no hay ningún `allow` el resultado es `deny`.
- Si una política lanza una excepción, el motor lanza `AccessCheckFailedError` y nunca concede.
- El módulo no importa ningún otro módulo de negocio. Solo usa `shared/domain/Result`.

**Stack:** TypeScript (Astro strict), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-17-authorization-module-design.md`, secciones «Diseño» y «Traducción HTTP y MCP». Esta iteración cubre **solo la etapa 1**.

**Reglas del repo:**
- Antes de cada commit, ejecutar `npm run build` y comprobar que pasa.
- Mensajes con Conventional Commits, en español.
- El worktree tiene cambios ajenos sin commitear. **Nunca uses `git add -A` ni `git add .`**: añade solo los archivos de la tarea.
- Termina cada mensaje de commit con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `npm run build` compila también esos cambios ajenos. Si el build falla en archivos fuera de `src/authorization/`, no es culpa de esta tarea: detente e infórmalo, sin corregirlo.
- Antes de añadir `CHANGELOG.md`, revisa `git diff CHANGELOG.md` para confirmar que solo contiene tu entrada.

---

## Estructura de archivos

| Archivo | Responsabilidad |
| --- | --- |
| `src/authorization/server/domain/types.ts` | Tipos del contrato: `Subject`, `Action`, `Resource`, `AccessRequest`, `Decision`, `ResolvedDecision`, `DeniedDecision`, `Authorize` y `Policy`. Incluye el helper `Subject.anonymous()`. |
| `src/authorization/server/domain/errors.ts` | `AccessDeniedError`, que conserva la decisión, y `AccessCheckFailedError`, que conserva la causa. |
| `src/authorization/server/application/createAuthorizer.ts` | La interfaz `Authorizer` y el motor: selección de políticas, combinación, errores técnicos y `require`. |
| `src/authorization/server/application/createAuthorizer.test.ts` | Tests del motor. |
| `src/authorization/server/infrastructure/http.ts` | `accessErrorResponse`, que traduce los errores a `Response`. |
| `src/authorization/server/infrastructure/http.test.ts` | Tests de la traducción. |
| `src/authorization/server/index.ts` | El compositor y la API pública del módulo. |
| `CHANGELOG.md` | Una entrada en `[Unreleased]`. |

---

### Tarea 1: Tipos y errores del dominio

**Archivos:**
- Crear: `src/authorization/server/domain/types.ts`
- Crear: `src/authorization/server/domain/errors.ts`

Son solo tipos y clases de error sin lógica. Se verifican con los tests de las tareas 2 y 3 y con el build.

- [ ] **Paso 1: crear `types.ts`**

```ts
/** Quién pide el acceso. La sesión se resuelve de forma perezosa: solo si una política la necesita. */
export type Subject = {
  userId(): Promise<string | undefined>;
  /** Credencial presentada para un recurso concreto (p. ej. token de desbloqueo de un documento). */
  grantFor(resourceId: string): string | undefined;
};

export const Subject = {
  /** Sujeto sin sesión ni credenciales. */
  anonymous(): Subject {
    return {
      userId: async () => undefined,
      grantFor: () => undefined,
    };
  },
};

export type Action = "read" | "write";

export type Resource = {
  /** Tipo definido por el módulo dueño del recurso: "nanobook", "document"... */
  type: string;
  id: string;
  nanobookId?: string;
  /** Hechos ya cargados por código de servidor del módulo dueño. Nunca provienen del cliente. */
  attributes?: Readonly<Record<string, unknown>>;
};

export type AccessRequest = {
  subject: Subject;
  action: Action;
  resource: Resource;
};

export type DenyReason = "unauthenticated" | "forbidden" | "not-found";

export type Decision =
  | { effect: "allow" }
  | { effect: "abstain" }
  | { effect: "deny"; reason: DenyReason }
  | { effect: "challenge"; kind: "password" };

/** Lo que devuelve el motor: `abstain` nunca sale de él. */
export type ResolvedDecision = Exclude<Decision, { effect: "abstain" }>;

/** Una decisión que no concede acceso. */
export type DeniedDecision = Extract<Decision, { effect: "deny" | "challenge" }>;

export type Authorize = (request: AccessRequest) => Promise<ResolvedDecision>;

export interface Policy {
  /** Tipos de recurso que evalúa esta política. */
  readonly appliesTo: readonly string[];
  /**
   * `authorize` permite consultar otra acción sobre el mismo recurso.
   * Una política nunca debe consultar una acción que la lleve de vuelta a sí misma.
   */
  evaluate(request: AccessRequest, authorize: Authorize): Promise<Decision>;
}
```

- [ ] **Paso 2: crear `errors.ts`**

```ts
import type { DeniedDecision } from "./types";

/** El acceso no se concedió. Conserva la decisión para que el borde elija la respuesta. */
export class AccessDeniedError extends Error {
  constructor(public readonly decision: DeniedDecision) {
    super(
      decision.effect === "challenge"
        ? "Se requiere desbloquear el recurso"
        : `Acceso denegado: ${decision.reason}`,
    );
    this.name = "AccessDeniedError";
  }
}

/** No fue posible evaluar el acceso por un fallo técnico. Nunca equivale a conceder. */
export class AccessCheckFailedError extends Error {
  constructor(cause: unknown) {
    super("No fue posible comprobar el acceso", { cause });
    this.name = "AccessCheckFailedError";
  }
}
```

- [ ] **Paso 3: comprobar que compila**

Ejecuta: `npx -p typescript tsc --noEmit -p .`

`typescript` no está instalado en el proyecto y `npm run build` no comprueba tipos, así que este comando descarga TypeScript y es la única verificación de TS strict. Repítelo al final de las tareas 2, 3 y 4.

Esperado: ningún error en `src/authorization/`. Si aparecen errores previos de otros módulos, anótalos, pero no los corrijas.

Sin commit todavía: se hace con la tarea 2, que es la primera con comportamiento.

---

### Tarea 2: Motor `createAuthorizer`

**Archivos:**
- Crear: `src/authorization/server/application/createAuthorizer.test.ts`
- Crear: `src/authorization/server/application/createAuthorizer.ts`

- [ ] **Paso 1: escribir los tests**

```ts
import { describe, expect, it } from "vitest";

import { AccessCheckFailedError, AccessDeniedError } from "../domain/errors";
import { Subject, type AccessRequest, type Decision, type Policy } from "../domain/types";
import { createAuthorizer } from "./createAuthorizer";

const request = (overrides: Partial<AccessRequest> = {}): AccessRequest => ({
  subject: Subject.anonymous(),
  action: "read",
  resource: { type: "thing", id: "t-1" },
  ...overrides,
});

const policy = (decision: Decision | (() => Promise<Decision>), appliesTo = ["thing"]): Policy => ({
  appliesTo,
  evaluate: typeof decision === "function" ? decision : async () => decision,
});

const allow: Decision = { effect: "allow" };
const abstain: Decision = { effect: "abstain" };
const challenge: Decision = { effect: "challenge", kind: "password" };
const deny = (reason: "unauthenticated" | "forbidden" | "not-found"): Decision => ({ effect: "deny", reason });

describe("createAuthorizer · authorize", () => {
  it("concede cuando una política aplicable concede", async () => {
    const authorizer = createAuthorizer([policy(allow)]);

    expect(await authorizer.authorize(request())).toEqual(allow);
  });

  it("falla cerrado sin políticas, con solo abstenciones o sin políticas para ese tipo", async () => {
    expect(await createAuthorizer([]).authorize(request())).toEqual(deny("forbidden"));
    expect(await createAuthorizer([policy(abstain)]).authorize(request())).toEqual(deny("forbidden"));
    expect(await createAuthorizer([policy(allow, ["other"])]).authorize(request())).toEqual(deny("forbidden"));
  });

  it("deny gana sobre challenge y allow; gana el primero registrado", async () => {
    const authorizer = createAuthorizer([
      policy(allow),
      policy(challenge),
      policy(deny("not-found")),
      policy(deny("forbidden")),
    ]);

    expect(await authorizer.authorize(request())).toEqual(deny("not-found"));
  });

  it("challenge gana sobre allow, y abstain no cambia el resultado", async () => {
    const authorizer = createAuthorizer([policy(allow), policy(abstain), policy(challenge)]);

    expect(await authorizer.authorize(request())).toEqual(challenge);
  });

  it("trata una decisión malformada o un motivo de deny desconocido como deny(forbidden)", async () => {
    const malformed = policy(async () => ({ effect: "yes" }) as unknown as Decision);
    const badReason = policy(async () => ({ effect: "deny", reason: "nope" }) as unknown as Decision);

    expect(await createAuthorizer([policy(allow), malformed]).authorize(request())).toEqual(deny("forbidden"));
    expect(await createAuthorizer([badReason]).authorize(request())).toEqual(deny("forbidden"));
  });

  it("devuelve una decisión nueva en cada llamada: mutarla no afecta a las siguientes", async () => {
    const authorizer = createAuthorizer([]);

    const first = await authorizer.authorize(request());
    (first as { effect: string }).effect = "allow";

    expect(await authorizer.authorize(request())).toEqual(deny("forbidden"));
  });

  it("lanza AccessCheckFailedError con la causa cuando una política falla, aunque otra conceda", async () => {
    const cause = new Error("db caída");
    const failing = policy(async () => {
      throw cause;
    });
    const authorizer = createAuthorizer([policy(allow), failing]);

    const error = await authorizer.authorize(request()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AccessCheckFailedError);
    expect((error as AccessCheckFailedError).cause).toBe(cause);
  });

  it("captura también un fallo síncrono de una política", async () => {
    const syncFailing: Policy = {
      appliesTo: ["thing"],
      evaluate: () => {
        throw new Error("bug");
      },
    };

    await expect(createAuthorizer([syncFailing]).authorize(request())).rejects.toBeInstanceOf(
      AccessCheckFailedError,
    );
  });

  it("permite a una política consultar otra acción sobre el mismo recurso", async () => {
    const writers: Policy = {
      appliesTo: ["thing"],
      evaluate: async (req) => (req.action === "write" ? allow : abstain),
    };
    const readers: Policy = {
      appliesTo: ["thing"],
      evaluate: async (req, authorize) =>
        req.action === "read" && (await authorize({ ...req, action: "write" })).effect === "allow"
          ? allow
          : abstain,
    };

    expect(await createAuthorizer([writers, readers]).authorize(request())).toEqual(allow);
  });
});

describe("createAuthorizer · require", () => {
  it("devuelve ok cuando se concede", async () => {
    const result = await createAuthorizer([policy(allow)]).require(request());

    expect(result.isSuccess).toBe(true);
  });

  it("devuelve AccessDeniedError con la decisión ante deny o challenge", async () => {
    const denied = await createAuthorizer([policy(deny("unauthenticated"))]).require(request());
    const challenged = await createAuthorizer([policy(allow), policy(challenge)]).require(request());

    expect(denied.getError()).toBeInstanceOf(AccessDeniedError);
    expect((denied.getError() as AccessDeniedError).decision).toEqual(deny("unauthenticated"));
    expect((challenged.getError() as AccessDeniedError).decision).toEqual(challenge);
  });

  it("devuelve AccessCheckFailedError ante un fallo técnico, nunca ok", async () => {
    const failing = policy(async () => {
      throw new Error("db caída");
    });

    const result = await createAuthorizer([policy(allow), failing]).require(request());

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(AccessCheckFailedError);
  });
});
```

- [ ] **Paso 2: ejecutar los tests y verificar que fallan**

Ejecuta: `npx vitest run src/authorization/server/application/createAuthorizer.test.ts`
Esperado: FAIL, porque no se puede resolver `./createAuthorizer`.

- [ ] **Paso 3: implementar el motor**

```ts
import { Result } from "../../../shared/domain/Result";
import { AccessCheckFailedError, AccessDeniedError } from "../domain/errors";
import type { AccessRequest, Authorize, Decision, Policy, ResolvedDecision } from "../domain/types";

export interface Authorizer {
  /** Lanza `AccessCheckFailedError` si una política falla por un error técnico. */
  authorize(request: AccessRequest): Promise<ResolvedDecision>;
  /** Como `authorize`, pero expresado como `Result`: solo `ok` cuando la decisión es `allow`. */
  require(request: AccessRequest): Promise<Result<AccessDeniedError | AccessCheckFailedError, void>>;
}

const DENY_REASONS: readonly string[] = ["unauthenticated", "forbidden", "not-found"];

/** Literal nuevo en cada llamada: un consumidor que mute la decisión no afecta a las siguientes. */
const forbidden = (): ResolvedDecision => ({ effect: "deny", reason: "forbidden" });

/** Motor de decisión. Conceder exige al menos un `allow` explícito y ningún `deny` ni `challenge`. */
export function createAuthorizer(policies: readonly Policy[]): Authorizer {
  const authorize: Authorize = async (request) => {
    const applicable = policies.filter((policy) => policy.appliesTo.includes(request.resource.type));
    let decisions: Decision[];
    try {
      decisions = await Promise.all(applicable.map((policy) => policy.evaluate(request, authorize)));
    } catch (cause) {
      throw cause instanceof AccessCheckFailedError ? cause : new AccessCheckFailedError(cause);
    }
    return combine(decisions);
  };

  return {
    authorize,
    async require(request) {
      try {
        const decision = await authorize(request);
        return decision.effect === "allow" ? Result.ok() : Result.fail(new AccessDeniedError(decision));
      } catch (error) {
        return Result.fail(
          error instanceof AccessCheckFailedError ? error : new AccessCheckFailedError(error),
        );
      }
    },
  };
}

function combine(decisions: readonly Decision[]): ResolvedDecision {
  let challenge: ResolvedDecision | undefined;
  let allowed = false;
  for (const decision of decisions) {
    switch (decision?.effect) {
      case "deny":
        // Un motivo desconocido se normaliza; nunca llega al borde un `reason` sin traducción.
        return DENY_REASONS.includes(decision.reason) ? { effect: "deny", reason: decision.reason } : forbidden();
      case "challenge":
        challenge ??= { effect: "challenge", kind: decision.kind };
        break;
      case "allow":
        allowed = true;
        break;
      case "abstain":
        break;
      default:
        // Una decisión malformada nunca concede.
        return forbidden();
    }
  }
  return challenge ?? (allowed ? { effect: "allow" } : forbidden());
}
```

Las decisiones que devuelve el motor son siempre copias nuevas, nunca la referencia de una política ni una constante compartida.

`Promise.all` mantiene el orden del array, así que «gana el primer `deny` registrado» se cumple aunque las políticas se evalúen en paralelo. La llamada a `policy.evaluate` ocurre dentro del `map`, que está dentro del `try`, así que un fallo síncrono también se captura.

- [ ] **Paso 4: ejecutar los tests y verificar que pasan**

Ejecuta: `npx vitest run src/authorization/server/application/createAuthorizer.test.ts`
Esperado: PASS (12 tests).

- [ ] **Paso 5: build y commit**

Ejecuta: `npm run build`
Esperado: `Complete!`

```bash
git add src/authorization/server/domain/types.ts src/authorization/server/domain/errors.ts src/authorization/server/application/createAuthorizer.ts src/authorization/server/application/createAuthorizer.test.ts
git commit -m "feat(authorization): añade el contrato y el motor de decisión de acceso" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 3: Traducción HTTP `accessErrorResponse`

**Archivos:**
- Crear: `src/authorization/server/infrastructure/http.test.ts`
- Crear: `src/authorization/server/infrastructure/http.ts`

- [ ] **Paso 1: escribir los tests**

```ts
import { describe, expect, it } from "vitest";

import { AccessCheckFailedError, AccessDeniedError } from "../domain/errors";
import { accessErrorResponse } from "./http";

describe("accessErrorResponse", () => {
  it.each([
    ["unauthenticated", 401],
    ["forbidden", 403],
    ["not-found", 404],
  ] as const)("traduce deny(%s) a %i", async (reason, status) => {
    const response = accessErrorResponse(new AccessDeniedError({ effect: "deny", reason }));

    expect(response.status).toBe(status);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(typeof (await response.json()).error).toBe("string");
  });

  it("traduce challenge a 401 indicando el tipo de reto", async () => {
    const response = accessErrorResponse(new AccessDeniedError({ effect: "challenge", kind: "password" }));

    expect(response.status).toBe(401);
    expect((await response.json()).challenge).toBe("password");
  });

  it("traduce un fallo técnico a 500 sin exponer la causa", async () => {
    const response = accessErrorResponse(new AccessCheckFailedError(new Error("secreto de la db")));
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).not.toContain("secreto de la db");
  });
});
```

- [ ] **Paso 2: ejecutar los tests y verificar que fallan**

Ejecuta: `npx vitest run src/authorization/server/infrastructure/http.test.ts`
Esperado: FAIL, porque no se puede resolver `./http`.

- [ ] **Paso 3: implementar**

```ts
import { AccessCheckFailedError, type AccessDeniedError } from "../domain/errors";
import type { DenyReason } from "../domain/types";

const DENIED: Record<DenyReason, { status: number; error: string }> = {
  unauthenticated: { status: 401, error: "Autenticación requerida" },
  forbidden: { status: 403, error: "No tienes permiso sobre este recurso" },
  "not-found": { status: 404, error: "Recurso no encontrado" },
};

/** Respuesta HTTP única para cualquier error de acceso. Nunca expone la causa de un fallo técnico. */
export function accessErrorResponse(error: AccessDeniedError | AccessCheckFailedError): Response {
  if (error instanceof AccessCheckFailedError) {
    return Response.json({ error: "No fue posible comprobar el acceso" }, { status: 500 });
  }

  const decision = error.decision;
  if (decision.effect === "challenge") {
    return Response.json(
      { error: "Este recurso requiere contraseña", challenge: decision.kind },
      { status: 401 },
    );
  }

  const { status, error: message } = DENIED[decision.reason];
  return Response.json({ error: message }, { status });
}
```

- [ ] **Paso 4: ejecutar los tests y verificar que pasan**

Ejecuta: `npx vitest run src/authorization/server/infrastructure/http.test.ts`
Esperado: PASS (5 tests).

- [ ] **Paso 5: build y commit**

Ejecuta: `npm run build`
Esperado: `Complete!`

```bash
git add src/authorization/server/infrastructure/http.ts src/authorization/server/infrastructure/http.test.ts
git commit -m "feat(authorization): traduce los errores de acceso a respuestas HTTP" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarea 4: API pública y changelog

**Archivos:**
- Crear: `src/authorization/server/index.ts`
- Modificar: `CHANGELOG.md`, sección `## [Unreleased]`

- [ ] **Paso 1: crear `index.ts`**

```ts
export { createAuthorizer, type Authorizer } from "./application/createAuthorizer";
export { AccessCheckFailedError, AccessDeniedError } from "./domain/errors";
export {
  Subject,
  type AccessRequest,
  type Action,
  type Authorize,
  type Decision,
  type DeniedDecision,
  type DenyReason,
  type Policy,
  type ResolvedDecision,
  type Resource,
} from "./domain/types";
export { accessErrorResponse } from "./infrastructure/http";
```

- [ ] **Paso 2: añadir la entrada al CHANGELOG**

Inserta esta línea justo debajo de `## [Unreleased]`, seguida de una línea en blanco:

```markdown
- **Added:** módulo `authorization` (`src/authorization/server`) con el contrato de acceso (`Subject`, `Resource`, `Decision`, `Policy`), el motor `createAuthorizer` y la traducción `accessErrorResponse`. Combina políticas registradas por cada módulo y falla cerrado: concede solo con un `allow` explícito y sin `deny` ni `challenge`, y un fallo técnico nunca concede. Todavía no lo usa ningún módulo.
```

- [ ] **Paso 3: verificar el módulo completo y que nadie lo importa todavía**

Ejecuta: `npx vitest run src/authorization`
Esperado: PASS, 2 archivos y 17 tests.

Ejecuta: `rg -n "authorization/server" src --glob '!src/authorization/**'`
Esperado: sin resultados, porque nadie importa el módulo todavía.

Ejecuta: `rg -n 'from "\.\./\.\./' src/authorization`
Esperado: la única ruta externa al módulo es `../../../shared/domain/Result`. Cualquier otra que salga de `src/authorization` es un error.

- [ ] **Paso 4: build y commit**

Ejecuta: `npm run build`
Esperado: `Complete!`

```bash
git add src/authorization/server/index.ts CHANGELOG.md
git commit -m "feat(authorization): expone la API pública del módulo" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Fuera de esta iteración

- Las políticas `NanobookAccessPolicy` y `DocumentPasswordPolicy`.
- El registro en `src/application/server`.
- La migración de casos de uso, rutas y MCP.
- La documentación en `src/content/nanobook-project/`.

Todo esto corresponde a las etapas 2 a 5 del spec.
