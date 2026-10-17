import { expect, it } from "vitest";
import { carryingLiquidJars, farmerJarBounds, farmerJarCarryTexture, FARMER_JAR_SOURCES } from "../../src/client/game/phaser/farmerJarCarry";

it("uses the default walking cadence and an idle carrying pose", () => {
  expect(farmerJarCarryTexture(0, true)).toBe("farmer-jars-walk-0");
  expect(farmerJarCarryTexture(35, true)).toBe("farmer-jars-walk-1");
  expect(farmerJarCarryTexture(70, true)).toBe("farmer-jars-walk-0");
  expect(farmerJarCarryTexture(35, false)).toBe("farmer-jars-idle");
  expect(Object.keys(FARMER_JAR_SOURCES)).toHaveLength(3);
  expect(farmerJarBounds("farmer-jars-walk-0")).toEqual(farmerJarBounds("farmer-jars-walk-1"));
});

it("carries collected water and saved beer deliveries, but not empty approach trips or other goods", () => {
  expect(carryingLiquidJars({ itemKey: "water", quantity: 1 }, null)).toBe(true);
  expect(carryingLiquidJars(null, { itemKey: "beer", quantity: 2 })).toBe(true);
  expect(carryingLiquidJars(null, null)).toBe(false);
  expect(carryingLiquidJars({ itemKey: "water", quantity: 0 }, null)).toBe(false);
  expect(carryingLiquidJars(null, { itemKey: "bread", quantity: 2 })).toBe(false);
  expect(carryingLiquidJars({ itemKey: "fish", quantity: 1 }, null)).toBe(false);
});
