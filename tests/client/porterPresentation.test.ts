import { describe, expect, it } from "vitest";
import { porterApproach, porterPathLength, porterRoadOffset, positionAlongPorterPath } from "../../src/client/game/phaser/porterPresentation";
import { PORTER_STEP_MS } from "../../src/game-data/porter";
import { FARMER_MOVE_DURATION_PER_TILE } from "../../src/game-core/farm/batchPlantingTravel";
import { getFarmerRoadOffset } from "../../src/client/game/phaser/farmerArrival";

describe("porter road alignment", () => {
  const offset = (tile: { row: number }) => getFarmerRoadOffset(tile.row === 5, 64);
  it("uses the farmer's height while idle and between road tiles", () => {
    expect(porterRoadOffset({ column: 11, row: 5 }, offset)).toBe(-32);
    expect(porterRoadOffset({ column: 7.25, row: 5 }, offset)).toBe(-32);
  });
  it("smoothly transitions to unshifted ground positioning", () => {
    expect(porterRoadOffset({ column: 7, row: 5.5 }, offset)).toBe(-16);
    expect(porterRoadOffset({ column: 7, row: 6 }, offset)).toBe(0);
  });
});

describe("porter market spawn", () => {
  it("takes one farmer walking interval per tile even on a long market approach", () => {
    const path = porterApproach({ column: 11, row: 5 }, [{ column: 3, row: 5 }, { column: 4, row: 5 }]);
    const duration = porterPathLength(path) * PORTER_STEP_MS;
    expect(PORTER_STEP_MS).toBe(FARMER_MOVE_DURATION_PER_TILE);
    expect(positionAlongPorterPath(path, FARMER_MOVE_DURATION_PER_TILE / duration)).toEqual({ column: 10, row: 5 });
  });
  it("starts the visual approach beside the market and joins the saved pickup route", () => {
    const market = { column: 11, row: 5 };
    const pickup = { column: 5, row: 5 };
    const path = porterApproach(market, [{ column: 3, row: 5 }, { column: 4, row: 5 }, pickup]);
    expect(positionAlongPorterPath(path, 0)).toEqual(market);
    expect(positionAlongPorterPath(path, 1)).toEqual(pickup);
    expect(positionAlongPorterPath(path, 0.5).row).toBe(5);
  });
});
