import { expect, it } from "vitest";
import { marketEntryPosition, marketLoop } from "../../src/game-data/marketLayout";

it("skips occupied and partially occupied road tiles for subsequent arrivals", () => {
  const entry = { column: 0, row: marketLoop.top };
  expect(marketEntryPosition(entry, [])).toEqual(entry);
  expect(marketEntryPosition(entry, [entry, { ...entry, column: 1.5 }])).toEqual({ ...entry, column: 3 });
  expect(marketEntryPosition(entry, Array.from({ length: 9 }, (_, column) => ({ ...entry, column })))).toEqual({ ...entry, column: 9 });
});

it("preserves positions away from the entrance when rejoining", () => {
  const position = { column: 13, row: 7 };
  expect(marketEntryPosition(position, [position])).toEqual(position);
});
