import { expect, it } from "vitest";
import { ROAD_CONSTRUCTION_DURATION_MS, roadIsComplete } from "../../src/game-data/roads";

it("completes roads at the saved deadline and treats legacy roads as complete", () => {
  const road = { column: 0, row: 4, completesAt: 1000 + ROAD_CONSTRUCTION_DURATION_MS };
  expect(ROAD_CONSTRUCTION_DURATION_MS).toBe(5000);
  expect(roadIsComplete(road, road.completesAt - 1)).toBe(false);
  expect(roadIsComplete(road, road.completesAt)).toBe(true);
  expect(roadIsComplete(road, road.completesAt + 86400000)).toBe(true);
  expect(roadIsComplete({ column: 0, row: 4 }, 0)).toBe(true);
});
