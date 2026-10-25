import { describe, expect, it } from "vitest";
import { farmerProductionJob } from "../../src/game-core/farm/farmerProduction";

describe("farmer production availability", () => {
  it("releases donkey preparation on time, retaining compatibility with old jobs", () => {
    const milling = { buildingId: "mill", worker: "donkey" as const, startedAt: new Date(20_000).toISOString() };
    expect(farmerProductionJob({ milling }, 19_999)?.type).toBe("milling");
    expect(farmerProductionJob({ milling }, 20_000)).toBeNull();
    expect(farmerProductionJob({ milling: { buildingId: "mill", worker: "donkey" } }, 0)).toBeNull();
  });
});
