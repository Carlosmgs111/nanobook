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

  it("convierte una política mal formada (appliesTo inválido) en AccessCheckFailedError", async () => {
    const malformed = { appliesTo: undefined as never, evaluate: async () => allow } as Policy;

    await expect(createAuthorizer([malformed]).authorize(request())).rejects.toBeInstanceOf(
      AccessCheckFailedError,
    );
  });

  it("no envuelve dos veces un AccessCheckFailedError lanzado por una política", async () => {
    const original = new AccessCheckFailedError(new Error("x"));
    const failing = policy(async () => {
      throw original;
    });

    const error = await createAuthorizer([failing]).authorize(request()).catch((e: unknown) => e);
    expect(error).toBe(original);
  });

  it("trata un challenge con kind desconocido como deny(forbidden)", async () => {
    const badChallenge = policy(async () => ({ effect: "challenge", kind: "otp" }) as unknown as Decision);

    expect(await createAuthorizer([policy(allow), badChallenge]).authorize(request())).toEqual(
      deny("forbidden"),
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
