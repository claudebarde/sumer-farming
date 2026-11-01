import { describe, expect, it } from "vitest";
import { MarketPositionSchema } from "../../src/schemas/marketPresence";

describe("market presence coordinate validation", () => {
  it("rejects building, non-finite and off-map coordinates", () => {
    for (const position of [{ column: 1, row: 6 }, { column: -1, row: 3 }, { column: Infinity, row: 5 }, { column: 16, row: 5 }]) {
      expect(MarketPositionSchema.safeParse(position).success).toBe(false);
    }
  });
});

it("accepts the widened market roads", () => {
  for (const position of [{ column: 15, row: 5 }, { column: 13, row: 8 }, { column: 11, row: 11 }])
    expect(MarketPositionSchema.safeParse(position).success).toBe(true);
});
