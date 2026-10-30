import { describe, expect, it } from "vitest";
import { MarketPositionSchema } from "../../src/schemas/marketPresence";

describe("market presence coordinate validation", () => {
  it("rejects building, non-finite and off-map coordinates", () => {
    for (const position of [{ column: 1, row: 6 }, { column: -1, row: 3 }, { column: Infinity, row: 5 }, { column: 12, row: 5 }]) {
      expect(MarketPositionSchema.safeParse(position).success).toBe(false);
    }
  });
});
