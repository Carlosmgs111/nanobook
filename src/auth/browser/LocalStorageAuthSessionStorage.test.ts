import { describe, expect, it } from "vitest";

import {
  LocalStorageAuthSessionStorage,
} from "./LocalStorageAuthSessionStorage";

class FakeStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("LocalStorageAuthSessionStorage", () => {
  it("persists the authentication token and user for a later page load", () => {
    const storage = new FakeStorage();
    const sessions = new LocalStorageAuthSessionStorage(storage);
    const session = {
      token: "session-token",
      user: {
        id: "user-123",
        name: "Ada Lovelace",
        email: "ada@example.com",
      },
    };

    sessions.save(session);

    expect(storage.getItem("nanobook:auth:session")).toBe(JSON.stringify(session));
    expect(sessions.load()).toEqual(session);
  });

  it("treats a corrupted persisted value as no authenticated session", () => {
    const storage = new FakeStorage();
    storage.setItem("nanobook:auth:session", "not-json");

    expect(new LocalStorageAuthSessionStorage(storage).load()).toBeNull();
  });
});
