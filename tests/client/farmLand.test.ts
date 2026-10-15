import { describe, expect, it } from "vitest";
import { isArableGround, isBuildingGround, sceneryPositions } from "../../src/game-core/farm/land";
import { planArableSceneryRelocation } from "../../src/game-core/farm/sceneryRelocation";
import { insidePlot } from "../../src/client/game/phaser/isometricFarm";
import { validateBuildingPlacement } from "../../src/game-core/farm/buildings";

describe("separate farming and building land", () => {
  it("shares exactly eight columns and four southern rows with the renderer", () => {
    let arable = 0;
    for (let row = 0; row <= 15; row++) for (let column = -4; column <= 11; column++) {
      const cell = { column, row }, expected = column >= 0 && column <= 7 && row >= 6 && row <= 9;
      expect(isArableGround(cell)).toBe(expected);
      expect(insidePlot(cell)).toBe(expected);
      if (expected) arable++;
      expect(isBuildingGround(cell)).toBe(!expected && ![5, 10, 11].includes(row));
    }
    expect(arable).toBe(32);
  });
  it.each([-4, -2, 3, 7, 8])("builds on northern ordinary ground at column %i", column => {
    expect(validateBuildingPlacement({ building: "granary", target: { column, row: 3 },
      existingBuildings: [], carriedItem: null, occupiedCoordinates: new Set(), availableMaterials: { reed: 2, clay: 3 }
    }).type).toBe("valid");
  });
  it("protects the permanent market from building placement", () => {
    expect(validateBuildingPlacement({ building: "granary", target: { column: 10, row: 3 },
      existingBuildings: [], carriedItem: null, occupiedCoordinates: new Set(), availableMaterials: { reed: 2, clay: 3 }
    }).type).toBe("footprint_occupied");
  });
  it("relocates scenery without duplication, preserves IDs and avoids reserved ground", () => {
    const objects = [
      { id: "reed", type: "reeds" as const, column: 7, row: 9 },
      { id: "rock", type: "rock" as const, column: 0, row: 9 },
      { id: "bush", type: "bush" as const, column: 6, row: 9 },
      { id: "unchanged", type: "bush" as const, column: -2, row: 2 }
    ];
    const occupied = new Set(["8:9", "-1:9"]);
    const plan = planArableSceneryRelocation(objects, occupied);
    expect(plan.type).toBe("ready");
    if (plan.type !== "ready") return;
    expect(plan.moves.map(o => o.id).sort()).toEqual(["bush", "reed", "rock"]);
    expect(plan.moves.every(o => !isArableGround(o) && !occupied.has(`${o.column}:${o.row}`))).toBe(true);
    expect(plan.moves.find(o => o.id === "reed")?.row).toBe(9);
    expect(new Set(plan.moves.map(o => `${o.column}:${o.row}`)).size).toBe(3);
    const migrated = objects.map(o => plan.moves.find(m => m.id === o.id) ?? o);
    expect(planArableSceneryRelocation(migrated, occupied)).toEqual({ type: "ready", moves: [] });
    expect(objects[0]).toMatchObject({ column: 7, row: 9 });
  });
  it("reports an exhausted riverbank instead of deleting a source", () => {
    expect(planArableSceneryRelocation([{ id: "r", type: "reeds", column: 1, row: 9 }],
      new Set(sceneryPositions(true).map(p => `${p.column}:${p.row}`)))).toEqual({ type: "no_space" });
  });
});
