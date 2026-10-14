import { expect, it } from "vitest";
import { FEMALE_FARMER_NAMES, MALE_FARMER_NAMES } from "../../src/game-data/farmerNames";
import { FARMER_NAME_CUNEIFORM, farmerNameCuneiform } from "../../src/game-data/farmerNameCuneiform";

it("maps all ten starting names to their editable translations", () => {
  const names = [...MALE_FARMER_NAMES, ...FEMALE_FARMER_NAMES];
  expect(Object.keys(FARMER_NAME_CUNEIFORM).sort()).toEqual([...names].sort());
  for (const name of names) expect(farmerNameCuneiform(name)).toBe(FARMER_NAME_CUNEIFORM[name]);
});

it("omits translations for unknown names", () => {
  expect(farmerNameCuneiform("Farmer")).toBe("");
  expect(farmerNameCuneiform("toString")).toBe("");
});
