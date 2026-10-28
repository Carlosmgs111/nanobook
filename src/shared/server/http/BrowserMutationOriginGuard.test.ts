import { describe, expect, it } from "vitest";

import { rejectCrossOriginBrowserMutation } from "./BrowserMutationOriginGuard";

const TRUSTED_ORIGIN = "https://nanobook.test";

describe("rejectCrossOriginBrowserMutation", () => {
  it("allows safe methods without browser metadata", () => {
    const response = rejectCrossOriginBrowserMutation(
      new Request(`${TRUSTED_ORIGIN}/api/nanobooks`),
      TRUSTED_ORIGIN,
    );

    expect(response).toBeUndefined();
  });

  it("allows same-origin POST requests", () => {
    const response = rejectCrossOriginBrowserMutation(
      new Request(`${TRUSTED_ORIGIN}/api/nanobooks`, {
        method: "POST",
        headers: { Origin: TRUSTED_ORIGIN },
      }),
      TRUSTED_ORIGIN,
    );

    expect(response).toBeUndefined();
  });

  it("allows same-origin fetch metadata", () => {
    const response = rejectCrossOriginBrowserMutation(
      new Request(`${TRUSTED_ORIGIN}/api/nanobooks`, {
        method: "PATCH",
        headers: { "Sec-Fetch-Site": "same-origin" },
      }),
      TRUSTED_ORIGIN,
    );

    expect(response).toBeUndefined();
  });

  it("rejects an unsafe request with an untrusted Origin", () => {
    const response = rejectCrossOriginBrowserMutation(
      new Request(`${TRUSTED_ORIGIN}/api/nanobooks`, {
        method: "POST",
        headers: { Origin: "https://evil.example" },
      }),
      TRUSTED_ORIGIN,
    );

    expect(response?.status).toBe(403);
  });

  it("rejects an unsafe cross-site browser request", () => {
    const response = rejectCrossOriginBrowserMutation(
      new Request(`${TRUSTED_ORIGIN}/api/nanobooks`, {
        method: "DELETE",
        headers: { "Sec-Fetch-Site": "cross-site" },
      }),
      TRUSTED_ORIGIN,
    );

    expect(response?.status).toBe(403);
  });

  it("leaves protocol clients without browser metadata to their authentication contract", () => {
    const response = rejectCrossOriginBrowserMutation(
      new Request(`${TRUSTED_ORIGIN}/api/nanobooks`, { method: "POST" }),
      TRUSTED_ORIGIN,
    );

    expect(response).toBeUndefined();
  });
});
