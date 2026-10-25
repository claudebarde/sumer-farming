import { describe, expect, it } from "vitest";
import { millRecipe, MillingJobSchema } from "../../src/game-data/milling";
import { farmerProductionJob } from "../../src/game-core/farm/farmerProduction";
import { marketIncludesItem } from "../../src/client/stores/marketUiStore";
import { marketUnlockLevel } from "../../src/game-data/progression";

describe("shared donkey rules", () => {
  it("offers the donkey only in the NPC bread buy tab from level seven", () => {
    expect(marketUnlockLevel("donkey")).toBe(7);
    for (const scope of ["bread", "beer", "barley"] as const) {
      for (const market of ["npc", "player"] as const) {
        for (const action of ["buy", "sell"] as const) {
          expect(marketIncludesItem(scope, "donkey", { market, action })).toBe(scope === "bread" && market === "npc" && action === "buy");
        }
      }
    }
  });
  it.each(["flour", "brewersGroats"] as const)("triples the %s batch without changing yield or throughput", recipe => {
    expect(millRecipe(recipe)).toMatchObject({ barley: 2, output: 1, durationMs: 300000 });
    expect(millRecipe(recipe, "donkey")).toMatchObject({ barley: 6, output: 3, durationMs: 900000 });
  });
  it("keeps legacy jobs farmer-operated but permits independent donkey work", () => {
    const job = MillingJobSchema.parse({ buildingId: "00000000-0000-4000-8000-000000000001", recipe: "flour", barley: 2, output: 1,
      startedAt: "2026-10-01T00:00:00Z", completesAt: "2026-10-01T00:05:00Z" });
    expect(farmerProductionJob({ milling: job })?.type).toBe("milling");
    expect(farmerProductionJob({ milling: { ...job, worker: "donkey" } })).toBeNull();
  });
});
