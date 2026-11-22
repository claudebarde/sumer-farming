import { expect, it } from "vitest";
import { recordSpecialtyProduction } from "../../src/game-core/farm/productionSpecialty";
import { ProductionSpecialtySchema } from "../../src/schemas/productionSpecialty";

it("starts empty, counts output quantities, and preserves the leader in a tie", () => {
  expect(recordSpecialtyProduction(undefined, {})).toEqual({ quantities: {} });
  const first = recordSpecialtyProduction(undefined, { beer: 2 });
  const tied = recordSpecialtyProduction(first, { bread: 2 });
  expect(tied).toEqual({ quantities: { beer: 2, bread: 2 }, leader: "beer" });
  expect(recordSpecialtyProduction(tied, { oil: 3 })).toEqual({ quantities: { beer: 2, bread: 2, oil: 3 }, leader: "oil" });
  expect(first.quantities).toEqual({ beer: 2 });
});
it("resolves simultaneous first-batch ties deterministically and validates persisted counters", () => {
  const first = recordSpecialtyProduction(undefined, { beer: 2, bread: 2 });
  expect(first.leader).toBe("bread");
  expect(ProductionSpecialtySchema.parse(first)).toEqual(first);
  expect(ProductionSpecialtySchema.safeParse({ quantities: { oil: -1 } }).success).toBe(false);
});
