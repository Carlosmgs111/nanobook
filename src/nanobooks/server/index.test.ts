import { describe, expect, it, vi } from "vitest";
import { createAuthorizer, type Policy } from "../../authorization/server";
import { InMemoryEventBus } from "../../shared/infrastructure/InMemoryEventBus";
import { NanobookAccessPolicy } from "./application/access/NanobookAccessPolicy";
import { NanobookModule } from ".";

vi.mock("../../shared/infrastructure/database/drizzleDatabase", () => ({ db: {} }));
vi.mock("astro:env/server", () => ({ GITHUB_TOKEN: undefined, BETTER_AUTH_SECRET: undefined }));

describe("NanobookModule.create", () => {
  it("registra la política de acceso de nanobooks", async () => {
    const policies: Policy[] = [];
    await NanobookModule.create(new InMemoryEventBus(), createAuthorizer(policies), policies);

    const policy = policies.find((candidate) => candidate instanceof NanobookAccessPolicy);
    expect(policy).toBeDefined();
    expect(policy?.appliesTo).toContain("nanobook");
  });
});
