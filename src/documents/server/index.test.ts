import { describe, expect, it, vi } from "vitest";
import { createAuthorizer, Subject, type Policy } from "../../authorization/server";
import { InMemoryEventBus } from "../../shared/infrastructure/InMemoryEventBus";
import { DocumentPasswordPolicy } from "./application/access/DocumentPasswordPolicy";
import { DocumentModule } from ".";

vi.mock("../../shared/infrastructure/database/drizzleDatabase", () => ({ db: {} }));
vi.mock("astro:env/server", () => ({ GITHUB_TOKEN: undefined, BETTER_AUTH_SECRET: undefined }));

/** Hace de política del módulo dueño de un nanobook público: concede la lectura. */
const publicReaders: Policy = {
  appliesTo: ["document"],
  evaluate: async ({ action }) => (action === "read" ? { effect: "allow" } : { effect: "abstain" }),
};

async function compose() {
  const policies: Policy[] = [];
  const authorizer = createAuthorizer(policies);
  await DocumentModule.create(new InMemoryEventBus(), authorizer, policies);
  return { policies, authorizer };
}

describe("DocumentModule.create", () => {
  it("registra la política de contraseña para documentos", async () => {
    const { policies } = await compose();

    const policy = policies.find((candidate) => candidate instanceof DocumentPasswordPolicy);
    expect(policy).toBeDefined();
    expect(policy?.appliesTo).toContain("document");
  });

  it("un documento protegido de un nanobook público exige desafío sin grant", async () => {
    const { policies, authorizer } = await compose();
    policies.push(publicReaders);

    const decision = await authorizer.authorize({
      subject: Subject.anonymous(),
      action: "read",
      resource: { type: "document", id: "d1", nanobookId: "nb-1", attributes: { securedIds: ["d1"] } },
    });

    expect(decision).toEqual({ effect: "challenge", kind: "password" });
  });
});
