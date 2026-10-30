import { expect, it } from "vitest";
import { INITIAL_FARM_CONFIG as config } from "../../src/game-data/initialFarm";
import { isArableGround, isBuildingGround } from "../../src/game-core/farm/land";
import { porterPath, porterRoadPath } from "../../src/game-core/farm/porter";
import { WorkerPositionSchema } from "../../src/game-data/productionJourney";

it("adds exactly three non-arable northern rows without moving existing landmarks", () => {
  expect(config.worldBounds.minimumRow).toBe(-3);
  expect(config.worldBounds.minimumColumn).toBe(-4);
  expect(config.worldBounds.maximumColumn).toBe(11);
  expect(config.roadRow).toBe(5);
  expect(config.riverRow).toBe(10);
  expect(config.plotBounds).toEqual({minimumColumn:0,maximumColumn:7,minimumRow:6,maximumRow:9});
  for (const row of [-3,-2,-1]) {
    const tile={column:0,row};
    expect(isBuildingGround(tile)).toBe(true);
    expect(isArableGround(tile)).toBe(false);
    expect(WorkerPositionSchema.safeParse(tile).success).toBe(true);
  }
  expect(isBuildingGround({column:0,row:-4})).toBe(false);
  expect(WorkerPositionSchema.safeParse({column:0,row:-4}).success).toBe(false);
});
it("routes workers into the new rows but still confines the porter to connected roads", () => {
  const from={column:-2,row:5}, to={column:-2,row:-3};
  const roads=Array.from({length:8},(_,i)=>({column:-2,row:i-3}));
  const path=porterRoadPath([],roads,from,to,0);
  expect(path?.[0]).toEqual(from);
  expect(path?.at(-1)).toEqual(to);
  expect(path).toHaveLength(9);
  expect(porterRoadPath([],roads.filter(r=>r.row!==-1),from,to,0)).toBeNull();
  expect(porterPath([],[],from,to,0)?.at(-1)).toEqual(to);
});
