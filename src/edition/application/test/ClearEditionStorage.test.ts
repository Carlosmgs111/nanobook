import { describe, it, expect } from "vitest";
import { ClearEditionStorage } from "../ClearEditionStorage";
import { createDocumentStorage } from "./factories";

describe("ClearEditionStorage", () => {
  it("clears all edition storage", () => {
    const storage = createDocumentStorage();
    const useCase = new ClearEditionStorage(storage);

    const result = useCase.execute();

    expect(result.isSuccess).toBe(true);
    expect(storage.clearAll).toHaveBeenCalled();
  });
});
