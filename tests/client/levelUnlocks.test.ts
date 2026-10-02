import { describe, expect, it } from "vitest";
import { LEVEL_NAMES, LEVEL_UNLOCK_ITEMS, LEVEL_UNLOCKS } from "../../src/game-data/progression";

describe("level unlock lists", () => {
  it("lists the planned small shrine separately from the playable second granary", () => {
    expect(LEVEL_UNLOCK_ITEMS[8]).toEqual(["Second granary", "Small shrine (coming soon)"]);
  });
  it("separates level-seven unlocks into individual items", () => {
    expect(LEVEL_UNLOCK_ITEMS[7]).toEqual([
      "Merchant requests",
      "Increased granary capacity (20 barley per granary)",
      "Mill donkey (30 shekels at the Baking market)"
    ]);
  });
  it("provides items for every level and derives notification text from them", () => {
    expect(LEVEL_UNLOCK_ITEMS).toHaveLength(LEVEL_NAMES.length);
    LEVEL_UNLOCK_ITEMS.forEach((items, level) => {
      if (level > 0) expect(items.length).toBeGreaterThan(0);
      expect(LEVEL_UNLOCKS[level]).toBe(items.join(", "));
    });
  });
});
