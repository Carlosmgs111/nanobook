import { describe, expect, it } from "vitest";

import { SignOutController } from "./SignOutController";

class FakeAuthApi {
  calls = 0;

  async signOut(): Promise<void> {
    this.calls += 1;
  }
}

describe("SignOutController", () => {
  it("ends the session and returns home after confirmation", async () => {
    const authApi = new FakeAuthApi();
    const destinations: string[] = [];
    const controller = new SignOutController({
      authApi,
      confirm: () => true,
      navigate: (destination) => destinations.push(destination),
    });

    await controller.execute();

    expect(authApi.calls).toBe(1);
    expect(destinations).toEqual(["/"]);
  });

  it("does not end the session when confirmation is declined", async () => {
    const authApi = new FakeAuthApi();
    const destinations: string[] = [];
    const controller = new SignOutController({
      authApi,
      confirm: () => false,
      navigate: (destination) => destinations.push(destination),
    });

    await controller.execute();

    expect(authApi.calls).toBe(0);
    expect(destinations).toEqual([]);
  });
});
