import { expect, it } from "vitest";
import { homeVisitUnavailable } from "../../src/game-core/home/visiting";
import { PlayerHomeSchema } from "../../src/schemas/playerHome";

it("opens homes publicly from level ten, including existing homes without a setting", () => {
  expect(homeVisitUnavailable(10, 10)).toBeNull();
  expect(homeVisitUnavailable(9, 10)).not.toBeNull();
  expect(homeVisitUnavailable(10, 9)).not.toBeNull();
  expect(homeVisitUnavailable(11, 11, "private")).toBe("This home is private.");
  expect(homeVisitUnavailable(11, 11, "private", true)).toBeNull();
});
it("visit payload excludes balances, storage, jobs and private appearance settings", () => {
  const result = PlayerHomeSchema.parse({
    profile: { playerId: "c336fe95-66eb-4ec7-a21f-41081d4c101a", name: "Gudea", level: 10, neighbourhood: "Ur", zigguratPatron: false, canVisit: true, unavailableReason: null },
    appearance: { furniture: [], wallTablet: "home-tablet-sky", visibility: "private", furnitureRevision: 3 },
    inventory: { barley: 99 }, shekels: 100, production: {},
  });
  expect(Object.keys(result)).toEqual(["profile", "appearance"]);
  expect(result.appearance).toEqual({ furniture: [], wallTablet: "home-tablet-sky" });
});
