import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpUserApi } from "./HttpUserApi";

describe("HttpUserApi", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates a user without sending server-controlled fields", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "user-1" }), { status: 201 }));

    const result = await new HttpUserApi().createUser({
      email: "user@example.com",
      displayName: "User",
      id: "forged-id",
      createdAt: new Date("2026-01-01"),
    });

    expect(result.isSuccess).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/users",
      expect.objectContaining({ method: "POST" })
    );
    const request = vi.mocked(fetchMock).mock.calls[0][1];
    expect(JSON.parse(String(request?.body))).toEqual({
      email: "user@example.com",
      displayName: "User",
    });
  });

  it("encodes id and email lookup parameters", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "user/1" }), { status: 200 }));
    const api = new HttpUserApi();

    await api.getUser("user/1");
    await api.getUserByEmail("user+tag@example.com");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/users/user%2F1");
    expect(fetchMock.mock.calls[1][0]).toBe(
      "/api/users?email=user%2Btag%40example.com"
    );
  });

  it("updates only mutable profile fields", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "user-1" }), { status: 200 }));

    await new HttpUserApi().updateUser("user-1", {
      email: "new@example.com",
      displayName: "New",
      id: "forged-id",
      updatedAt: new Date("2026-01-02"),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/users/user-1",
      expect.objectContaining({ method: "PATCH" })
    );
    const request = vi.mocked(fetchMock).mock.calls[0][1];
    expect(JSON.parse(String(request?.body))).toEqual({
      email: "new@example.com",
      displayName: "New",
    });
  });

  it("deletes a user and maps HTTP and network errors", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "El usuario no existe" }), { status: 404 })
      )
      .mockRejectedValueOnce(new Error("offline"));
    const api = new HttpUserApi();

    expect((await api.deleteUser("user-1")).isSuccess).toBe(true);
    const notFound = await api.getUser("missing");
    const network = await api.getUser("offline");

    expect(notFound.isSuccess).toBe(false);
    expect(notFound.getError().status).toBe(404);
    expect(network.isSuccess).toBe(false);
    expect(network.getError().message).toBe("offline");
  });
});
