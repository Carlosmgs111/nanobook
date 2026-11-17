import { describe, expect, it, vi } from "vitest";

import { Subject } from "./types";

describe("Subject.of", () => {
  it("acepta un id directo", async () => {
    expect(await Subject.of("u-1").userId()).toBe("u-1");
    expect(await Subject.of(undefined).userId()).toBeUndefined();
  });

  it("resuelve la sesión una sola vez, y solo cuando se pide", async () => {
    const resolve = vi.fn(async () => "u-1");
    const subject = Subject.of(resolve);

    expect(resolve).not.toHaveBeenCalled();
    await Promise.all([subject.userId(), subject.userId()]);
    await subject.userId();

    expect(resolve).toHaveBeenCalledTimes(1);
  });


  it("memoiza también el rechazo del resolvedor", async () => {
    const failure = new Error("sesión caída");
    const resolve = vi.fn(async (): Promise<string> => {
      throw failure;
    });
    const subject = Subject.of(resolve);

    await expect(subject.userId()).rejects.toBe(failure);
    await expect(subject.userId()).rejects.toBe(failure);

    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("entrega la credencial presentada por recurso, o ninguna", () => {
    const subject = Subject.of("u-1", (id) => (id === "doc-1" ? "tok" : undefined));

    expect(subject.grantFor("doc-1")).toBe("tok");
    expect(subject.grantFor("doc-2")).toBeUndefined();
    expect(Subject.of("u-1").grantFor("doc-1")).toBeUndefined();
  });
});
