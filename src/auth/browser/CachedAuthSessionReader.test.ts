import { describe, expect, it, vi } from "vitest";

import type { AuthenticatedSessionReader } from "./model/AuthSession";
import { CachedAuthSessionReader } from "./CachedAuthSessionReader";

const ada = {
  id: "user-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
};

describe("CachedAuthSessionReader", () => {
  it("reuses a resolved session while the browser module remains alive", async () => {
    const reader: AuthenticatedSessionReader = {
      getCurrentUser: vi.fn().mockResolvedValue(ada),
    };
    const cachedReader = new CachedAuthSessionReader(reader);

    await expect(cachedReader.getCurrentUser()).resolves.toEqual(ada);
    await expect(cachedReader.getCurrentUser()).resolves.toEqual(ada);

    expect(reader.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("shares a pending session request between concurrent consumers", async () => {
    let resolveSession: (user: typeof ada | null) => void = () => {};
    const pending = new Promise<typeof ada | null>((resolve) => {
      resolveSession = resolve;
    });
    const reader: AuthenticatedSessionReader = {
      getCurrentUser: vi.fn().mockReturnValue(pending),
    };
    const cachedReader = new CachedAuthSessionReader(reader);

    const first = cachedReader.getCurrentUser();
    const second = cachedReader.getCurrentUser();
    resolveSession(ada);

    await expect(Promise.all([first, second])).resolves.toEqual([ada, ada]);
    expect(reader.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("uses login and logout updates without another session request", async () => {
    const reader: AuthenticatedSessionReader = {
      getCurrentUser: vi.fn().mockResolvedValue(null),
    };
    const cachedReader = new CachedAuthSessionReader(reader);

    cachedReader.setCurrentUser(ada);
    await expect(cachedReader.getCurrentUser()).resolves.toEqual(ada);

    cachedReader.clearCurrentUser();
    await expect(cachedReader.getCurrentUser()).resolves.toBeNull();
    expect(reader.getCurrentUser).not.toHaveBeenCalled();
  });

  it("revalidates a cached user after one minute", async () => {
    vi.useFakeTimers();
    try {
      const reader: AuthenticatedSessionReader = {
        getCurrentUser: vi.fn().mockResolvedValueOnce(ada).mockResolvedValueOnce(null),
      };
      const cachedReader = new CachedAuthSessionReader(reader);
      await expect(cachedReader.getCurrentUser()).resolves.toEqual(ada);
      vi.advanceTimersByTime(60_000);
      await expect(cachedReader.getCurrentUser()).resolves.toBeNull();
      expect(reader.getCurrentUser).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
