import { describe, expect, it } from "vitest";
import { preservesBuildingAccess } from "../../src/game-core/farm/buildingAccess";

const building = (column: number, row: number) => ({ type: "granary" as const, column, row });

describe("building access", () => {
  it("allows an open farm and a one-tile corridor", () => {
    expect(preservesBuildingAccess({ buildings: [] })).toBe(true);
    expect(preservesBuildingAccess({ buildings: [building(0, 0)] })).toBe(true);
  });

  it("rejects enclosing a two-tile pocket against the top boundary", () => {
    expect(preservesBuildingAccess({ buildings: [building(3, -3), building(6, -3), building(4, -1)] })).toBe(false);
  });

  it("allows the northern bypass around the formerly trapping layout", () => {
    expect(preservesBuildingAccess({ buildings: [building(1, 0), building(5, 0), building(3, 2)] })).toBe(true);
  });

  it("uses visible bounds rather than relying on an offscreen route", () => {
    const buildings = [building(0, 2), building(2, 2), building(4, 2), building(6, 2)];
    expect(preservesBuildingAccess({ buildings })).toBe(true);
    expect(preservesBuildingAccess({ buildings, columnBounds: { minimumColumn: 0, maximumColumn: 7 } })).toBe(false);
  });

  it("applies the same rule to breweries", () => {
    expect(preservesBuildingAccess({ buildings: [building(3, -3), building(6, -3), { type: "brewery", column: 4, row: -1 }] })).toBe(false);
  });
});
