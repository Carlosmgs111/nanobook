import { describe, expect, it } from "vitest";

import {
  AccessCheckFailedError,
  createAuthorizer,
  Subject,
  type Policy,
  type Resource,
} from "../../../../authorization/server";
import { Result } from "../../../../shared/domain/Result";
import type { AccessGrantCodec, DocumentAccessRepository } from "../../domain/access/ports";
import { DocumentPasswordPolicy } from "./DocumentPasswordPolicy";

const now = new Date("2026-11-04T12:00:00.000Z");

/** Versión de contraseña vigente por documento (null = protección retirada, ausente = sin registro). */
function repository(versions: Record<string, number | null>): DocumentAccessRepository {
  return {
    get: async (documentId) =>
      Result.ok(
        documentId in versions
          ? {
              documentId,
              passwordHash: versions[documentId] === null ? null : "hash",
              passwordVersion: versions[documentId] ?? 0,
            }
          : null,
      ),
    setPasswordHash: async () => {
      throw new Error("no usado");
    },
  };
}

/** Un token válido es exactamente `<documentId>:<versión>`. */
const codec: AccessGrantCodec = {
  issue: () => "",
  verify: (token, { documentId, passwordVersion }) => token === `${documentId}:${passwordVersion}`,
};

const grants = (tokens: Record<string, string>) => (documentId: string) => tokens[documentId];

/** La política de contraseña nunca concede: estas dos hacen de política del módulo dueño del nanobook. */
const readers: Policy = {
  appliesTo: ["document"],
  evaluate: async ({ action }) => (action === "read" ? { effect: "allow" } : { effect: "abstain" }),
};
const writers: Policy = {
  appliesTo: ["document"],
  evaluate: async ({ action, subject }) =>
    action === "write" && (await subject.userId()) === "owner" ? { effect: "allow" } : { effect: "abstain" },
};

function resource(securedIds: unknown): Resource {
  return { type: "document", id: "doc-1", nanobookId: "nb-1", attributes: { securedIds } };
}

describe("DocumentPasswordPolicy", () => {
  const authorizerWith = (
    versions: Record<string, number | null> = { "doc-1": 1 },
    extra: Policy[] = [readers, writers],
    accessRepository: DocumentAccessRepository = repository(versions),
  ) => createAuthorizer([new DocumentPasswordPolicy(accessRepository, codec, () => now), ...extra]);

  const read = (
    authorizer: ReturnType<typeof authorizerWith>,
    securedIds: unknown,
    userId: string | undefined = undefined,
    tokens: Record<string, string> = {},
  ) =>
    authorizer.authorize({
      subject: Subject.of(userId, grants(tokens)),
      action: "read",
      resource: resource(securedIds),
    });

  it("no se pronuncia en write: sin otra política que conceda, el resultado es forbidden", async () => {
    const authorizer = authorizerWith({ "doc-1": 1 }, []);

    for (const securedIds of [["doc-1"], "malformado", undefined]) {
      expect(
        await authorizer.authorize({
          subject: Subject.of("owner"),
          action: "write",
          resource: resource(securedIds),
        }),
      ).toEqual({ effect: "deny", reason: "forbidden" });
    }
  });

  it("propaga AccessCheckFailedError si el write interno falla por un error técnico", async () => {
    const failing: Policy = {
      appliesTo: ["document"],
      evaluate: async ({ action }) => {
        if (action === "write") throw new Error("boom");
        return { effect: "allow" };
      },
    };

    await expect(read(authorizerWith({ "doc-1": 1 }, [readers, failing]), ["doc-1"])).rejects.toBeInstanceOf(
      AccessCheckFailedError,
    );
  });

  it("deniega con forbidden si securedIds falta, no es array o tiene elementos no string", async () => {
    const authorizer = authorizerWith();

    for (const securedIds of [undefined, "doc-1", { 0: "doc-1" }, [1], ["doc-1", null]]) {
      expect(await read(authorizer, securedIds, "owner")).toEqual({ effect: "deny", reason: "forbidden" });
    }
  });

  it("con securedIds vacío no desafía y concede la política de lectura", async () => {
    expect(await read(authorizerWith(), [])).toEqual({ effect: "allow" });
  });

  it("deja pasar al escritor sin grant", async () => {
    expect(await read(authorizerWith(), ["doc-1"], "owner")).toEqual({ effect: "allow" });
  });

  it("acepta un lector con grant válido", async () => {
    expect(await read(authorizerWith(), ["doc-1"], "reader", { "doc-1": "doc-1:1" })).toEqual({ effect: "allow" });
  });

  it("desafía si no hay grant", async () => {
    expect(await read(authorizerWith(), ["doc-1"], "reader")).toEqual({ effect: "challenge", kind: "password" });
  });

  it("desafía con un grant de otra versión de la contraseña, expirado o manipulado", async () => {
    const challenge = { effect: "challenge", kind: "password" };

    expect(await read(authorizerWith({ "doc-1": 2 }), ["doc-1"], "reader", { "doc-1": "doc-1:1" })).toEqual(challenge);
    expect(await read(authorizerWith(), ["doc-1"], "reader", { "doc-1": "manipulado" })).toEqual(challenge);

    const expired = createAuthorizer([
      new DocumentPasswordPolicy(repository({ "doc-1": 1 }), { issue: () => "", verify: () => false }, () => now),
      readers,
      writers,
    ]);
    expect(await read(expired, ["doc-1"], "reader", { "doc-1": "doc-1:1" })).toEqual(challenge);
  });

  it("desafía si el hash falta o el registro no existe", async () => {
    const cases: Array<Record<string, number | null>> = [{ "doc-1": null }, {}];
    for (const versions of cases) {
      expect(await read(authorizerWith(versions), ["doc-1"], "reader", { "doc-1": "doc-1:0" })).toEqual({
        effect: "challenge",
        kind: "password",
      });
    }
  });

  it("desafía, nunca concede, si falla el repositorio de acceso", async () => {
    const failing: DocumentAccessRepository = {
      get: async () => Result.fail(new Error("db caída")),
      setPasswordHash: async () => {
        throw new Error("no usado");
      },
    };

    expect(
      await read(authorizerWith({}, [readers, writers], failing), ["doc-1"], "reader", { "doc-1": "doc-1:1" }),
    ).toEqual({ effect: "challenge", kind: "password" });
  });

  it("exige grant para cada eslabón protegido de la cadena", async () => {
    const authorizer = authorizerWith({ "doc-1": 1, "target-1": 1 });
    const chain = ["doc-1", "target-1"];

    expect(await read(authorizer, chain, "reader", { "doc-1": "doc-1:1" })).toEqual({
      effect: "challenge",
      kind: "password",
    });
    expect(await read(authorizer, chain, "reader", { "doc-1": "doc-1:1", "target-1": "target-1:1" })).toEqual({
      effect: "allow",
    });
  });
});
