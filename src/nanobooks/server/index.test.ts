import { describe, expect, it, vi } from "vitest";
import { createAuthorizer } from "../../authorization/server";
import { InMemoryEventBus } from "../../shared/infrastructure/InMemoryEventBus";
import { NanobookAccessPolicy } from "./infraestructure/access/NanobookAccessPolicy";
import { NanobookModule } from ".";

vi.mock("../../shared/infrastructure/database/drizzleDatabase", () => ({ db: {} }));
vi.mock("astro:env/server", () => ({ GITHUB_TOKEN: undefined, BETTER_AUTH_SECRET: undefined }));

describe("NanobookModule.create", () => {
  it("registra la política de acceso de nanobooks", async () => {
    const authorization = createAuthorizer();
    const register = vi.spyOn(authorization, "register");
    await NanobookModule.create(new InMemoryEventBus(), authorization);

    const policy = register.mock.calls
      .map(([registered]) => registered)
      .find((candidate) => candidate instanceof NanobookAccessPolicy);
    expect(policy).toBeDefined();
    expect(policy?.appliesTo).toContain("nanobook");
  });
});
