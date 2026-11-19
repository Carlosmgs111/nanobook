// src/spreadsheets/browser/saveSpreadsheet.test.ts
import { describe, expect, it, vi } from "vitest";
import { saveSpreadsheet } from "./saveSpreadsheet";

const context = { nanobookId: "book a", documentPath: "guias/ventas" };
const original = [["Sur", 98]];
const next = [["Sur", 105]];

describe("saveSpreadsheet", () => {
  it("sends the original and the edited rows to the nanobook endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));

    const outcome = await saveSpreadsheet(context, original, next, fetcher);

    expect(outcome).toBe("saved");
    expect(fetcher).toHaveBeenCalledWith("/api/nanobooks/book%20a/spreadsheets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentPath: "guias/ventas", original, next }),
    });
  });

  it("reports a stale sheet on 409 and an error otherwise", async () => {
    expect(await saveSpreadsheet(context, original, next, vi.fn().mockResolvedValue(new Response("{}", { status: 409 })))).toBe("stale");
    expect(await saveSpreadsheet(context, original, next, vi.fn().mockResolvedValue(new Response("{}", { status: 403 })))).toBe("error");
    expect(await saveSpreadsheet(context, original, next, vi.fn().mockRejectedValue(new Error("offline")))).toBe("error");
  });
});
