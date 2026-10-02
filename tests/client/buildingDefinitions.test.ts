import { describe, expect, it } from "vitest";
import { BREAD_OVEN_DEFINITION, FARM_BUILDING_DEFINITIONS } from "../../src/game-data/buildings";

describe("level-6 building construction balance", () => {
  it("requires baking tools for the oven, retaining brewery jars", () => {
    expect(BREAD_OVEN_DEFINITION).toMatchObject({
      footprint: { columns: 2, rows: 2 },
      constructionDurationMs: 180000,
      materials: { reed: 4, clay: 6 }
    });
    expect(BREAD_OVEN_DEFINITION.materials).toEqual({ reed: 4, clay: 6, bakingTools: 2 });
    expect(FARM_BUILDING_DEFINITIONS.brewery.materials.brewingVessels).toBe(2);
  });
});
