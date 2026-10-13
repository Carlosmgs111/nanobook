import { beforeEach, describe, expect, it, vi } from "vitest";
import { Application, getApp } from "./Application";

const { authModule, editionModule, createAuth, createEdition } = vi.hoisted(
  () => {
    const authModule = { name: "auth" };
    const editionModule = { name: "edition" };
    return {
      authModule,
      editionModule,
      createAuth: vi.fn(() => authModule),
      createEdition: vi.fn(() => editionModule),
    };
  },
);

vi.mock("../../auth/browser", () => ({
  AuthModule: { create: createAuth },
}));

vi.mock("../../documents/browser", () => ({
  EditionModule: { create: createEdition },
}));

describe("Application", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("compone los módulos de autenticación y edición", () => {
    const app = Application.create();

    expect(createAuth).toHaveBeenCalledOnce();
    expect(createEdition).toHaveBeenCalledOnce();
    expect(app.authModule).toBe(authModule);
    expect(app.editionModule).toBe(editionModule);
  });

  it("devuelve la misma instancia desde getApp", () => {
    const first = getApp();
    const second = getApp();

    expect(first).toBe(second);
    expect(createAuth).toHaveBeenCalledTimes(1);
    expect(createEdition).toHaveBeenCalledTimes(1);
  });
});
