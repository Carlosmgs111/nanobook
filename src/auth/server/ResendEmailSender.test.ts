import { afterEach, describe, expect, it, vi } from "vitest";

import { ResendEmailSender } from "./ResendEmailSender";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ResendEmailSender", () => {
  it("sends a verification email through Resend's API", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ input, init });
        return new Response(JSON.stringify({ id: "email-123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    const sender = new ResendEmailSender({
      apiKey: "re_test",
      from: "Nanobook <no-reply@nanobook.test>",
    });

    await expect(
      sender.sendVerificationEmail({
        to: "ada@example.com",
        url: "https://nanobook.test/api/auth/verify-email?token=token&callbackURL=%2F",
      }),
    ).resolves.toBeUndefined();

    expect(requests).toEqual([
      {
        input: "https://api.resend.com/emails",
        init: {
          method: "POST",
          headers: {
            Authorization: "Bearer re_test",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Nanobook <no-reply@nanobook.test>",
            to: ["ada@example.com"],
            subject: "Verifica tu correo electrónico en Nanobook",
            text: "Confirma tu correo electrónico para activar tu cuenta en Nanobook:\nhttps://nanobook.test/api/auth/verify-email?token=token&callbackURL=%2F",
            html: '<p>Confirma tu correo electrónico para activar tu cuenta en Nanobook.</p><p><a href="https://nanobook.test/api/auth/verify-email?token=token&amp;callbackURL=%2F">Verificar correo electrónico</a></p>',
          }),
        },
      },
    ]);
  });

  it("reports a delivery failure without exposing the verification URL", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ message: "Invalid API key" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const sender = new ResendEmailSender({
      apiKey: "re_test",
      from: "Nanobook <no-reply@nanobook.test>",
    });

    await expect(
      sender.sendVerificationEmail({
        to: "ada@example.com",
        url: "https://nanobook.test/api/auth/verify-email?token=secret-token",
      }),
    ).rejects.toThrow("No fue posible enviar el correo de verificación.");
  });

  it("requires Resend credentials before attempting delivery", async () => {
    const sender = new ResendEmailSender({
      from: "Nanobook <no-reply@nanobook.test>",
    });

    await expect(
      sender.sendVerificationEmail({
        to: "ada@example.com",
        url: "https://nanobook.test/api/auth/verify-email?token=secret-token",
      }),
    ).rejects.toThrow("RESEND_API_KEY must be configured to send verification emails.");
  });
});
